import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/query-client';
import { useSeniorMode } from '@/lib/senior-context';
import { useAlert } from '@/lib/alert-context';
import { useTabBarContentInset } from '@/lib/tab-bar';
import { Avatar } from '@/components/Avatar';

export const ALL_MODULES = [
  { key: 'medicine',     label: 'Medicine Tracking',       icon: 'medkit',             color: '#EF4444' },
  { key: 'doctor',       label: 'Doctor Appointments',     icon: 'medical',             color: '#3B82F6' },
  { key: 'health',       label: 'Health Monitoring',       icon: 'heart',               color: '#EC4899' },
  { key: 'sos',          label: 'Emergency SOS',           icon: 'warning',             color: '#F59E0B' },
  { key: 'bills',        label: 'Bill Management',         icon: 'receipt',             color: '#F97316' },
  { key: 'insurance',    label: 'Insurance Management',    icon: 'shield-checkmark',    color: '#10B981' },
  { key: 'subscription', label: 'Subscription Tracking',  icon: 'refresh-circle',      color: '#8B5CF6' },
  { key: 'expense',      label: 'Expense Tracking',        icon: 'wallet',              color: '#06B6D4' },
  { key: 'routine',      label: 'Daily Routine',           icon: 'sunny',               color: '#FBBF24' },
  { key: 'checkin',      label: 'Call & Check-in',         icon: 'call',                color: '#34D399' },
  { key: 'travel',       label: 'Travel & Visits',         icon: 'airplane',            color: '#60A5FA' },
  { key: 'diet',         label: 'Diet & Meal Planning',    icon: 'restaurant',          color: '#A78BFA' },
  { key: 'stock',        label: 'Medicine Stock Tracker',  icon: 'cube',                color: '#FB7185' },
  { key: 'documents',    label: 'Important Documents',     icon: 'document-text',       color: '#4ADE80' },
  { key: 'fitness',      label: 'Fitness Tracking',        icon: 'fitness',             color: '#F472B6' },
  { key: 'study',        label: 'Study & Education',       icon: 'school',              color: '#38BDF8' },
  { key: 'mental',       label: 'Mental Health & Wellness',icon: 'happy',               color: '#C084FC' },
  { key: 'vehicle',      label: 'Vehicle Management',      icon: 'car',                 color: '#FB923C' },
  { key: 'home',         label: 'Home Maintenance',        icon: 'home',                color: '#2DD4BF' },
  { key: 'custom',       label: 'Custom Module',           icon: 'create',              color: '#94A3B8' },
];

const RELATIONSHIPS = [
  { key: 'self', label: 'Self' },
  { key: 'spouse', label: 'Spouse' },
  { key: 'papa', label: 'Papa' },
  { key: 'mummy', label: 'Mummy' },
  { key: 'parent', label: 'Parent' },
  { key: 'partner', label: 'Partner' },
  { key: 'child', label: 'Child' },
  { key: 'sibling', label: 'Sibling' },
  { key: 'other', label: 'Other' },
];

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  avatarUrl?: string | null;
  dateOfBirth?: string;
  bloodGroup?: string;
  phone?: string;
  modules?: string[];
  caregivers?: { name: string; email?: string; phone?: string; permission: string }[];
  medicines: any[];
  features?: Record<string, boolean>;
}

