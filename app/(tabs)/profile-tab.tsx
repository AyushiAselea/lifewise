import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Switch,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useCurrency, CURRENCIES } from '@/lib/currency-context';
import { useExpenses } from '@/lib/expense-context';
import { useSeniorMode } from '@/lib/senior-context';
import { useAlert } from '@/lib/alert-context';
import { useTabBarContentInset } from '@/lib/tab-bar';
import { Avatar } from '@/components/Avatar';
import CustomModal from '@/components/CustomModal';

const PLAN_FEATURES = {
  free: [
    '3 Family Members',
    'Medicine Module',
    'Bills Module',
    'Basic Reminders',
  ],
  premium: [
    'Unlimited Family Members',
    'All 20 Modules',
    'WiseAI Chat',
    'Bill Scanner (OCR)',
    'Monthly Reports (PDF)',
    'Document Storage',
    'Money Leak Detection',
    'Voice Reminder (AI)',
  ],
};

function ProfileMenuRow({
  icon,
  iconColor,
  iconBg,
  label,
  subtitle,
  rightElement,
  onPress,
  danger,
  colors,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuRow, { borderBottomColor: colors.border + '30' }]}
    >
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={[styles.menuLabel, { color: danger ? colors.danger : colors.text }]}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={[styles.menuSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {rightElement || (
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      )}
    </Pressable>
  );
}

