// Caregiver scoped-access model — see FAMILY-CAREGIVER-PERMISSIONS-backend-requirements.md.
// Two independent dimensions, both chosen by the member's owner:
//   allowedModules: which Family Hub modules a caregiver may see at all.
//   accessLevel: what they may do with what they can see.
// Absent/null on a caregiver entry means unrestricted — every caregiver
// connected before this feature existed keeps full access (§1, load-bearing).

export type FamilyFeatureKey =
  | 'medicines'
  | 'appointments'
  | 'bills'
  | 'health'
  | 'emergency'
  | 'routine'
  | 'subscriptions'
  | 'expenses'
  | 'tasks'
  | 'checkin'
  | 'travel'
  | 'stock'
  | 'diet'
  | 'insurance'
  | 'custom'
  | 'fitness'
  | 'study'
  | 'wellness'
  | 'vehicles'
  | 'homeMaintenance';

export const FAMILY_FEATURE_KEYS: FamilyFeatureKey[] = [
  'medicines', 'appointments', 'bills', 'health', 'emergency', 'routine',
  'subscriptions', 'expenses', 'tasks', 'checkin', 'travel', 'stock',
  'diet', 'insurance', 'custom', 'fitness', 'study', 'wellness',
  'vehicles', 'homeMaintenance',
];

export type CaregiverAccessLevel = 'view' | 'mark_done' | 'full';

const ACCESS_LEVELS: CaregiverAccessLevel[] = ['view', 'mark_done', 'full'];
const ACCESS_RANK: Record<CaregiverAccessLevel, number> = { view: 0, mark_done: 1, full: 2 };

export interface CaregiverPermissions {
  allowedModules: FamilyFeatureKey[] | null;
  accessLevel: CaregiverAccessLevel;
}

export function isValidModuleKey(key: any): key is FamilyFeatureKey {
  return typeof key === 'string' && (FAMILY_FEATURE_KEYS as string[]).includes(key);
}

export function isValidAccessLevel(level: any): level is CaregiverAccessLevel {
  return typeof level === 'string' && (ACCESS_LEVELS as string[]).includes(level);
}

// Validates a permissions payload from a request body. Returns an error
// message if invalid, or the normalized object if valid/absent. An
// unrecognised module key or access level must be rejected outright, never
// silently dropped or interpreted as "allow" (§4).
export function parsePermissionsInput(input: any): { error: string } | { value: CaregiverPermissions | null } {
  if (input === undefined || input === null) return { value: null };
  if (typeof input !== 'object') return { error: 'permissions must be an object' };

  const { allowedModules, accessLevel } = input;

  if (allowedModules !== null && allowedModules !== undefined) {
    if (!Array.isArray(allowedModules) || !allowedModules.every(isValidModuleKey)) {
      return { error: 'allowedModules must be null or an array of valid module keys' };
    }
  }

  if (accessLevel !== undefined && !isValidAccessLevel(accessLevel)) {
    return { error: 'accessLevel must be one of: view, mark_done, full' };
  }

  return {
    value: {
      allowedModules: allowedModules === undefined ? null : allowedModules,
      accessLevel: isValidAccessLevel(accessLevel) ? accessLevel : 'full',
    },
  };
}

// Absent/null permissions on a legacy or unrestricted caregiver ⇒ full access
// to everything (§1). Never treat missing permissions as "no access."
export function normalizePermissions(raw: any): CaregiverPermissions {
  if (!raw || typeof raw !== 'object') {
    return { allowedModules: null, accessLevel: 'full' };
  }
  const allowedModules = Array.isArray(raw.allowedModules)
    ? raw.allowedModules.filter(isValidModuleKey)
    : null;
  const accessLevel = isValidAccessLevel(raw.accessLevel) ? raw.accessLevel : 'full';
  return { allowedModules, accessLevel };
}

export function canAccessModule(permissions: CaregiverPermissions, moduleKey: FamilyFeatureKey): boolean {
  return permissions.allowedModules === null || permissions.allowedModules.includes(moduleKey);
}

export function hasAccessLevel(permissions: CaregiverPermissions, required: CaregiverAccessLevel): boolean {
  return ACCESS_RANK[permissions.accessLevel] >= ACCESS_RANK[required];
}

// Maps a family-record `:kind` segment (registerFamilyArrayFeature field) or
// other family sub-resource to the module key that gates it (§6.1).
export const KIND_TO_MODULE: Record<string, FamilyFeatureKey> = {
  appointments: 'appointments',
  medicationStock: 'stock',
  familyBills: 'bills',
  subscriptions: 'subscriptions',
  familyTasks: 'tasks',
  routines: 'routine',
  checkins: 'checkin',
  travelItems: 'travel',
  healthLogs: 'health',
  documents: 'insurance',
  familyExpenses: 'expenses',
  customItems: 'custom',
  dietProfile: 'diet',
  fitnessItems: 'fitness',
  studyProfile: 'study',
  moodLogs: 'wellness',
  wellnessReminders: 'wellness',
  vehicles: 'vehicles',
  fuelLog: 'vehicles',
  homeMaintenance: 'homeMaintenance',
  emergencyProfile: 'emergency',
  medicines: 'medicines',
};

// Maps a projected reminder's `sourceKind` (server/family-reminders.ts) to the
// module key that gates it — a different, singular vocabulary than the
// `:kind` route segments in KIND_TO_MODULE above, covering the same modules.
export const SOURCE_KIND_TO_MODULE: Record<string, FamilyFeatureKey> = {
  appointment: 'appointments',
  'medicine-stock': 'stock',
  'family-bill': 'bills',
  subscription: 'subscriptions',
  task: 'tasks',
  routine: 'routine',
  checkin: 'checkin',
  travel: 'travel',
  insurance: 'insurance',
  custom: 'custom',
};

// A PATCH body that touches only these fields needs `mark_done`; anything
// else (or a POST/DELETE) needs `full` (§6.2).
const MARK_DONE_FIELDS = new Set([
  'isPaid', 'completed', 'taken', 'lastDoneAt', 'completedDates', 'snoozedUntil', 'status',
  // emergencyLog entries use `acknowledged` as their completion flag —
  // functionally identical to `completed`/`isPaid` for §6.2's purposes.
  'acknowledged',
  // Client also sends these alongside a completion toggle; see §6.2's own
  // examples (paid/taken/snooze/skip) — updatedAt is bookkeeping, not a field
  // that changes what the record IS.
  'updatedAt',
]);

export function isMarkDoneOnlyPatch(body: Record<string, any>): boolean {
  const keys = Object.keys(body || {});
  if (keys.length === 0) return true;
  return keys.every((k) => MARK_DONE_FIELDS.has(k));
}