function ModuleIconRow({ modules, colors }: { modules: string[]; colors: any }) {
  const show = modules.slice(0, 5);
  const extra = modules.length - show.length;
  return (
    <View style={styles.moduleIconRow}>
      {show.map(mKey => {
        const mod = ALL_MODULES.find(m => m.key === mKey);
        if (!mod) return null;
        return (
          <View key={mKey} style={[styles.modIcon, { backgroundColor: mod.color + '18' }]}>
            <Ionicons name={mod.icon as any} size={12} color={mod.color} />
          </View>
        );
      })}
      {extra > 0 && (
        <View style={[styles.modIcon, { backgroundColor: colors.border }]}>
          <Text style={[styles.modExtraText, { color: colors.textTertiary }]}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

function MemberCard({
  member,
  index,
  colors,
  isSeniorMode,
  onDelete,
  onManage,
}: {
  member: FamilyMember;
  index: number;
  colors: any;
  isSeniorMode: boolean;
  onDelete: () => void;
  onManage: () => void;
}) {
  const relLabel = RELATIONSHIPS.find(r => r.key === member.relationship)?.label || member.relationship;
  const modules = member.modules && member.modules.length > 0
    ? member.modules
    : Object.keys(member.features || {}).filter(k => (member.features as any)[k]);
  const medicineCount = member.medicines?.length || 0;
  const caregiverCount = member.caregivers?.length || 0;

  return (
    <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.delay(index * 80).duration(450) : undefined}>
      <Pressable
        onPress={onManage}
        style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {/* Top Row */}
        <View style={styles.memberTop}>
          <Avatar name={member.name} uri={member.avatarUrl} size={isSeniorMode ? 60 : 52} />
          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, { color: colors.text }, isSeniorMode && { fontSize: 20 }]} numberOfLines={1}>
              {member.name}
            </Text>
            <Text style={[styles.memberRel, { color: colors.textTertiary }]}>{relLabel}</Text>
            {member.dateOfBirth ? (
              <Text style={[styles.memberDob, { color: colors.textTertiary }]}>
                DOB: {member.dateOfBirth}
              </Text>
            ) : null}
          </View>
          <View style={styles.memberActions}>
            <Pressable
              onPress={() => router.push({ pathname: '/edit-family-member', params: { id: member.id } })}
              style={[styles.actionBtn, { backgroundColor: colors.accentDim }]}
            >
              <Ionicons name="create-outline" size={16} color={colors.accent} />
            </Pressable>
            <Pressable
              onPress={onDelete}
              style={[styles.actionBtn, { backgroundColor: colors.dangerDim }]}
            >
              <Ionicons name="trash-outline" size={15} color={colors.danger} />
            </Pressable>
          </View>
        </View>

        {/* Module Icons */}
        {modules.length > 0 && (
          <View style={styles.moduleSection}>
            <ModuleIconRow modules={modules} colors={colors} />
            <Text style={[styles.moduleCountText, { color: colors.textTertiary }]}>
              {modules.length} module{modules.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* Stats Row */}
        <View style={[styles.statsRow, { borderTopColor: colors.border + '50' }]}>
          <View style={styles.statItem}>
            <Ionicons name="medkit-outline" size={13} color={colors.accent} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {medicineCount} medicine{medicineCount !== 1 ? 's' : ''}
            </Text>
          </View>
          {caregiverCount > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={13} color={colors.accentMint} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {caregiverCount} caregiver{caregiverCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={onManage}
            style={[styles.manageBtn, { backgroundColor: colors.accentDim }]}
          >
            <Text style={[styles.manageBtnText, { color: colors.accent }]}>Manage</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.accent} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function FamilyTabScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarContentInset();
  const { colors } = useTheme();
  const { token } = useAuth();
  const { isSeniorMode } = useSeniorMode();
  const { showAlert } = useAlert();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await apiRequest('GET', '/api/family', undefined, token);
      const data = await res.json();
      setMembers(Array.isArray(data) ? data as FamilyMember[] : []);
    } catch (e) {
      console.error('Load family error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadMembers(); }, [loadMembers]));

  const deleteMember = (memberId: string, name: string) => {
    showAlert({
      title: 'Remove Member',
      message: `Are you sure you want to remove ${name} from your family hub?`,
      type: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest('DELETE', `/api/family/${memberId}`, undefined, token!);
              setMembers(prev => prev.filter(m => m.id !== memberId));
            } catch (e) { console.error('Delete member error:', e); }
          },
        },
      ],
    });
  };

  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: topInset + 16, paddingBottom: tabBarInset.bottom + 20 }]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.screenTitle, { color: colors.text }]}>Family Hub</Text>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
              {members.length} member{members.length !== 1 ? 's' : ''} · All modules
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/add-family-member')}
            style={[styles.addBtnWrap]}
          >
            <LinearGradient
              colors={colors.buttonGradient as any}
              style={styles.addBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="add" size={22} color="#FFF" />
            </LinearGradient>
          </Pressable>
        </View>

        {/* Quick Module Overview */}
        <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.delay(60).duration(500) : undefined}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moduleScroll}>
            {ALL_MODULES.slice(0, 10).map(mod => (
              <View key={mod.key} style={[styles.quickModChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.quickModIcon, { backgroundColor: mod.color + '18' }]}>
                  <Ionicons name={mod.icon as any} size={14} color={mod.color} />
                </View>
                <Text style={[styles.quickModLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {mod.label.split(' ')[0]}
                </Text>
              </View>
            ))}
            <Pressable
              onPress={() => router.push('/add-family-member')}
              style={[styles.quickModChip, { backgroundColor: colors.accentDim, borderColor: colors.accent + '30' }]}
            >
              <Ionicons name="ellipsis-horizontal" size={14} color={colors.accent} />
              <Text style={[styles.quickModLabel, { color: colors.accent }]}>+10 more</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>

        {/* Members */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : members.length === 0 ? (
          <Animated.View entering={FadeIn} style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.accentDim }]}>
              <Ionicons name="people-outline" size={56} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Start your Family Hub</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Add family members and manage their health, medicines, bills, documents, and more — all in one place.
            </Text>
            <Pressable onPress={() => router.push('/add-family-member')} style={styles.emptyBtn}>
              <LinearGradient colors={colors.buttonGradient as any} style={styles.emptyBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="person-add-outline" size={20} color="#FFF" />
                <Text style={styles.emptyBtnText}>Add First Member</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>FAMILY MEMBERS</Text>
            {members.map((member, idx) => (
              <MemberCard
                key={member.id}
                member={member}
                index={idx}
                colors={colors}
                isSeniorMode={isSeniorMode}
                onDelete={() => deleteMember(member.id, member.name)}
                onManage={() => router.push({ pathname: '/member-dashboard' as any, params: { id: member.id, name: member.name } })}
              />
            ))}
            <Pressable
              onPress={() => router.push('/add-family-member')}
              style={[styles.addMoreBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
              <Text style={[styles.addMoreText, { color: colors.accent }]}>Add Another Member</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  screenTitle: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -0.5 },
  screenSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 4 },
  addBtnWrap: { borderRadius: 14, overflow: 'hidden' },
  addBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  moduleScroll: { gap: 8, paddingBottom: 16, paddingHorizontal: 2 },
  quickModChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickModIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  quickModLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
  },
  loadingWrap: { padding: 60, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
  emptyIconWrap: { width: 110, height: 110, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, marginBottom: 12, textAlign: 'center' },
  emptyDesc: { fontFamily: 'Inter_400Regular', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  emptyBtn: { height: 56, borderRadius: 18, overflow: 'hidden', width: '100%' },
  emptyBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyBtnText: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 16 },
  memberCard: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  memberTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  memberRel: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  memberDob: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  memberActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  moduleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  moduleIconRow: { flexDirection: 'row', gap: 6 },
  modIcon: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modExtraText: { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  moduleCountText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  manageBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 14,
    marginTop: 4,
  },
  addMoreText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
