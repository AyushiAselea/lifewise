import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/query-client';

const VITALS = [
  { key: 'Blood Pressure', icon: 'heart', color: '#EF4444', unit: 'mmHg', placeholder: '120/80' },
  { key: 'Blood Sugar', icon: 'water', color: '#3B82F6', unit: 'mg/dL', placeholder: '95' },
  { key: 'Weight', icon: 'fitness', color: '#10B981', unit: 'kg', placeholder: '68.5' },
  { key: 'Oxygen (SpO2)', icon: 'pulse', color: '#8B5CF6', unit: '%', placeholder: '98' },
  { key: 'Heart Rate', icon: 'heart-circle', color: '#F59E0B', unit: 'bpm', placeholder: '72' },
  { key: 'Temperature', icon: 'thermometer', color: '#F97316', unit: '°C', placeholder: '36.8' },
];

export default function HealthMonitoringScreen() {
  const { memberId, memberName, type: defaultType } = useLocalSearchParams<{ memberId: string; memberName: string; type?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { token } = useAuth();

  const [selectedType, setSelectedType] = useState(defaultType || VITALS[0].key);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = useCallback(async () => {
    if (!token || !memberId) return;
    try {
      const r = await apiRequest('GET', `/api/family/${memberId}/health`, undefined, token);
      setHistory(await r.json());
    } catch {}
  }, [token, memberId]);


  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  const vital = VITALS.find(v => v.key === selectedType) || VITALS[0];

  const handleSave = async () => {
    if (!value.trim()) { setError('Please enter a value'); return; }
    if (!token || !memberId) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await apiRequest('POST', `/api/family/${memberId}/health`, {
        type: selectedType, value: value.trim(), unit: vital.unit, notes,
      }, token);
      if (res.ok) {
        setSuccess('Saved!'); setValue(''); setNotes('');
        await loadHistory();
        setTimeout(() => setSuccess(''), 2500);
      } else { setError('Failed to save.'); }
    } catch { setError('Unexpected error.'); }
    finally { setSaving(false); }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <LinearGradient colors={colors.heroGradient as any} style={[s.header, { paddingTop: insets.top + 8 }]}>
          <View style={s.headerRow}>
            <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={15}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[s.headerTitle, { color: colors.text }]}>Health Monitoring</Text>
              {memberName ? <Text style={[s.headerSub, { color: colors.textSecondary }]}>{memberName}</Text> : null}
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeScroll}>
            {VITALS.map(v => {
              const active = selectedType === v.key;
              return (
                <Pressable key={v.key} onPress={() => setSelectedType(v.key)}
                  style={[s.typeChip, { borderColor: active ? v.color : colors.border, backgroundColor: active ? v.color + '18' : colors.card }]}>
                  <Ionicons name={v.icon as any} size={13} color={active ? v.color : colors.textTertiary} />
                  <Text style={[s.typeText, { color: active ? v.color : colors.textTertiary }]} numberOfLines={1}>{v.key}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </LinearGradient>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}>
          <View style={[s.logCard, { backgroundColor: colors.card, borderColor: vital.color + '40' }]}>
            <View style={s.logTop}>
              <View style={[s.logIcon, { backgroundColor: vital.color + '18' }]}>
                <Ionicons name={vital.icon as any} size={22} color={vital.color} />
              </View>
              <Text style={[s.logTitle, { color: colors.text }]}>{vital.key}</Text>
            </View>

            <View style={[s.valueRow, { borderColor: colors.border }]}>
              <TextInput
                style={[s.valueInput, { color: vital.color }]}
                value={value} onChangeText={setValue}
                placeholder={vital.placeholder} placeholderTextColor={colors.textTertiary}
                keyboardType={vital.key === 'Blood Pressure' ? 'default' : 'decimal-pad'}
                autoFocus
              />
              <View style={[s.unitBadge, { backgroundColor: vital.color + '18' }]}>
                <Text style={[s.unitText, { color: vital.color }]}>{vital.unit}</Text>
              </View>
            </View>

            <TextInput
              style={[s.notesInput, { borderColor: colors.border, color: colors.text }]}
              value={notes} onChangeText={setNotes}
              placeholder="Notes (optional)" placeholderTextColor={colors.textTertiary}
              multiline numberOfLines={2}
            />

            {!!error && <Text style={[s.errText, { color: colors.danger }]}>{error}</Text>}
            {!!success && <Text style={[s.okText, { color: '#10B981' }]}>✓ {success}</Text>}

            <Pressable onPress={handleSave} disabled={saving} style={s.saveBtn}>
              <LinearGradient colors={colors.buttonGradient as any} style={s.saveBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : (
                  <><Ionicons name="save-outline" size={18} color="#FFF" /><Text style={s.saveBtnText}>Save Reading</Text></>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          {history.filter(h => h.type === selectedType).length > 0 && (
            <>
              <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>HISTORY</Text>
              {history.filter(h => h.type === selectedType).slice(0, 10).map((item, i) => (
                <Animated.View key={item.id || i} entering={FadeInDown.delay(i * 40).duration(350)}>
                  <View style={[s.historyRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[s.histDot, { backgroundColor: vital.color + '18' }]}>
                      <Ionicons name={vital.icon as any} size={14} color={vital.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.histValue, { color: colors.text }]}>{item.value} <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{item.unit}</Text></Text>
                      {item.notes ? <Text style={[s.histNotes, { color: colors.textTertiary }]}>{item.notes}</Text> : null}
                    </View>
                    <Text style={[s.histDate, { color: colors.textTertiary }]}>
                      {new Date(item.date || item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </Animated.View>
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  typeScroll: { gap: 10, paddingBottom: 16, paddingRight: 20 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5 },
  typeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  scroll: { padding: 20 },
  logCard: { borderRadius: 24, borderWidth: 1, padding: 22, marginBottom: 24 },
  logTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  logIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  valueRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, marginBottom: 16 },
  valueInput: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 32, paddingVertical: 16 },
  unitBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  unitText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  notesInput: { borderRadius: 14, borderWidth: 1, padding: 16, fontFamily: 'Inter_400Regular', fontSize: 15, marginBottom: 16, minHeight: 70, textAlignVertical: 'top' },
  errText: { fontFamily: 'Inter_500Medium', fontSize: 14, marginBottom: 12 },
  okText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 12 },
  saveBtn: { height: 56, borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  saveBtnInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 17 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16 },
  historyRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12, gap: 12 },
  histDot: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  histValue: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  histNotes: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 4, lineHeight: 18 },
  histDate: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});
