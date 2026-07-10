import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Avatar } from '../components/Avatar';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, getApiUrl } from '@/lib/query-client';

const ALL_MODULES = [
  { key: 'medicine',     label: 'Medicine Tracking',        icon: 'medkit',           color: '#EF4444' },
  { key: 'doctor',       label: 'Doctor Appointments',      icon: 'medical',           color: '#3B82F6' },
  { key: 'health',       label: 'Health Monitoring',        icon: 'heart',             color: '#EC4899' },
  { key: 'sos',          label: 'Emergency SOS',            icon: 'warning',           color: '#F59E0B' },
  { key: 'bills',        label: 'Bill Management',          icon: 'receipt',           color: '#F97316' },
  { key: 'insurance',    label: 'Insurance Management',     icon: 'shield-checkmark',  color: '#10B981' },
  { key: 'subscription', label: 'Subscription Tracking',   icon: 'refresh-circle',    color: '#8B5CF6' },
  { key: 'expense',      label: 'Expense Tracking',         icon: 'wallet',            color: '#06B6D4' },
  { key: 'routine',      label: 'Daily Routine',            icon: 'sunny',             color: '#FBBF24' },
  { key: 'checkin',      label: 'Call & Check-in',          icon: 'call',              color: '#34D399' },
  { key: 'travel',       label: 'Travel & Visits',          icon: 'airplane',          color: '#60A5FA' },
  { key: 'diet',         label: 'Diet & Meal Planning',     icon: 'restaurant',        color: '#A78BFA' },
  { key: 'stock',        label: 'Medicine Stock Tracker',   icon: 'cube',              color: '#FB7185' },
  { key: 'documents',    label: 'Important Documents',      icon: 'document-text',     color: '#4ADE80' },
  { key: 'fitness',      label: 'Fitness Tracking',         icon: 'fitness',           color: '#F472B6' },
  { key: 'study',        label: 'Study & Education',        icon: 'school',            color: '#38BDF8' },
  { key: 'mental',       label: 'Mental Health & Wellness', icon: 'happy',             color: '#C084FC' },
  { key: 'vehicle',      label: 'Vehicle Management',       icon: 'car',               color: '#FB923C' },
  { key: 'home',         label: 'Home Maintenance',         icon: 'home',              color: '#2DD4BF' },
  { key: 'custom',       label: 'Custom Module',            icon: 'create',            color: '#94A3B8' },
];

