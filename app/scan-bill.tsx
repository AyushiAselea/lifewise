import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, FadeIn, SlideInUp } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/lib/theme-context';
import { getApiUrl } from '@/lib/query-client';
import { useAuth } from '@/lib/auth-context';
import { useExpenses } from '@/lib/expense-context';
import { useAlert } from '@/lib/alert-context';
import PremiumLoader from '@/components/PremiumLoader';
import { scheduleLocalNotification } from '@/lib/notifications';
import { useCurrency } from '@/lib/currency-context';
import CustomModal from '@/components/CustomModal';

type ScanStep = 'guide' | 'preview' | 'processing' | 'result';

export default function ScanBillScreen() {
  const router = useRouter();
  const { billId } = useLocalSearchParams<{ billId?: string }>();
  const { colors, isDark } = useTheme();
  const { token } = useAuth();
  const { bills, refreshData } = useExpenses();
  const { formatAmount } = useCurrency();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const existingBill = useMemo(() => 
    billId ? bills.find(b => b.id === billId) : null
  , [billId, bills]);
  const topInset = Platform.OS === 'web' ? 20 : insets.top;

  const [step, setStep] = useState<ScanStep>('guide');
  const [flashOn, setFlashOn] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<{
    uri: string;
    fileName?: string;
    mimeType?: string;
  } | null>(null);

  const [scanStage, setScanStage] = useState(0);
  const [editingData, setEditingData] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const pendingResultRef = useRef<any>(null); // holds API result until animation finishes
  const apiDoneRef = useRef(false);

  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SCAN_STAGES = useMemo(() => [
    { icon: 'document-text-outline', label: 'Uploading image...', sub: 'Preparing bill for analysis', color: '#6366F1' },
    { icon: 'scan-outline', label: 'Running OCR scan...', sub: 'Google Vision reading all text', color: '#8B5CF6' },
    { icon: 'text-outline', label: 'Extracting data...', sub: 'Reading amounts, dates & vendor info', color: '#EC4899' },
    { icon: 'sparkles-outline', label: 'AI structuring...', sub: 'Claude AI organizing the bill data', color: '#F59E0B' },
    { icon: 'checkmark-circle-outline', label: 'Done!', sub: 'Preparing your editable summary', color: '#10B981' },
  ], []);

  useEffect(() => {
    return () => {
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
    };
  }, []);

  const takePictureFromCamera = useCallback(async () => {
    if (Platform.OS === 'web') {
      showAlert({
        title: 'Not supported',
        message: 'Camera capture is not supported on web in this flow.',
        type: 'info',
      });
      return;
    }

    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        showAlert({
          title: 'Permission needed',
          message: 'Camera permission is required to scan bills.',
          type: 'warning',
        });
        return;
      }
    }

    try {
      const pic = await cameraRef.current?.takePictureAsync({ quality: 1.0 });
      if (!pic?.uri) {
        showAlert({
          title: 'Scan failed',
          message: 'Could not capture the photo. Please try again.',
          type: 'error',
        });
        return;
      }

      setStep('preview');
      setPhoto({
        uri: pic.uri,
        fileName: 'bill.jpg',
        mimeType: 'image/jpeg',
      });
    } catch {
      showAlert({
        title: 'Scan failed',
        message: 'Unexpected error while taking photo.',
        type: 'error',
      });
    }
  }, [cameraPermission, requestCameraPermission]);

  const openGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1.0,
    });

    if (result.canceled || !result.assets || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.uri) return;

    setStep('preview');
    setPhoto({
      uri: asset.uri,
      fileName: asset.fileName ?? 'bill.jpg',
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  }, []);

  // Animate through stages, each visible for minMs. When done, show result.
  const animateToEnd = useCallback((fromStage: number, setResult: () => void) => {
    const STAGE_MIN_MS = 1800; // each step visible for at least 1.8s
    const remaining = 4 - fromStage;
    if (remaining <= 0) { setTimeout(setResult, 500); return; }
    let cur = fromStage;
    const tick = () => {
      cur += 1;
      setScanStage(cur);
      if (cur < 4) setTimeout(tick, STAGE_MIN_MS);
      else setTimeout(setResult, 800); // brief pause on Done before transitioning
    };
    setTimeout(tick, STAGE_MIN_MS);
  }, []);

  const startScanStages = useCallback(() => {
    setScanStage(0);
    apiDoneRef.current = false;
    pendingResultRef.current = null;
    if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
    let idx = 0;
    // Advance one step every 15s during API call
    rotationTimerRef.current = setInterval(() => {
      if (apiDoneRef.current) return; // API done — animateToEnd takes over
      idx = Math.min(idx + 1, 3); // only go to stage 3 while waiting
      setScanStage(idx);
    }, 15000);
  }, []);

  const scanPreview = useCallback(async () => {
    if (!photo || !token) {
      showAlert({ title: 'Not ready', message: 'Please login again and try scanning.', type: 'warning' });
      return;
    }

    setStep('processing');
    startScanStages();

    try {
      const baseUrl = getApiUrl();
      const url = new URL('/api/bills/scan/preview', baseUrl).toString();
      const form = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(photo.uri);
        const blob = await response.blob();
        form.append('image', blob, photo.fileName || 'bill.jpg');
      } else {
        form.append('image', {
          uri: photo.uri,
          name: photo.fileName || 'bill.jpg',
          type: photo.mimeType || 'image/jpeg',
        } as any);
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      // Stop the slow interval — we control animation now
      if (rotationTimerRef.current) { clearInterval(rotationTimerRef.current); rotationTimerRef.current = null; }
      apiDoneRef.current = true;

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.message ?? 'Could not read this bill. Please try again.';
        showAlert({
          title: 'Scan Failed', message: msg, type: 'error',
          buttons: [{ text: 'Try Again', onPress: () => { setStep('guide'); setPhoto(null); } }],
        });
        setStep('preview');
        return;
      }

      const resJson = await res.json();
      // Store result & animate remaining steps to completion before showing
      setEditingData(resJson.preview);
      setConfidence(resJson.metadata?.confidence || null);

      // Capture current stage and animate to Done, then show result
      setScanStage(cur => {
        animateToEnd(cur, () => setStep('result'));
        return cur;
      });
    } catch {
      if (rotationTimerRef.current) { clearInterval(rotationTimerRef.current); rotationTimerRef.current = null; }
      showAlert({ title: 'Network Error', message: 'Connection failed while scanning.', type: 'error' });
      setStep('preview');
    }
  }, [photo, token, startScanStages, animateToEnd]);

  const commitReminder = useCallback(async () => {
    if (!editingData || !token) return;
    setIsSaving(true);
    try {
      const baseUrl = getApiUrl();
      if (billId && existingBill) {
        const url = new URL(`/api/bills/${billId}`, baseUrl).toString();
        const res = await fetch(url, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...editingData, status: existingBill.status, isPaid: existingBill.isPaid }),
        });
        if (!res.ok) throw new Error('Update failed');
      } else {
        const url = new URL('/api/bills/scan/commit', baseUrl).toString();
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ preview: editingData }),
        });
        if (!res.ok) throw new Error('Save failed');
        const created = await res.json();
        if (created?.dueDate) {
          await scheduleLocalNotification({
            title: `${created.name || 'Bill'} Due Soon`,
            body: `₹${created.amount ?? 0} due on ${new Date(created.dueDate).toLocaleDateString('en-IN')}`,
            data: { type: 'reminder', billId: created.id },
            triggerAt: new Date(created.dueDate),
          }).catch(() => {});
        }
        router.replace(`/bill-details/${created.id}`);
      }
      await refreshData();
      setStep('guide');
      setPhoto(null);
    } catch {
      showAlert({ title: 'Error', message: 'Could not save bill. Please try again.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  }, [editingData, token, billId, existingBill, refreshData, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingBottom: 40 }]}>
      <Animated.View
        entering={Platform.OS !== 'web' ? FadeInDown.duration(400) : undefined}
        style={[styles.header, { paddingTop: topInset + 12 }]}
      >
        <Pressable onPress={() => step === 'result' ? (setStep('preview')) : router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {step === 'processing' ? 'Scanning...' : step === 'result' ? 'Review & Save' : 'Scan Bill'}
        </Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      <View style={styles.body}>
        {step === 'guide' && (
          <View style={styles.guideStepWrap}>
            {Platform.OS !== 'web' && cameraPermission?.granted ? (
              <CameraView ref={cameraRef} style={styles.camera} facing="back" flash={flashOn ? 'on' : 'off'}>
                <View style={styles.cameraOverlay}>
                  <View style={styles.cameraTop}>
                    <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={styles.topInfoBlur}>
                      <Text style={[styles.guideTitle, { color: '#FFFFFF' }]}>{billId ? 'Updating bill' : 'Scan Your Bill'}</Text>
                      <Text style={[styles.guideSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>Keep bill flat & within corner marks</Text>
                    </BlurView>
                  </View>
                  <View style={styles.cameraFrameCenter}>
                    <View style={styles.frameCornerTL} /><View style={styles.frameCornerTR} />
                    <View style={styles.frameCornerBL} /><View style={styles.frameCornerBR} />
                    <View style={styles.frameScanLine} />
                  </View>
                  <View style={styles.cameraBottomBar}>
                    <Pressable onPress={openGallery} style={styles.sideActionBtn}>
                      <Ionicons name="images" size={24} color="#FFFFFF" />
                      <Text style={styles.sideActionText}>Gallery</Text>
                    </Pressable>
                    <Pressable onPress={takePictureFromCamera} style={styles.mainCaptureBtn}>
                      <View style={styles.captureInner} />
                    </Pressable>
                    <Pressable onPress={() => setFlashOn(!flashOn)} style={[styles.sideActionBtn, flashOn && { backgroundColor: 'rgba(245,158,11,0.3)' }]}>
                      <Ionicons name={flashOn ? "flash" : "flash-off"} size={24} color={flashOn ? "#F59E0B" : "#FFFFFF"} />
                      <Text style={[styles.sideActionText, flashOn && { color: "#F59E0B" }]}>Flash</Text>
                    </Pressable>
                  </View>
                </View>
              </CameraView>
            ) : (
              <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.delay(100).duration(500) : undefined} style={styles.center}>
                <View style={[styles.fallbackFrame, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={[styles.fallbackIconWrap, { backgroundColor: colors.accentMintDim }]}>
                    <Ionicons name="camera" size={32} color={colors.accentMint} />
                  </View>
                  <Text style={[styles.fallbackTitle, { color: colors.text }]}>Camera Access Required</Text>
                  <Text style={[styles.fallbackSubtitle, { color: colors.textSecondary }]}>
                    Scan your physical bills to automatically extract details like amount, date, and items with AI.
                  </Text>
                  <View style={styles.fallbackActions}>
                    <Pressable style={[styles.primaryActionBtn, { backgroundColor: colors.accent }]} onPress={() => Platform.OS === 'web' ? openGallery() : requestCameraPermission()}>
                      <Ionicons name={Platform.OS === 'web' ? "images" : "camera"} size={20} color="#FFFFFF" />
                      <Text style={styles.primaryActionBtnText}>{Platform.OS === 'web' ? 'Choose from Gallery' : 'Allow Camera'}</Text>
                    </Pressable>
                    <Pressable onPress={openGallery} style={[styles.galleryActionBtn, { backgroundColor: colors.accentMintDim }]}>
                      <Ionicons name="images-outline" size={20} color={colors.accentMint} />
                      <Text style={[styles.galleryActionBtnText, { color: colors.accentMint }]}>Upload from Gallery</Text>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            )}
          </View>
        )}

        {step === 'preview' && photo && (
          <View style={styles.guideStepWrap}>
            <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="contain" />
            <View style={styles.actionsRow}>
              <Pressable style={[styles.actionBtn, { backgroundColor: colors.inputBg }]} onPress={() => { setPhoto(null); setStep('guide'); }}>
                <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Retake</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={scanPreview}>
                <Text style={styles.actionBtnText}>Scan Bill</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── PROCESSING: Step-by-step progress UI ── */}
        {step === 'processing' && (
          <Animated.View entering={Platform.OS !== 'web' ? FadeIn.duration(400) : undefined} style={styles.processingWrap}>

            {/* ─ Bill image with scanning overlay ─ */}
            <View style={styles.processingImgWrap}>
              {photo && (
                <Image source={{ uri: photo.uri }} style={styles.processingImg} resizeMode="cover" />
              )}
              {/* Scanning overlay gradient at bottom */}
              <View style={styles.processingImgOverlay}>
                <Ionicons name="scan" size={28} color="#fff" style={{ opacity: 0.9 }} />
                <Text style={styles.processingImgLabel}>Analyzing…</Text>
              </View>
            </View>

            {/* ─ Steps card ─ */}
            <View style={[styles.stepsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.processingHeading, { color: colors.text, fontSize: 17, marginBottom: 18 }]}>
                Processing Your Bill
              </Text>

              {SCAN_STAGES.map((stage, i) => {
                const isDone = i < scanStage;
                const isActive = i === scanStage;
                const isPending = i > scanStage;
                return (
                  <View key={i} style={styles.stepRow}>
                    {/* Vertical connector line */}
                    {i > 0 && (
                      <View style={[styles.stepConnector, { backgroundColor: isDone ? stage.color : colors.border }]} />
                    )}
                    {/* Dot */}
                    <View style={[styles.stepDot, {
                      borderColor: isActive || isDone ? stage.color : colors.border,
                      backgroundColor: isDone ? stage.color : isActive ? (stage.color + '25') : colors.inputBg,
                    }]}>
                      {isDone
                        ? <Ionicons name="checkmark" size={15} color="#fff" />
                        : isActive
                          ? <ActivityIndicator size="small" color={stage.color} />
                          : <Ionicons name={stage.icon as any} size={14} color={isPending ? colors.textTertiary : stage.color} />
                      }
                    </View>
                    {/* Text */}
                    <View style={styles.stepTextWrap}>
                      <Text style={[styles.stepLabel, {
                        color: isDone ? colors.textSecondary : isActive ? colors.text : colors.textTertiary,
                        fontFamily: isActive ? 'Inter_700Bold' : 'Inter_400Regular',
                        textDecorationLine: isDone ? 'none' : 'none',
                      }]}>
                        {stage.label}
                      </Text>
                      {isActive && (
                        <Text style={[styles.stepSub, { color: colors.textSecondary }]}>{stage.sub}</Text>
                      )}
                    </View>
                  </View>
                );
              })}

              <Text style={[styles.processingTip, { color: colors.textTertiary, marginTop: 16 }]}>
                ⏱ Takes 30–90 sec · Keep app open
              </Text>
            </View>
          </Animated.View>
        )}


        {/* ── RESULT: Inline editable form ── */}
        {step === 'result' && editingData && (
          <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.duration(400) : undefined} style={{ flex: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.resultScroll}>

              {/* AI confidence banner */}
              <View style={[styles.aiBanner, { backgroundColor: confidence && confidence >= 90 ? '#10B98115' : '#F59E0B15', borderColor: confidence && confidence >= 90 ? '#10B98140' : '#F59E0B40' }]}>
                <Ionicons name={confidence && confidence >= 90 ? 'checkmark-circle' : 'warning-outline'} size={18} color={confidence && confidence >= 90 ? '#10B981' : '#F59E0B'} />
                <Text style={[styles.aiBannerText, { color: confidence && confidence >= 90 ? '#10B981' : '#F59E0B' }]}>
                  {confidence && confidence >= 90
                    ? `AI extracted data with ${confidence}% confidence`
                    : 'AI could not fully read the bill — please verify & correct the fields below'}
                </Text>
              </View>

              {/* Bill name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>BILL NAME / VENDOR</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                  value={editingData?.name}
                  placeholder="e.g. DGVCL Electricity"
                  placeholderTextColor={colors.textTertiary}
                  onChangeText={(t) => setEditingData((p: any) => ({ ...p, name: t }))}
                />
              </View>

              {/* Amount */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>TOTAL AMOUNT (₹)</Text>
                <TextInput
                  style={[styles.fieldInput, styles.amountInput, { color: colors.text, borderColor: editingData?.amount > 0 ? colors.accent : '#EF4444', backgroundColor: colors.card }]}
                  value={editingData?.amount?.toString()}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  onChangeText={(t) => setEditingData((p: any) => ({ ...p, amount: parseFloat(t) || 0 }))}
                />
                {(!editingData?.amount || editingData?.amount === 0) && (
                  <Text style={styles.fieldHint}>⚠️ Amount not detected — please enter manually</Text>
                )}
              </View>

              {/* Due date */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>DUE DATE</Text>
                <Pressable
                  style={[styles.fieldInput, styles.dateInput, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={18} color={colors.accent} />
                  <Text style={[styles.dateText, { color: colors.text }]}>
                    {editingData?.dueDate ? new Date(editingData.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Tap to set date'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </Pressable>
              </View>

              {/* Category */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>CATEGORY</Text>
                <View style={styles.categoryRow}>
                  {['bills', 'utilities', 'internet', 'subscription'].map(cat => (
                    <Pressable
                      key={cat}
                      onPress={() => setEditingData((p: any) => ({ ...p, category: cat }))}
                      style={[styles.categoryChip, { backgroundColor: editingData?.category === cat ? colors.accent : colors.card, borderColor: editingData?.category === cat ? colors.accent : colors.border }]}
                    >
                      <Text style={[styles.categoryChipText, { color: editingData?.category === cat ? '#fff' : colors.textSecondary }]}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={editingData?.dueDate ? new Date(editingData.dueDate) : new Date()}
                  mode="date"
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setEditingData((p: any) => ({ ...p, dueDate: date.toISOString() }));
                  }}
                />
              )}
            </ScrollView>

            {/* Save button */}
            <View style={[styles.resultFooter, { borderTopColor: colors.border }]}>
              <Pressable style={[styles.resultDiscardBtn, { borderColor: colors.border }]} onPress={() => { setStep('preview'); setEditingData(null); }}>
                <Text style={[styles.resultDiscardText, { color: colors.textSecondary }]}>Retake</Text>
              </Pressable>
              <Pressable onPress={commitReminder} disabled={isSaving} style={[styles.resultSaveBtn, { backgroundColor: colors.accent, opacity: isSaving ? 0.7 : 1 }]}>
                {isSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="checkmark-circle" size={20} color="#fff" /><Text style={styles.resultSaveText}>{billId ? 'Update Bill' : 'Save Bill'}</Text></>
                }
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: { width: 40 },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    flex: 1,
    textAlign: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '75%',
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  guideStepWrap: {
    flex: 1,
  },
  camera: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  cameraOverlay: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  cameraTop: {
    alignItems: 'center',
    marginTop: 10,
  },
  topInfoBlur: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  guideTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  guideSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  cameraFrameCenter: {
    width: '100%',
    aspectRatio: 3 / 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  frameCornerTL: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#FFFFFF', borderTopLeftRadius: 20 },
  frameCornerTR: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#FFFFFF', borderTopRightRadius: 20 },
  frameCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#FFFFFF', borderBottomLeftRadius: 20 },
  frameCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#FFFFFF', borderBottomRightRadius: 20 },
  frameScanLine: {
    width: '90%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
    position: 'absolute',
    top: '50%',
  },
  cameraBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  mainCaptureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  sideActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    gap: 4,
  },
  sideActionText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  fallbackFrame: {
    width: '100%',
    padding: 32,
    borderRadius: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    maxWidth: 400,
  },
  fallbackIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fallbackTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    marginTop: 16,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  fallbackActions: {
    width: '100%',
    gap: 12,
    marginTop: 32,
  },
  galleryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
  },
  galleryActionBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 24,
    width: '100%',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  secondaryActionBtn: {
    marginTop: 12,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
  },
  secondaryActionBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  processingTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    marginTop: 24,
    textAlign: 'center',
  },
  processingSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.6,
  },
  modalHeader: {
    paddingBottom: 20,
  },
  modalHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.6,
  },
  summaryContainer: {
    gap: 16,
  },
  modernSummaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  modernSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandInfo: {
    flex: 1,
    gap: 2,
  },
  brandName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  brandCategory: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  modernDivider: {
    height: 1,
    marginVertical: 16,
  },
  modernSummaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modernGridItem: {
    gap: 4,
  },
  modernGridLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  modernGridValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  modernEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 14,
    borderStyle: 'dashed',
  },
  modernEditBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  editScroll: {
    maxHeight: 400,
  },
  editingForm: {
    gap: 16,
  },
  formSection: {
    gap: 12,
  },
  formSectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1,
  },
  formGroup: {
    gap: 6,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  formInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  doneEditingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  doneEditingText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  confirmBtn: { flex: 1.5, height: 54, borderRadius: 16, overflow: 'hidden' },
  confirmGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 15 },
  processingWrap: {
    flex: 1,
    paddingTop: 0,
  },
  processingImgWrap: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#1e1e2e',
  },
  processingImg: {
    width: '100%',
    height: '100%',
  },
  processingImgOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  processingImgLabel: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    opacity: 0.95,
  },
  stepsCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    flex: 1,
  },
  processingHeading: { fontFamily: 'Inter_700Bold', fontSize: 22, textAlign: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, position: 'relative' },
  stepConnector: { position: 'absolute', left: 16, top: -16, width: 2, height: 16 },
  stepDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  stepTextWrap: { flex: 1, paddingTop: 6 },
  stepLabel: { fontSize: 15, marginBottom: 2 },
  stepSub: { fontFamily: 'Inter_400Regular', fontSize: 12, opacity: 0.7 },
  processingTip: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 24, opacity: 0.5 },
  resultScroll: { paddingBottom: 24 },
  aiBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  aiBannerText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flex: 1 },
  fieldGroup: { marginBottom: 18 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.8, marginBottom: 6 },
  fieldInput: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Inter_400Regular', fontSize: 16 },
  amountInput: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  fieldHint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#EF4444', marginTop: 4 },
  dateInput: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateText: { fontFamily: 'Inter_400Regular', fontSize: 15, flex: 1 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  categoryChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, textTransform: 'capitalize' },
  resultFooter: { flexDirection: 'row', gap: 12, paddingTop: 14, paddingBottom: 8, borderTopWidth: 1 },
  resultDiscardBtn: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  resultDiscardText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  resultSaveBtn: { flex: 2, height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  resultSaveText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16 },
});
