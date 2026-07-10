import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { Avatar } from '../components/Avatar';

const ALL_MODULES = [
  { key: 'medicine', label: 'Medicine Tracking', icon: 'medkit', color: '#EF4444' },
  { key: 'doctor', label: 'Doctor Appointments', icon: 'medical', color: '#3B82F6' },
  { key: 'health', label: 'Health Monitoring', icon: 'heart', color: '#EC4899' },
  { key: 'sos', label: 'Emergency SOS', icon: 'warning', color: '#F59E0B' },
  { key: 'bills', label: 'Bill Management', icon: 'receipt', color: '#F97316' },
  { key: 'insurance', label: 'Insurance', icon: 'shield-checkmark', color: '#10B981' },
  { key: 'subscription', label: 'Subscriptions', icon: 'refresh-circle', color: '#8B5CF6' },
  { key: 'expense', label: 'Expense Tracking', icon: 'wallet', color: '#06B6D4' },
  { key: 'routine', label: 'Daily Routine', icon: 'sunny', color: '#FBBF24' },
  { key: 'checkin', label: 'Call & Check-in', icon: 'call', color: '#34D399' },
  { key: 'travel', label: 'Travel & Visits', icon: 'airplane', color: '#60A5FA' },
  { key: 'diet', label: 'Diet & Meal Plan', icon: 'restaurant', color: '#A78BFA' },
  { key: 'stock', label: 'Medicine Stock', icon: 'cube', color: '#FB7185' },
  { key: 'documents', label: 'Documents', icon: 'document-text', color: '#4ADE80' },
  { key: 'fitness', label: 'Fitness', icon: 'fitness', color: '#F472B6' },
  { key: 'study', label: 'Study & Education', icon: 'school', color: '#38BDF8' },
  { key: 'mental', label: 'Mental Health', icon: 'happy', color: '#C084FC' },
  { key: 'vehicle', label: 'Vehicle Mgmt', icon: 'car', color: '#FB923C' },
  { key: 'home', label: 'Home Maintenance', icon: 'home', color: '#2DD4BF' },
  { key: 'custom', label: 'Custom Module', icon: 'create', color: '#94A3B8' },
];

