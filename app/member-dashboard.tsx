import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { Avatar } from '@/components/Avatar';
import CustomModal from '@/components/CustomModal';

const TABS = ['Overview','Reminders','Health','Documents','Modules','Settings'];
const TAB_ICONS = ['grid','notifications','heart','document-text','apps','settings-outline'];

export default function MemberDashboard() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { token } = useAuth();
  
  const [activeTab, setActiveTab] = useState(0);
  const [member, setMember] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Documents State
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Notification Permissions State
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifPerms, setNotifPerms] = useState({
    reminders: true,
    healthAlerts: true,
    emergencySOS: true,
    weeklyReports: false
  });

  const loadData = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const r = await apiRequest('GET', `/api/family/${id}`, undefined, token);
      const data = await r.json();
      setMember(data);
      if (data.notificationPrefs) {
        setNotifPerms({ ...notifPerms, ...data.notificationPrefs });
      }
    } catch (e) { console.error('[Dashboard] member load:', e); }
    try {
      const rr = await apiRequest('GET', `/api/family/${id}/reminders`, undefined, token);
      setReminders(await rr.json());
    } catch {}
    try {
      const rh = await apiRequest('GET', `/api/family/${id}/health`, undefined, token);
      setHealth(await rh.json());
    } catch {}
    setLoading(false);
  }, [token, id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const saveNotifPerms = async () => {
    if (!token || !id) return;
    setShowNotifModal(false);
    try {
      await apiRequest('PUT', `/api/family/${id}`, { notificationPrefs: notifPerms }, token);
    } catch {}
  };

  const pickDocument = async () => {
    if (!token || !id) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setUploadingDoc(true);
        const uri = result.assets[0].uri;
        const formData = new FormData();
        const filename = uri.split('/').pop() || 'document.jpg';
        const match = /\.(\w+)$/.exec(filename);
        
        if (Platform.OS === 'web') {
          const res = await fetch(uri);
          const blob = await res.blob();
          formData.append('file', blob, filename);
        } else {
          formData.append('file', { uri, name: filename, type: match ? `image/${match[1]}` : 'image/jpeg' } as any);
        }

        const apiBase = getApiUrl();
        const res = await fetch(`${apiBase}/api/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          const newDoc = { id: Date.now().toString(), url: data.url, name: 'Uploaded Document', date: new Date().toISOString() };
          const updatedDocs = [...(member.documents || []), newDoc];
          
          await apiRequest('PUT', `/api/family/${id}`, { documents: updatedDocs }, token);
          setMember({ ...member, documents: updatedDocs });
        } else {
          Alert.alert('Upload Failed', 'Could not upload document.');
        }
        setUploadingDoc(false);
      }
    } catch (e) {
      setUploadingDoc(false);
      Alert.alert('Error', 'An error occurred during upload.');
    }
  };

  const removeDocument = async (docId: string) => {
    if (!token || !id) return;
    Alert.alert('Delete Document', 'Are you sure you want to delete this document?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const updatedDocs = (member.documents || []).filter((d: any) => d.id !== docId);
        setMember({ ...member, documents: updatedDocs });
        await apiRequest('PUT', `/api/family/${id}`, { documents: updatedDocs }, token);
      }}
    ]);
  };

  const memberName = member?.name || name || 'Member';
  const modules: string[] = member?.modules || Object.keys(member?.features || {}).filter(k => member?.features[k]) || [];

  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <LinearGradient colors={colors.heroGradient as any} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTop}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={15}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={s.headerCenter}>
            <Avatar name={memberName} uri={member?.avatarUrl} size={42} />
            <View>
              <Text style={[s.headerName, { color: colors.text }]}>{memberName}</Text>
              <Text style={[s.headerRel, { color: colors.textSecondary }]}>{member?.relationship || ''}</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push({ pathname: '/edit-family-member', params: { id } })} style={s.editBtn} hitSlop={10}>
            <Ionicons name="create-outline" size={22} color={colors.accent} />
          </Pressable>
        </View>

        {/* Tab Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabScroll}>
          {TABS.map((tab, i) => (
            <Pressable key={tab} onPress={() => setActiveTab(i)} style={[s.tab, activeTab === i && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}>
              <Ionicons name={TAB_ICONS[i] as any} size={15} color={activeTab === i ? colors.accent : colors.textTertiary} />
              <Text style={[s.tabText, { color: activeTab === i ? colors.accent : colors.textTertiary }]}>{tab}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}>
        {loading ? (
          <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>
        ) : (
          <>
            {/* Overview */}
            {activeTab === 0 && (
              <Animated.View entering={FadeInDown.duration(400)}>
                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.cardTitle, { color: colors.text }]}>Quick Summary</Text>
                  <View style={s.statsRow}>
                    <StatBox label="Medicines" value={String(member?.medicines?.length || 0)} icon="medkit" color="#EF4444" colors={colors} />
                    <StatBox label="Modules" value={String(modules.length)} icon="apps" color={colors.accentMint} colors={colors} />
                    <StatBox label="Reminders" value={String(reminders.length)} icon="notifications" color="#F59E0B" colors={colors} />
                  </View>
                </View>

                {member?.medicines?.length > 0 && (
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.cardTitle, { color: colors.text }]}>Active Medicines</Text>
                    {member.medicines.slice(0, 5).map((med: any) => (
                      <View key={med.id} style={[s.medRow, { borderBottomColor: colors.border + '40' }]}>
                        <View style={[s.medDot, { backgroundColor: (med.color || colors.accent) + '20' }]}>
                          <Ionicons name="medkit" size={15} color={med.color || colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.medName, { color: colors.text }]}>{med.name}</Text>
                          <Text style={[s.medDosage, { color: colors.textTertiary }]}>{med.dosage || 'No dosage info'}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                      </View>
                    ))}
                  </View>
                )}

                {health.length > 0 && (
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.cardTitle, { color: colors.text }]}>Recent Health Logs</Text>
                    {health.slice(0, 4).map((h: any, i: number) => (
                      <Pressable 
                        key={i} 
                        style={[s.healthRow, { borderBottomColor: colors.border + '40' }]}
                        onPress={() => router.push({ pathname: '/health-monitoring' as any, params: { memberId: id, memberName: memberName, type: h.type } })}
                      >
                        <View style={[s.healthIconBadge, { backgroundColor: colors.accentDim }]}>
                          <Ionicons name={h.type.includes('Blood') ? 'heart' : 'fitness'} size={14} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.healthType, { color: colors.textSecondary }]}>{h.type}</Text>
                          <Text style={[s.healthDate, { color: colors.textTertiary }]}>{h.date ? new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</Text>
                        </View>
                        <Text style={[s.healthVal, { color: colors.text }]}>{h.value} <Text style={{fontSize:11, color: colors.textTertiary}}>{h.unit}</Text></Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{marginLeft: 8}} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </Animated.View>
            )}

            {/* Reminders */}
            {activeTab === 1 && (
              <Animated.View entering={FadeInDown.duration(400)}>
                <View style={s.tabActionRow}>
                  <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>All Reminders ({reminders.length})</Text>
                  <Pressable onPress={() => router.push('/edit-reminder')} style={[s.addBtn, { backgroundColor: colors.accentDim }]}>
                    <Ionicons name="add" size={18} color={colors.accent} />
                    <Text style={[s.addBtnText, { color: colors.accent }]}>Add</Text>
                  </Pressable>
                </View>
                {reminders.length === 0 ? (
                  <EmptyState icon="notifications-off-outline" title="No reminders" subtitle="Add reminders for this member" colors={colors} />
                ) : reminders.map((r: any) => (
                  <View key={r.id || r._id} style={[s.reminderRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[s.reminderIcon, { backgroundColor: colors.accentDim }]}>
                      <Ionicons name="notifications" size={16} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.reminderName, { color: colors.text }]}>{r.name}</Text>
                      <Text style={[s.reminderDate, { color: colors.textTertiary }]}>{r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-IN') : ''}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: r.status === 'paid' ? '#10B98120' : '#F59E0B20' }]}>
                      <Text style={[s.statusText, { color: r.status === 'paid' ? '#10B981' : '#F59E0B' }]}>{r.status || 'active'}</Text>
                    </View>
                  </View>
                ))}
              </Animated.View>
            )}

            {/* Health */}
            {activeTab === 2 && (
              <Animated.View entering={FadeInDown.duration(400)}>
                <View style={s.tabActionRow}>
                  <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Health Readings</Text>
                  <Pressable
                    onPress={() => router.push({ pathname: '/health-monitoring' as any, params: { memberId: id, memberName: memberName } })}
                    style={[s.addBtn, { backgroundColor: colors.accentDim }]}
                  >
                    <Ionicons name="add" size={18} color={colors.accent} />
                    <Text style={[s.addBtnText, { color: colors.accent }]}>Log</Text>
                  </Pressable>
                </View>
                {[
                  { type: 'Blood Pressure', icon: 'heart', color: '#EF4444', unit: 'mmHg' },
                  { type: 'Blood Sugar', icon: 'water', color: '#3B82F6', unit: 'mg/dL' },
                  { type: 'Weight', icon: 'fitness', color: '#10B981', unit: 'kg' },
                  { type: 'Oxygen (SpO2)', icon: 'pulse', color: '#8B5CF6', unit: '%' },
                  { type: 'Temperature', icon: 'thermometer', color: '#F97316', unit: '°C' },
                ].map((vital) => {
                  const latest = health.filter(h => h.type === vital.type).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                  return (
                    <View key={vital.type} style={[s.vitalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[s.vitalIcon, { backgroundColor: vital.color + '18' }]}>
                        <Ionicons name={vital.icon as any} size={20} color={vital.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.vitalType, { color: colors.textSecondary }]}>{vital.type}</Text>
                        {latest ? (
                          <>
                            <Text style={[s.vitalValue, { color: colors.text }]}>{latest.value} <Text style={{ fontSize: 12 }}>{vital.unit}</Text></Text>
                            <Text style={[s.vitalDate, { color: colors.textTertiary }]}>{new Date(latest.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                          </>
                        ) : (
                          <Text style={[s.vitalDate, { color: colors.textTertiary }]}>No readings yet</Text>
                        )}
                      </View>
                      <Pressable onPress={() => router.push({ pathname: '/health-monitoring' as any, params: { memberId: id, memberName: memberName, type: vital.type } })}>
                        <Ionicons name="add-circle-outline" size={28} color={vital.color} />
                      </Pressable>
                    </View>
                  );
                })}
              </Animated.View>
            )}

            {/* Documents */}
            {activeTab === 3 && (
              <Animated.View entering={FadeInDown.duration(400)}>
                <View style={s.tabActionRow}>
                  <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Stored Documents</Text>
                  <Pressable onPress={pickDocument} disabled={uploadingDoc} style={[s.addBtn, { backgroundColor: colors.accentDim }]}>
                    {uploadingDoc ? <ActivityIndicator size="small" color={colors.accent} /> : (
                      <>
                        <Ionicons name="cloud-upload" size={16} color={colors.accent} />
                        <Text style={[s.addBtnText, { color: colors.accent }]}>Upload</Text>
                      </>
                    )}
                  </Pressable>
                </View>
                
                {!(member?.documents?.length > 0) ? (
                  <EmptyState icon="document-text-outline" title="No documents yet" subtitle="Upload prescriptions, reports, Aadhaar, etc." colors={colors} />
                ) : (
                  <View style={s.docGrid}>
                    {member.documents.map((doc: any, i: number) => (
                      <Animated.View key={doc.id || i} entering={FadeInDown.delay(i * 40).duration(300)} style={s.docCardWrap}>
                        <View style={[s.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <View style={[s.docPreview, { backgroundColor: colors.inputBg }]}>
                            <Ionicons name="document-text" size={36} color={colors.accent} style={{opacity:0.3, position:'absolute'}} />
                            <Avatar uri={doc.url} name="Doc" size={80} style={{ borderRadius: 12 }} />
                          </View>
                          <View style={s.docInfo}>
                            <Text style={[s.docName, { color: colors.text }]} numberOfLines={1}>{doc.name}</Text>
                            <Text style={[s.docDate, { color: colors.textTertiary }]}>{doc.date ? new Date(doc.date).toLocaleDateString('en-IN') : ''}</Text>
                          </View>
                          <Pressable onPress={() => removeDocument(doc.id)} style={[s.docDeleteBtn, { backgroundColor: colors.dangerDim }]}>
                            <Ionicons name="trash" size={16} color={colors.danger} />
                          </Pressable>
                        </View>
                      </Animated.View>
                    ))}
                  </View>
                )}
              </Animated.View>
            )}

            {/* Modules */}
            {activeTab === 4 && (
              <Animated.View entering={FadeInDown.duration(400)}>
                <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Active Modules ({modules.length})</Text>
                {modules.map((mKey, i) => {
                  const MOD_MAP: Record<string, { label: string; icon: string; color: string }> = {
                    medicine: { label: 'Medicine Tracking', icon: 'medkit', color: '#EF4444' },
                    doctor: { label: 'Doctor Appointments', icon: 'medical', color: '#3B82F6' },
                    health: { label: 'Health Monitoring', icon: 'heart', color: '#EC4899' },
                    sos: { label: 'Emergency SOS', icon: 'warning', color: '#F59E0B' },
                    bills: { label: 'Bill Management', icon: 'receipt', color: '#F97316' },
                    insurance: { label: 'Insurance', icon: 'shield-checkmark', color: '#10B981' },
                    subscription: { label: 'Subscriptions', icon: 'refresh-circle', color: '#8B5CF6' },
                    expense: { label: 'Expense Tracking', icon: 'wallet', color: '#06B6D4' },
                    routine: { label: 'Daily Routine', icon: 'sunny', color: '#FBBF24' },
                    checkin: { label: 'Call & Check-in', icon: 'call', color: '#34D399' },
                    travel: { label: 'Travel & Visits', icon: 'airplane', color: '#60A5FA' },
                    diet: { label: 'Diet & Meal Plan', icon: 'restaurant', color: '#A78BFA' },
                    stock: { label: 'Medicine Stock', icon: 'cube', color: '#FB7185' },
                    documents: { label: 'Documents', icon: 'document-text', color: '#4ADE80' },
                    fitness: { label: 'Fitness', icon: 'fitness', color: '#F472B6' },
                    study: { label: 'Study & Education', icon: 'school', color: '#38BDF8' },
                    mental: { label: 'Mental Health', icon: 'happy', color: '#C084FC' },
                    vehicle: { label: 'Vehicle Mgmt', icon: 'car', color: '#FB923C' },
                    home: { label: 'Home Maintenance', icon: 'home', color: '#2DD4BF' },
                    custom: { label: 'Custom Module', icon: 'create', color: '#94A3B8' },
                  };
                  const mod = MOD_MAP[mKey] || { label: mKey, icon: 'apps', color: colors.accent };
                  return (
                    <Animated.View key={mKey} entering={FadeInDown.delay(i * 40).duration(350)}>
                      <View style={[s.moduleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[s.moduleIcon, { backgroundColor: mod.color + '18' }]}>
                          <Ionicons name={mod.icon as any} size={18} color={mod.color} />
                        </View>
                        <Text style={[s.moduleName, { color: colors.text }]}>{mod.label}</Text>
                        <View style={[s.activeBadge, { backgroundColor: '#10B98118' }]}>
                          <Text style={[s.activeText, { color: '#10B981' }]}>Active</Text>
                        </View>
                      </View>
                    </Animated.View>
                  );
                })}
                <Pressable onPress={() => router.push({ pathname: '/edit-family-member', params: { id } })} style={[s.editModulesBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Ionicons name="settings-outline" size={18} color={colors.accent} />
                  <Text style={[s.editModulesBtnText, { color: colors.accent }]}>Manage Modules</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Settings */}
            {activeTab === 5 && (
              <Animated.View entering={FadeInDown.duration(400)}>
                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.cardTitle, { color: colors.text }]}>Member Settings</Text>
                  <SettingLink label="Edit Profile" icon="person-outline" color={colors.accent} colors={colors} onPress={() => router.push({ pathname: '/edit-family-member', params: { id } })} />
                  <SettingLink label="Manage Caregivers" icon="people-outline" color="#10B981" colors={colors} onPress={() => router.push({ pathname: '/caregivers' as any, params: { memberId: id, memberName: memberName } })} />
                  <SettingLink label="Notification Permissions" icon="notifications-outline" color="#3B82F6" colors={colors} onPress={() => setShowNotifModal(true)} />
                </View>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      {/* Notification Permissions Modal */}
      <CustomModal visible={showNotifModal} onClose={() => setShowNotifModal(false)}>
        <Text style={[s.modalTitle, { color: colors.text }]}>Notification Permissions</Text>
        <Text style={[s.modalSub, { color: colors.textSecondary, marginBottom: 20 }]}>Control which alerts you receive for {memberName}.</Text>
        
        <View style={s.notifList}>
          <NotifToggle label="Reminders & Pills" desc="Get notified when medicines or tasks are due" value={notifPerms.reminders} onValueChange={(v) => setNotifPerms({...notifPerms, reminders: v})} colors={colors} icon="medkit" iconColor="#EF4444" />
          <NotifToggle label="Health Alerts" desc="Alerts for abnormal health readings" value={notifPerms.healthAlerts} onValueChange={(v) => setNotifPerms({...notifPerms, healthAlerts: v})} colors={colors} icon="heart" iconColor="#EC4899" />
          <NotifToggle label="Emergency SOS" desc="Critical emergency notifications" value={notifPerms.emergencySOS} onValueChange={(v) => setNotifPerms({...notifPerms, emergencySOS: v})} colors={colors} icon="warning" iconColor="#F59E0B" />
          <NotifToggle label="Weekly Reports" desc="Weekly summary of adherence and health" value={notifPerms.weeklyReports} onValueChange={(v) => setNotifPerms({...notifPerms, weeklyReports: v})} colors={colors} icon="stats-chart" iconColor="#8B5CF6" />
        </View>

        <View style={s.modalFooter}>
          <Pressable style={[s.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowNotifModal(false)}>
            <Text style={[s.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Pressable onPress={saveNotifPerms} style={[s.confirmBtn, { backgroundColor: colors.accent }]}>
            <Text style={s.confirmBtnText}>Save Preferences</Text>
          </Pressable>
        </View>
      </CustomModal>
    </View>
  );
}

function NotifToggle({ label, desc, value, onValueChange, colors, icon, iconColor }: any) {
  return (
    <View style={[s.notifRow, { borderBottomColor: colors.border + '40' }]}>
      <View style={[s.notifIcon, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.notifLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[s.notifDesc, { color: colors.textTertiary }]}>{desc}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.accent, false: colors.border }} />
    </View>
  );
}

function StatBox({ label, value, icon, color, colors }: any) {
  return (
    <View style={[s.statBox, { backgroundColor: color + '12', borderColor: color + '30' }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, title, subtitle, colors }: any) {
  return (
    <View style={s.emptyWrap}>
      <View style={[s.emptyIcon, { backgroundColor: colors.accentDim }]}>
        <Ionicons name={icon} size={36} color={colors.accent} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[s.emptySub, { color: colors.textSecondary }]}>{subtitle}</Text>
    </View>
  );
}

function SettingLink({ label, icon, color, colors, onPress }: any) {
  return (
    <Pressable onPress={onPress} style={[s.settingRow, { borderBottomColor: colors.border + '40' }]}>
      <View style={[s.settingIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[s.settingLabel, { color: colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 0, paddingBottom: 0 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginLeft: 8 },
  headerName: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  headerRel: { fontFamily: 'Inter_500Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  editBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tabScroll: { paddingHorizontal: 12, gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12 },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5 },
  scroll: { padding: 16 },
  center: { padding: 60, alignItems: 'center' },
  card: { borderRadius: 24, borderWidth: 1, padding: 18, marginBottom: 16 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 16, alignItems: 'center', gap: 6 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  medRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 12 },
  medDot: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  medName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  medDosage: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  healthRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 12 },
  healthIconBadge: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  healthType: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  healthVal: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.5 },
  healthDate: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  tabActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10, gap: 12 },
  reminderIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  reminderName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  reminderDate: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 3 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  vitalCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12, gap: 14 },
  vitalIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  vitalType: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  vitalValue: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -1 },
  vitalDate: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  moduleRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 10, gap: 14 },
  moduleIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  moduleName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, flex: 1 },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  activeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  editModulesBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 14, marginTop: 10 },
  editModulesBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 14 },
  settingIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, flex: 1 },
  emptyWrap: { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyIcon: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 19 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 15, textAlign: 'center' },
  docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  docCardWrap: { width: '48%', flexGrow: 1, minWidth: 140 },
  docCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  docPreview: { height: 110, alignItems: 'center', justifyContent: 'center' },
  docInfo: { padding: 12 },
  docName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  docDate: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  docDeleteBtn: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, marginBottom: 8 },
  modalSub: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  notifList: { gap: 6, marginBottom: 20 },
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  notifIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  notifLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  notifDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2, paddingRight: 10 },
  modalFooter: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  confirmBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { color: '#FFF', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});

