import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, Platform, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/query-client';

const PERMISSIONS = [
  { key: 'view', label: 'View Only', desc: 'Can see reminders and health data', icon: 'eye-outline', color: '#3B82F6' },
  { key: 'edit', label: 'Can Edit', desc: 'Can mark reminders done and snooze', icon: 'create-outline', color: '#10B981' },
  { key: 'full', label: 'Full Access', desc: 'All access including adding data', icon: 'shield-checkmark-outline', color: '#8B5CF6' },
];

export default function CaregiversScreen() {
  const { memberId, memberName } = useLocalSearchParams<{ memberId: string; memberName: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { token } = useAuth();

  const [caregivers, setCaregivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [permission, setPermission] = useState('view');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCaregivers = useCallback(async () => {
    if (!token || !memberId) return;
    setLoading(true);
    try {
      const r = await apiRequest('GET', `/api/family/${memberId}/caregivers`, undefined, token);
      setCaregivers(await r.json());
    } catch {} finally { setLoading(false); }
  }, [token, memberId]);


  useFocusEffect(useCallback(() => { loadCaregivers(); }, [loadCaregivers]));

  const handleAdd = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!token || !memberId) return;
    setSaving(true); setError('');
    try {
      const res = await apiRequest('POST', `/api/family/${memberId}/caregivers`, { name: name.trim(), email: email.trim(), phone: phone.trim(), permission }, token);
      if (res.ok) {
        setName(''); setEmail(''); setPhone(''); setPermission('view');
        setShowAddForm(false);
        await loadCaregivers();
        Alert.alert('Success', `Caregiver added successfully!\n\nAn invitation email & SMS has been sent to ${name} with their access portal link.`);
      } else { setError('Failed to add caregiver.'); }
    } catch { setError('Unexpected error.'); }
    finally { setSaving(false); }
  };

  const handleRemove = (cg: any) => {
    Alert.alert(
      'Remove Caregiver',
      `Remove ${cg.name} as a caregiver? They will immediately lose access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest('DELETE', `/api/family/${memberId}/caregivers/${cg.id}`, undefined, token!);
              await loadCaregivers();
            } catch {}
          },
        },
      ]
    );
  };

  const permColor = (p: string) => PERMISSIONS.find(x => x.key === p)?.color || colors.accent;
  const permLabel = (p: string) => PERMISSIONS.find(x => x.key === p)?.label || p;

  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      <LinearGradient colors={colors.heroGradient as any} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={15}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: colors.text }]}>Caregivers</Text>
            {memberName ? <Text style={[s.headerSub, { color: colors.textSecondary }]}>{memberName}</Text> : null}
          </View>
          <Pressable onPress={() => setShowAddForm(v => !v)} style={[s.addIconBtn, { backgroundColor: colors.accentDim }]}>
            <Ionicons name={showAddForm ? 'close' : 'add'} size={22} color={colors.accent} />
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}>
        {/* Add Form */}
        {showAddForm && (
          <Animated.View entering={FadeInDown.duration(350)}>
            <View style={[s.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.addTitle, { color: colors.text }]}>Add Caregiver</Text>

              <Text style={[s.label, { color: colors.textSecondary }]}>NAME *</Text>
              <View style={[s.inputRow, { borderColor: colors.border }]}>
                <Ionicons name="person-outline" size={16} color={colors.textTertiary} />
                <TextInput style={[s.input, { color: colors.text }]} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.textTertiary} autoFocus />
              </View>

              <Text style={[s.label, { color: colors.textSecondary }]}>EMAIL</Text>
              <View style={[s.inputRow, { borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={16} color={colors.textTertiary} />
                <TextInput style={[s.input, { color: colors.text }]} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={colors.textTertiary} keyboardType="email-address" autoCapitalize="none" />
              </View>

              <Text style={[s.label, { color: colors.textSecondary }]}>PHONE</Text>
              <View style={[s.inputRow, { borderColor: colors.border }]}>
                <Ionicons name="call-outline" size={16} color={colors.textTertiary} />
                <TextInput style={[s.input, { color: colors.text }]} value={phone} onChangeText={setPhone} placeholder="+91 00000 00000" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" />
              </View>

              <Text style={[s.label, { color: colors.textSecondary }]}>PERMISSION LEVEL</Text>
              {PERMISSIONS.map(p => (
                <Pressable key={p.key} onPress={() => setPermission(p.key)}
                  style={[s.permRow, { borderColor: permission === p.key ? p.color : colors.border, backgroundColor: permission === p.key ? p.color + '12' : colors.bg }]}>
                  <View style={[s.permIcon, { backgroundColor: p.color + '18' }]}>
                    <Ionicons name={p.icon as any} size={16} color={p.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.permLabel, { color: permission === p.key ? p.color : colors.text }]}>{p.label}</Text>
                    <Text style={[s.permDesc, { color: colors.textTertiary }]}>{p.desc}</Text>
                  </View>
                  {permission === p.key && <Ionicons name="checkmark-circle" size={18} color={p.color} />}
                </Pressable>
              ))}

              {!!error && <Text style={[s.errText, { color: colors.danger }]}>{error}</Text>}

              <Pressable onPress={handleAdd} disabled={saving} style={s.saveBtn}>
                <LinearGradient colors={colors.buttonGradient as any} style={s.saveBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {saving ? <ActivityIndicator size="small" color="#FFF" /> : (
                    <><Ionicons name="person-add-outline" size={18} color="#FFF" /><Text style={s.saveBtnText}>Add Caregiver</Text></>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Info Card */}
        <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
          <Text style={[s.infoText, { color: colors.textSecondary }]}>
            Caregivers receive reminder alerts and can manage health data based on their permission level.
          </Text>
        </View>

        {/* List */}
        {loading ? (
          <View style={s.center}><ActivityIndicator color={colors.accent} /></View>
        ) : caregivers.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>No caregivers yet</Text>
            <Text style={[s.emptySub, { color: colors.textSecondary }]}>Add a caregiver to share access</Text>
          </View>
        ) : (
          caregivers.map((cg, i) => (
            <Animated.View key={cg.id || i} entering={FadeInDown.delay(i * 60).duration(380)}>
              <View style={[s.cgCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.cgAvatar, { backgroundColor: permColor(cg.permission) + '18' }]}>
                  <Ionicons name="person" size={20} color={permColor(cg.permission)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cgName, { color: colors.text }]}>{cg.name}</Text>
                  {cg.email ? <Text style={[s.cgMeta, { color: colors.textTertiary }]}>{cg.email}</Text> : null}
                  {cg.phone ? <Text style={[s.cgMeta, { color: colors.textTertiary }]}>{cg.phone}</Text> : null}
                  <View style={[s.permBadge, { backgroundColor: permColor(cg.permission) + '18' }]}>
                    <Text style={[s.permBadgeText, { color: permColor(cg.permission) }]}>{permLabel(cg.permission)}</Text>
                  </View>
                </View>
                <Pressable onPress={() => handleRemove(cg)} style={[s.removeBtn, { backgroundColor: colors.dangerDim }]}>
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                </Pressable>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  addIconBtn: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  addCard: { borderRadius: 22, borderWidth: 1, padding: 18, marginBottom: 14 },
  addTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 14 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 12, gap: 9, marginBottom: 2 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15 },
  permRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8, gap: 10 },
  permIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  permLabel: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  permDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  errText: { fontFamily: 'Inter_500Medium', fontSize: 13, marginVertical: 8 },
  saveBtn: { height: 52, borderRadius: 15, overflow: 'hidden', marginTop: 14 },
  saveBtnInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 16 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
  infoText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  center: { padding: 40, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  cgCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10, gap: 12 },
  cgAvatar: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cgName: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  cgMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  permBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 5 },
  permBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  removeBtn: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