export default function ProfileTabScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarContentInset();
  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { currentCurrency, setCurrency, formatAmount } = useCurrency();
  const { monthlyBudget, setMonthlyBudget } = useExpenses();
  const { isSeniorMode, setSeniorMode } = useSeniorMode();
  const { showAlert } = useAlert();

  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(monthlyBudget || ''));

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const isPremium = (user as any)?.plan === 'premium';

  const handleLogout = () => {
    showAlert({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      type: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => logout().then(() => router.replace('/(auth)/login')),
        },
      ],
    });
  };

  const userName = user?.name || 'User';
  const userEmail = user?.email || '';
  const avatarUrl = (user as any)?.avatarUrl || null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topInset + 16, paddingBottom: tabBarInset.bottom + 20 },
        ]}
      >
        {/* Header */}
        <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.duration(500) : undefined}>
          <View style={styles.headerRow}>
            <Text style={[styles.screenTitle, { color: colors.text }]}>Profile</Text>
          </View>
        </Animated.View>

        {/* Profile Card */}
        <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.delay(60).duration(500) : undefined}>
          <Pressable
            onPress={() => router.push('/profile')}
            style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <LinearGradient
              colors={colors.heroGradient as any}
              style={styles.profileCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Avatar name={userName} uri={avatarUrl} size={72} />
              <View style={styles.profileCardInfo}>
                <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                  {userName}
                </Text>
                <Text style={[styles.profileEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                  {userEmail}
                </Text>
                <View style={[styles.planBadge, { backgroundColor: isPremium ? '#F59E0B20' : colors.accentDim }]}>
                  <Ionicons
                    name={isPremium ? 'star' : 'person-outline'}
                    size={12}
                    color={isPremium ? '#F59E0B' : colors.accent}
                  />
                  <Text style={[styles.planBadgeText, { color: isPremium ? '#F59E0B' : colors.accent }]}>
                    {isPremium ? 'Premium Plan' : 'Free Plan'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Subscription Card */}
        <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.delay(100).duration(500) : undefined}>
          {!isPremium ? (
            <View style={[styles.upgradeCard, { backgroundColor: colors.card, borderColor: '#F59E0B40' }]}>
              <LinearGradient
                colors={['#F59E0B15', '#7C3AED15'] as any}
                style={styles.upgradeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.upgradeHeader}>
                  <View style={[styles.upgradeIconWrap, { backgroundColor: '#F59E0B20' }]}>
                    <Ionicons name="star" size={20} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.upgradeTitle, { color: colors.text }]}>Upgrade to Premium</Text>
                    <Text style={[styles.upgradeSubtitle, { color: colors.textSecondary }]}>
                      ₹199/month · Unlock all 20 modules
                    </Text>
                  </View>
                  <Pressable style={[styles.upgradeBtn, { backgroundColor: '#F59E0B' }]}>
                    <Text style={styles.upgradeBtnText}>Upgrade</Text>
                  </Pressable>
                </View>
                <View style={styles.upgradeFeatures}>
                  {PLAN_FEATURES.premium.slice(0, 4).map((feat, i) => (
                    <View key={i} style={styles.upgradeFeatureRow}>
                      <Ionicons name="checkmark-circle" size={14} color="#F59E0B" />
                      <Text style={[styles.upgradeFeatureText, { color: colors.textSecondary }]}>{feat}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </View>
          ) : (
            <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: '#F59E0B40' }]}>
              <LinearGradient
                colors={['#F59E0B20', '#7C3AED20'] as any}
                style={styles.premiumGradient}
              >
                <Ionicons name="star" size={22} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.premiumTitle, { color: colors.text }]}>Premium Active</Text>
                  <Text style={[styles.premiumSub, { color: colors.textSecondary }]}>
                    All 20 modules unlocked
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              </LinearGradient>
            </View>
          )}
        </Animated.View>

        {/* Quick Stats */}
        <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.delay(140).duration(500) : undefined}>
          <View style={[styles.statsRow]}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="people" size={18} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {isPremium ? '∞' : '3'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Members</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="apps" size={18} color={colors.accentMint} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {isPremium ? '20' : '2'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Modules</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="wallet" size={18} color={colors.warning} />
              <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
                {currentCurrency.symbol}{(monthlyBudget / 1000).toFixed(0)}k
              </Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Budget</Text>
            </View>
          </View>
        </Animated.View>

        {/* Account Section */}
        <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.delay(180).duration(500) : undefined}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ACCOUNT</Text>
          <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ProfileMenuRow
              icon="person-outline"
              iconColor={colors.accent}
              iconBg={colors.accentDim}
              label="Edit Profile"
              subtitle="Name, phone, date of birth"
              onPress={() => router.push('/profile')}
              colors={colors}
            />
            <ProfileMenuRow
              icon="notifications-outline"
              iconColor="#3B82F6"
              iconBg="#3B82F620"
              label="Notifications"
              subtitle="Manage alerts & quiet hours"
              onPress={() => router.push('/notifications')}
              colors={colors}
            />
            <ProfileMenuRow
              icon="shield-checkmark-outline"
              iconColor="#10B981"
              iconBg="#10B98120"
              label="Privacy"
              subtitle="Data & permissions"
              onPress={() => router.push('/privacy')}
              colors={colors}
            />
          </View>
        </Animated.View>

        {/* Appearance */}
        <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.delay(220).duration(500) : undefined}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>APPEARANCE</Text>
          <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ProfileMenuRow
              icon="moon-outline"
              iconColor={colors.accent}
              iconBg={colors.accentDim}
              label="Dark Mode"
              colors={colors}
              rightElement={
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: colors.border, true: colors.accent + '50' }}
                  thumbColor={isDark ? colors.accent : '#ccc'}
                />
              }
            />
            <ProfileMenuRow
              icon="accessibility-outline"
              iconColor="#8B5CF6"
              iconBg="#8B5CF620"
              label="Senior Mode"
              subtitle="Larger text, simpler layout"
              colors={colors}
              rightElement={
                <Switch
                  value={isSeniorMode}
                  onValueChange={setSeniorMode}
                  trackColor={{ false: colors.border, true: colors.accent + '50' }}
                  thumbColor={isSeniorMode ? colors.accent : '#ccc'}
                />
              }
            />
          </View>
        </Animated.View>



        {/* Preferences */}
        <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.delay(260).duration(500) : undefined}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PREFERENCES</Text>
          <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ProfileMenuRow
              icon="cash-outline"
              iconColor="#10B981"
              iconBg="#10B98120"
              label="Currency"
              subtitle={`${currentCurrency.symbol} ${currentCurrency.code}`}
              onPress={() => setShowCurrencyPicker(true)}
              colors={colors}
            />
            <ProfileMenuRow
              icon="wallet-outline"
              iconColor="#3B82F6"
              iconBg="#3B82F620"
              label="Monthly Budget"
              subtitle={formatAmount(monthlyBudget || 0)}
              onPress={() => {
                setBudgetInput(String(monthlyBudget || ''));
                setShowBudgetModal(true);
              }}
              colors={colors}
            />
          </View>
        </Animated.View>

        {/* Support */}
        <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.delay(280).duration(500) : undefined}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SUPPORT</Text>
          <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ProfileMenuRow
              icon="help-circle-outline"
              iconColor="#F59E0B"
              iconBg="#F59E0B20"
              label="Help & Support"
              subtitle="FAQs & contact us"
              onPress={() => router.push('/support')}
              colors={colors}
            />
          </View>
        </Animated.View>

        {/* Logout */}
        <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.delay(300).duration(500) : undefined}>
          <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ProfileMenuRow
              icon="log-out-outline"
              iconColor={colors.danger}
              iconBg={colors.dangerDim}
              label="Logout"
              onPress={handleLogout}
              danger
              colors={colors}
            />
          </View>
        </Animated.View>

        <Text style={[styles.versionText, { color: colors.textTertiary }]}>
          LifeWise v1.0.0 · Family Operating System
        </Text>
      </ScrollView>

      <CustomModal visible={showCurrencyPicker} onClose={() => setShowCurrencyPicker(false)}>
        <Text style={[styles.modalTitle, { color: colors.text }]}>Select Currency</Text>
        {CURRENCIES.map(curr => (
          <Pressable
            key={curr.code}
            onPress={() => { setCurrency(curr.code); setShowCurrencyPicker(false); }}
            style={[
              styles.currencyRow,
              { borderBottomColor: colors.border },
              curr.code === currentCurrency.code && { backgroundColor: colors.accentDim },
            ]}
          >
            <Text style={[styles.currencySymbol, { color: colors.accent }]}>{curr.symbol}</Text>
            <View style={styles.currencyInfo}>
              <Text style={[styles.currencyCode, { color: colors.text }]}>{curr.code}</Text>
              <Text style={[styles.currencyName, { color: colors.textSecondary }]}>{curr.name}</Text>
            </View>
            {curr.code === currentCurrency.code && (
              <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
            )}
          </Pressable>
        ))}
        <Pressable onPress={() => setShowCurrencyPicker(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
          <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
        </Pressable>
      </CustomModal>

      <CustomModal visible={showBudgetModal} onClose={() => setShowBudgetModal(false)}>
        <Text style={[styles.modalTitle, { color: colors.text }]}>Set Monthly Budget</Text>
        <Text style={[styles.budgetHint, { color: colors.textSecondary }]}>
          This amount is used for the home screen budget bar and remaining balance.
        </Text>
        <View
          style={[
            styles.budgetInputRow,
            { borderColor: colors.inputBorder, backgroundColor: colors.inputBg },
          ]}
        >
          <Text style={[styles.currencySymbol, { color: colors.accent }]}>{currentCurrency.symbol}</Text>
          <Text style={[styles.currencyCode, { color: colors.textSecondary, fontSize: 14, marginRight: 4 }]}>
            {currentCurrency.code}
          </Text>
        </View>
        <TextInput
          style={[{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 24,
            textAlign: 'center',
            width: '100%',
          }, { color: colors.text }]}
          value={budgetInput}
          onChangeText={(t: string) => setBudgetInput(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
          {[10000, 25000, 50000].map((preset) => (
            <Pressable
              key={preset}
              onPress={() => setBudgetInput(String(preset))}
              style={[styles.budgetPreset, { borderColor: colors.border }]}
            >
              <Text style={[styles.budgetPresetText, { color: colors.textSecondary }]}>
                {formatAmount(preset)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={async () => {
            const value = parseInt(budgetInput.replace(/[^0-9]/g, ''), 10);
            if (Number.isNaN(value) || value <= 0) {
              setBudgetInput(String(monthlyBudget || 0));
              setShowBudgetModal(false);
              return;
            }
            await setMonthlyBudget(value);
            setShowBudgetModal(false);
          }}
          style={[styles.cancelBtn, { borderColor: colors.border, marginTop: 20, backgroundColor: colors.accent }]}
        >
          <Text style={[styles.cancelBtnText, { color: '#FFFFFF' }]}>Save Budget</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowBudgetModal(false)}
          style={[styles.cancelBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
        </Pressable>
      </CustomModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  screenTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    letterSpacing: -0.5,
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  profileCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  profileCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  profileCardInfo: { flex: 1, gap: 4 },
  profileName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  profileEmail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  planBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  upgradeCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  upgradeGradient: {
    padding: 20,
    gap: 16,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upgradeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  upgradeSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  upgradeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  upgradeBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
  upgradeFeatures: {
    gap: 8,
  },
  upgradeFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upgradeFeatureText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  premiumCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  premiumGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 14,
  },
  premiumTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  premiumSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  statLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  menuGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 14,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: { flex: 1 },
  menuLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  menuSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  versionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  modalContainer: { paddingHorizontal: 24, paddingBottom: 24 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, textAlign: 'center', marginBottom: 16 },
  currencyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderRadius: 12, gap: 14, marginBottom: 2 },
  currencySymbol: { fontFamily: 'Inter_700Bold', fontSize: 22, width: 32, textAlign: 'center' },
  currencyInfo: { flex: 1 },
  currencyCode: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  currencyName: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  cancelBtn: { marginTop: 12, borderRadius: 14, borderWidth: 1, paddingVertical: 16, alignItems: 'center' },
  cancelBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  budgetHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginBottom: 14,
    textAlign: 'center',
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 10,
  },
  budgetInputBox: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  budgetPreset: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  budgetPresetText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
});