const RELATIONSHIPS = [
  { key: 'self',    label: 'Self',    icon: 'person' },
  { key: 'papa',    label: 'Papa',    icon: 'man' },
  { key: 'mummy',   label: 'Mummy',   icon: 'woman' },
  { key: 'spouse',  label: 'Spouse',  icon: 'heart' },
  { key: 'child',   label: 'Child',   icon: 'happy' },
  { key: 'sibling', label: 'Sibling', icon: 'people-circle' },
  { key: 'parent',  label: 'Parent',  icon: 'people' },
  { key: 'other',   label: 'Other',   icon: 'ellipsis-horizontal' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const STEPS = ['Basic Info', 'Modules', 'Details'];

export default function AddFamilyMemberScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { token } = useAuth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('other');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dobDate, setDobDate] = useState(new Date(2000, 0, 1));
  const [bloodGroup, setBloodGroup] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>(['medicine', 'bills']);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleModule = (key: string) => {
    setSelectedModules(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (!result.canceled && result.assets[0].uri) uploadImage(result.assets[0].uri);
    } catch (e) { setError('Failed to pick image'); }
  };

  const uploadImage = async (uri: string) => {
    setAvatarUrl(uri);
    if (!token) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      formData.append('file', { uri, name: filename, type: match ? `image/${match[1]}` : 'image/jpeg' } as any);
      const res = await fetch(`${getApiUrl()}/api/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (res.ok) { const d = await res.json(); setAvatarUrl(d.url); }
    } catch (e) { /* keep local uri */ } finally { setIsUploading(false); }
  };

  const handleNext = () => {
    if (step === 0) {
      if (!name.trim()) { setError('Please enter a name'); return; }
    }
    if (step === 1) {
      if (selectedModules.length === 0) { setError('Select at least 1 module'); return; }
    }
    setError('');
    if (step < 2) setStep(s => s + 1);
  };

  const handleSave = async () => {
    if (!token) return;
    setIsSaving(true);
    setError('');
    try {
      const features: Record<string, boolean> = {};
      selectedModules.forEach(k => { features[k] = true; });
      await apiRequest('POST', '/api/family', {
        name: name.trim(), relationship, avatarUrl, dateOfBirth,
        bloodGroup, phone, modules: selectedModules, features,
      }, token);
      router.back();
    } catch (e) { setError('Failed to add member. Please try again.'); }
    finally { setIsSaving(false); }
  };

  const ac = colors.accent;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <LinearGradient colors={colors.heroGradient as any} style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => step > 0 ? setStep(s => s - 1) : router.back()} style={styles.backBtn} hitSlop={15}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Add Family Member</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Step Indicator */}
          <View style={styles.stepRow}>
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepDot, { backgroundColor: i <= step ? ac : colors.border }]}>
                    {i < step
                      ? <Ionicons name="checkmark" size={12} color="#FFF" />
                      : <Text style={[styles.stepNum, { color: i === step ? '#FFF' : colors.textTertiary }]}>{i + 1}</Text>
                    }
                  </View>
                  <Text style={[styles.stepLabel, { color: i === step ? ac : colors.textTertiary }]}>{s}</Text>
                </View>
                {i < STEPS.length - 1 && (
                  <View style={[styles.stepLine, { backgroundColor: i < step ? ac : colors.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </LinearGradient>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerDim }]}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          ) : null}

          {/* ─── STEP 0: Basic Info ─── */}
          {step === 0 && (
            <Animated.View entering={FadeInRight.duration(350)}>
              {/* Avatar */}
              <View style={styles.avatarCenter}>
                <Pressable onPress={pickImage} style={styles.avatarWrap}>
                  <Avatar name={name || 'New'} uri={avatarUrl} size={90} />
                  <View style={[styles.camBtn, { backgroundColor: ac }]}>
                    <Ionicons name="camera" size={16} color="#FFF" />
                  </View>
                  {isUploading && (
                    <View style={styles.uploadOverlay}>
                      <Ionicons name="cloud-upload-outline" size={22} color="#FFF" />
                    </View>
                  )}
                </Pressable>
                <Text style={[styles.avatarHint, { color: colors.textTertiary }]}>Tap to add photo</Text>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>FULL NAME *</Text>
              <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Ionicons name="person-outline" size={18} color={colors.textTertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={name} onChangeText={setName}
                  placeholder="Enter full name" placeholderTextColor={colors.textTertiary}
                  autoFocus
                />
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>PHONE NUMBER</Text>
              <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Ionicons name="call-outline" size={18} color={colors.textTertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={phone} onChangeText={setPhone}
                  placeholder="+91 00000 00000" placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                />
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>RELATIONSHIP *</Text>
              <View style={styles.relGrid}>
                {RELATIONSHIPS.map(rel => {
                  const active = relationship === rel.key;
                  return (
                    <Pressable
                      key={rel.key}
                      onPress={() => setRelationship(rel.key)}
                      style={[styles.relCard, { borderColor: active ? ac : colors.border, backgroundColor: active ? colors.accentDim : colors.card }]}
                    >
                      <Ionicons name={rel.icon as any} size={22} color={active ? ac : colors.textTertiary} />
                      <Text style={[styles.relLabel, { color: active ? ac : colors.textSecondary }]}>{rel.label}</Text>
                      {active && (
                        <View style={[styles.checkBadge, { backgroundColor: ac }]}>
                          <Ionicons name="checkmark" size={10} color="#FFF" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>DATE OF BIRTH</Text>
              {Platform.OS === 'web' ? (
                <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />
                  {React.createElement('input', {
                    type: 'date',
                    value: dateOfBirth,
                    max: new Date().toISOString().split('T')[0],
                    onChange: (e: any) => {
                      setDateOfBirth(e.target.value);
                      if (e.target.value) setDobDate(new Date(e.target.value));
                    },
                    style: {
                      flex: 1,
                      fontFamily: 'Inter_400Regular',
                      fontSize: '15px',
                      border: 'none',
                      background: 'transparent',
                      color: dateOfBirth ? colors.text : colors.textTertiary,
                      outline: 'none',
                      padding: '8px 0',
                      width: '100%',
                      cursor: 'pointer'
                    }
                  })}
                </View>
              ) : (
                <>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card }]}
                  >
                    <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />
                    <Text style={{ flex: 1, color: dateOfBirth ? colors.text : colors.textTertiary, fontFamily: 'Inter_500Medium' }}>
                      {dateOfBirth || 'Select Birthday'}
                    </Text>
                  </Pressable>
                  {Platform.OS === 'ios' && showDatePicker && (
                    <View style={{ backgroundColor: colors.card, borderRadius: 14, marginTop: 10, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
                        <Pressable onPress={() => setShowDatePicker(false)}>
                          <Text style={{ color: colors.accent, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Done</Text>
                        </Pressable>
                      </View>
                      <DateTimePicker
                        value={dobDate} mode="date" display="inline"
                        maximumDate={new Date()} themeVariant={isDark ? 'dark' : 'light'}
                        onChange={(_, date) => {
                          if (date) { setDobDate(date); setDateOfBirth(date.toISOString().split('T')[0]); }
                        }}
                      />
                    </View>
                  )}
                  {Platform.OS === 'android' && showDatePicker && (
                    <DateTimePicker
                      value={dobDate} mode="date" display="default"
                      maximumDate={new Date()} themeVariant={isDark ? 'dark' : 'light'}
                      onChange={(_, date) => {
                        setShowDatePicker(false);
                        if (date) { setDobDate(date); setDateOfBirth(date.toISOString().split('T')[0]); }
                      }}
                    />
                  )}
                </>
              )}

              <Text style={[styles.label, { color: colors.textSecondary }]}>BLOOD GROUP</Text>
              <View style={styles.bloodRow}>
                {BLOOD_GROUPS.map(bg => (
                  <Pressable
                    key={bg}
                    onPress={() => setBloodGroup(prev => prev === bg ? '' : bg)}
                    style={[styles.bloodChip, { borderColor: bloodGroup === bg ? ac : colors.border, backgroundColor: bloodGroup === bg ? colors.accentDim : colors.card }]}
                  >
                    <Text style={[styles.bloodText, { color: bloodGroup === bg ? ac : colors.textSecondary }]}>{bg}</Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          )}

          {/* ─── STEP 1: Select Modules ─── */}
          {step === 1 && (
            <Animated.View entering={FadeInRight.duration(350)}>
              <View style={styles.modulesHeader}>
                <Text style={[styles.modulesTitle, { color: colors.text }]}>Choose Modules</Text>
                <Text style={[styles.modulesSubtitle, { color: colors.textSecondary }]}>
                  Select features to enable for {name}. Min 1 required.
                </Text>
                <View style={[styles.selectedBadge, { backgroundColor: colors.accentDim }]}>
                  <Text style={[styles.selectedBadgeText, { color: ac }]}>{selectedModules.length} selected</Text>
                </View>
              </View>

              <View style={styles.modulesGrid}>
                {ALL_MODULES.map((mod, idx) => {
                  const selected = selectedModules.includes(mod.key);
                  return (
                    <Animated.View key={mod.key} entering={FadeInDown.delay(idx * 30).duration(300)}>
                      <Pressable
                        onPress={() => toggleModule(mod.key)}
                        style={[
                          styles.moduleCard,
                          { borderColor: selected ? mod.color + '60' : colors.border, backgroundColor: selected ? mod.color + '12' : colors.card },
                        ]}
                      >
                        <View style={[styles.moduleIconWrap, { backgroundColor: mod.color + '20' }]}>
                          <Ionicons name={mod.icon as any} size={20} color={mod.color} />
                        </View>
                        <Text style={[styles.moduleLabel, { color: selected ? colors.text : colors.textSecondary }]} numberOfLines={2}>
                          {mod.label}
                        </Text>
                        {selected && (
                          <View style={[styles.moduleCheck, { backgroundColor: mod.color }]}>
                            <Ionicons name="checkmark" size={11} color="#FFF" />
                          </View>
                        )}
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* ─── STEP 2: Details / Confirm ─── */}
          {step === 2 && (
            <Animated.View entering={FadeInRight.duration(350)}>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryCardInner, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Avatar name={name} uri={avatarUrl} size={64} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.summaryName, { color: colors.text }]}>{name}</Text>
                    <Text style={[styles.summaryRel, { color: colors.textSecondary }]}>
                      {RELATIONSHIPS.find(r => r.key === relationship)?.label} · {bloodGroup || 'No blood group'}
                    </Text>
                    {phone ? <Text style={[styles.summaryPhone, { color: colors.textTertiary }]}>{phone}</Text> : null}
                    {dateOfBirth ? <Text style={[styles.summaryPhone, { color: colors.textTertiary }]}>DOB: {dateOfBirth}</Text> : null}
                  </View>
                </View>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>SELECTED MODULES ({selectedModules.length})</Text>
              <View style={styles.moduleSummaryGrid}>
                {selectedModules.map(mKey => {
                  const mod = ALL_MODULES.find(m => m.key === mKey);
                  if (!mod) return null;
                  return (
                    <View key={mKey} style={[styles.modSummaryChip, { backgroundColor: mod.color + '15', borderColor: mod.color + '40' }]}>
                      <Ionicons name={mod.icon as any} size={13} color={mod.color} />
                      <Text style={[styles.modSummaryText, { color: mod.color }]} numberOfLines={1}>{mod.label}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={[styles.infoCard, { backgroundColor: colors.accentDim + '30', borderColor: ac + '30' }]}>
                <Ionicons name="information-circle-outline" size={18} color={ac} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  You can always add, remove or change modules later from the member dashboard.
                </Text>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: colors.bg, paddingBottom: Math.max(insets.bottom, 16) + 4, borderTopColor: colors.border }]}>
          {step < 2 ? (
            <Pressable onPress={handleNext} style={styles.nextBtn}>
              <LinearGradient colors={colors.buttonGradient as any} style={styles.nextBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable onPress={handleSave} disabled={isSaving} style={styles.nextBtn}>
              <LinearGradient colors={colors.buttonGradient as any} style={styles.nextBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="person-add-outline" size={20} color="#FFF" />
                <Text style={styles.nextBtnText}>{isSaving ? 'Adding Member...' : 'Add Family Member'}</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, marginBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  stepLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8, borderRadius: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: 16 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  avatarCenter: { alignItems: 'center', marginBottom: 24 },
  avatarWrap: { position: 'relative', padding: 2 },
  camBtn: { position: 'absolute', bottom: -2, right: -2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  avatarHint: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 8 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, gap: 10, marginBottom: 2 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15 },
  relGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  relCard: { width: '22%', flexGrow: 1, borderRadius: 16, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center', gap: 6, position: 'relative', minWidth: 70 },
  relLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  checkBadge: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  bloodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bloodChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  bloodText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  modulesHeader: { marginBottom: 20, gap: 6 },
  modulesTitle: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  modulesSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  selectedBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, marginTop: 4 },
  selectedBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  modulesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moduleCard: { width: '47%', flexGrow: 1, borderRadius: 18, borderWidth: 1.5, padding: 14, gap: 8, position: 'relative', minWidth: 140 },
  moduleIconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  moduleLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 17 },
  moduleCheck: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { marginBottom: 20 },
  summaryCardInner: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, padding: 16, gap: 14 },
  summaryName: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  summaryRel: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 3 },
  summaryPhone: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  moduleSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  modSummaryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  modSummaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  infoCard: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  infoText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  nextBtn: { height: 58, borderRadius: 18, overflow: 'hidden' },
  nextBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  nextBtnText: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 17 },
});