const RELATIONSHIPS = [
  { key: 'self', label: 'Self', icon: 'person' },
  { key: 'spouse', label: 'Spouse', icon: 'heart' },
  { key: 'child', label: 'Child', icon: 'happy' },
  { key: 'papa', label: 'Papa', icon: 'man' },
  { key: 'mummy', label: 'Mummy', icon: 'woman' },
  { key: 'parent', label: 'Parent', icon: 'people' },
  { key: 'sibling', label: 'Sibling', icon: 'people-circle' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

export default function EditFamilyMemberScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { token } = useAuth();

  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('other');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dobDate, setDobDate] = useState(new Date(2000, 0, 1));
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>(['medicine', 'bills']);

  useEffect(() => { fetchMember(); }, [id]);

  const toggleModule = (key: string) =>
    setSelectedModules(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const fetchMember = async () => {
    if (!token || !id) return;
    try {
      const res = await apiRequest('GET', `/api/family/${id}`, undefined, token);
      const member = await res.json();
      setName(member.name);
      setRelationship(member.relationship || 'other');
      setAvatarUrl(member.avatarUrl || null);
      setPhone(member.phone || '');
      setBloodGroup(member.bloodGroup || '');
      if (member.dateOfBirth) { setDateOfBirth(member.dateOfBirth); setDobDate(new Date(member.dateOfBirth)); }
      const mods = Array.isArray(member.modules) && member.modules.length > 0
        ? member.modules
        : Object.keys(member.features || {}).filter(k => member.features[k]);
      setSelectedModules(mods.length > 0 ? mods : ['medicine', 'bills']);
    } catch { setError('Failed to load member data.'); }
    finally { setIsLoading(false); }
  };


  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        uploadImage(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Pick image error:', e);
      setError('Failed to pick image');
    }
  };

  const uploadImage = async (uri: string) => {
    // Show local preview immediately
    setAvatarUrl(uri);
    if (!token) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      formData.append('file', { uri, name: filename, type } as any);

      const apiBase = getApiUrl();
      console.log('[Upload] Uploading to:', `${apiBase}/api/upload`);

      const res = await fetch(`${apiBase}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setAvatarUrl(data.url);
        console.log('[Upload] Success:', data.url);
      } else {
        const text = await res.text();
        console.error('[Upload] Server error:', res.status, text.slice(0, 200));
        if (!res.ok) setError(`Upload failed (${res.status}). Avatar saved locally.`);
      }
    } catch (e) {
      console.error('[Upload] Exception:', e);
      // Keep local URI — don't block user
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }
    if (!token || !id) return;

    setIsSaving(true);
    try {
      const features: Record<string, boolean> = {};
      selectedModules.forEach(k => { features[k] = true; });
      await apiRequest(
        'PUT',
        `/api/family/${id}`,
        { name: name.trim(), relationship, avatarUrl, dateOfBirth, phone, bloodGroup, modules: selectedModules, features },
        token
      );
      router.back();
    } catch (e) {
      console.error('Update family member error:', e);
      setError('Failed to update member. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const headerHeight = 130 + insets.top;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        >
          {/* Header */}
          <LinearGradient
            colors={colors.heroGradient as any}
            style={[styles.header, { height: headerHeight, paddingTop: insets.top + 8 }]}
          >
            <View style={styles.headerTop}>
              <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={15}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Member</Text>
            </View>

            <View style={styles.headerContent}>
              <View style={styles.avatarSection}>
                <Pressable onPress={pickImage} style={styles.avatarContainer}>
                  <Avatar name={name || 'Member'} uri={avatarUrl} size={88} />
                  <View style={[styles.editIconBtn, { backgroundColor: colors.accent }]}>
                    <Ionicons name="camera" size={16} color="#FFF" />
                  </View>
                  {isUploading && (
                    <View style={styles.uploadOverlay}>
                      <Text style={styles.uploadText}>...</Text>
                    </View>
                  )}
                </Pressable>
              </View>

              <View style={styles.headerNameBlock}>
                <Text style={[styles.contextLabel, { color: colors.textSecondary }]}>Member Name</Text>
                <TextInput
                  style={[styles.nameInput, { color: colors.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter Name"
                  placeholderTextColor={colors.textTertiary}
                />
                <View style={[styles.nameUnderline, { backgroundColor: colors.accent }]} />
              </View>
            </View>
          </LinearGradient>

          <View style={styles.form}>
            {error ? (
              <Animated.View entering={FadeInDown} style={[styles.errorBox, { backgroundColor: colors.dangerDim }]}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </Animated.View>
            ) : null}

            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DATE OF BIRTH</Text>
            {Platform.OS === 'web' ? (
              <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card, marginBottom: 24 }]}>
                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
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
                  style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card, marginBottom: showDatePicker && Platform.OS === 'ios' ? 8 : 24 }]}
                >
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <Text style={{ flex: 1, color: dateOfBirth ? colors.text : colors.textTertiary, fontFamily: 'Inter_500Medium' }}>
                    {dateOfBirth || "Select Birthday"}
                  </Text>
                </Pressable>

                {Platform.OS === 'ios' && showDatePicker && (
                  <View style={{ backgroundColor: colors.card, borderRadius: 14, marginBottom: 24, padding: 12, borderWidth: 1, borderColor: colors.border }}>
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

            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MODULES ({selectedModules.length} selected)</Text>
            <View style={styles.modulesGrid}>
              {ALL_MODULES.map(mod => {
                const selected = selectedModules.includes(mod.key);
                return (
                  <Pressable
                    key={mod.key}
                    onPress={() => toggleModule(mod.key)}
                    style={[
                      styles.moduleCard,
                      { borderColor: selected ? mod.color + '60' : colors.border, backgroundColor: selected ? mod.color + '12' : colors.card },
                    ]}
                  >
                    <View style={[styles.moduleIconWrap, { backgroundColor: mod.color + '20' }]}>
                      <Ionicons name={mod.icon as any} size={18} color={mod.color} />
                    </View>
                    <Text style={[styles.moduleLabel, { color: selected ? colors.text : colors.textSecondary }]} numberOfLines={2}>{mod.label}</Text>
                    {selected && (
                      <View style={[styles.moduleCheck, { backgroundColor: mod.color }]}>
                        <Ionicons name="checkmark" size={10} color="#FFF" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Footer Save */}
        <View style={[
          styles.footer, 
          { 
            backgroundColor: colors.bg, 
            paddingBottom: Math.max(insets.bottom, 20) + 4,
            borderTopColor: colors.border,
            borderTopWidth: 1,
          }
        ]}>
          <Pressable onPress={handleSave} disabled={isSaving} style={styles.saveBtn}>
            <LinearGradient
              colors={colors.buttonGradient as any}
              style={styles.saveGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="checkmark-outline" size={24} color="#FFF" />
              <Text style={styles.saveBtnText}>{isSaving ? 'Saving Changes...' : 'Save Changes'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 44,
    marginBottom: 8,
  },
  backBtn: {
    position: 'absolute',
    left: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    textAlign: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 16,
  },
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'relative',
    padding: 2,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  editIconBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    color: '#FFF',
    fontFamily: 'Inter_700Bold',
  },
  headerNameBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  contextLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    marginBottom: 2,
    opacity: 0.9,
  },
  nameInput: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    paddingVertical: 4,
    letterSpacing: -0.5,
  },
  nameUnderline: {
    height: 3,
    width: 60,
    borderRadius: 2,
    marginTop: 2,
  },
  form: {
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    marginLeft: 8,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    marginBottom: 16,
    marginTop: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  relGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  relCard: {
    width: '48%',
    borderRadius: 24,
    borderWidth: 1.5,
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
    position: 'relative',
  },
  relLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  checkWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  saveBtn: {
    height: 62,
    borderRadius: 20,
    overflow: 'hidden',
  },
  saveGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveBtnText: {
    color: '#FFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
    opacity: 0.3,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  moduleCard: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    gap: 7,
    position: 'relative',
    minWidth: 130,
  },
  moduleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
  },
  moduleCheck: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

