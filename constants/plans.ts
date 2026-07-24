export type PlanId = 'free' | 'starter' | 'family' | 'pro';
export type PlanInterval = 'month' | 'year';

export interface PlanLimits {
  familyMembers: number | null;
  reminders: number | null;
  wiseAiPerMonth: number | null;
  billScanPerMonth: number | null;
  voiceReminderPerMonth: number | null;
  bankPdfImportPerMonth: number | null;
  noticeboardPostsPerMonth: number | null;
}

export interface PlanFlags {
  pdfReports: boolean;
  prioritySupport: boolean;
  caregiverSharing: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  limits: PlanLimits;
  flags: PlanFlags;
  productIdMonthly: string | null;
  productIdYearly: string | null;
  recommended?: boolean;
}

// null in any limit means unlimited.
export const LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    familyMembers: 1,
    reminders: 5,
    wiseAiPerMonth: 5,
    billScanPerMonth: 3,
    voiceReminderPerMonth: 3,
    bankPdfImportPerMonth: 1,
    noticeboardPostsPerMonth: 2,
  },
  starter: {
    familyMembers: 3,
    reminders: 20,
    wiseAiPerMonth: 30,
    billScanPerMonth: 10,
    voiceReminderPerMonth: 10,
    bankPdfImportPerMonth: 3,
    noticeboardPostsPerMonth: 10,
  },
  family: {
    familyMembers: 6,
    reminders: null,
    wiseAiPerMonth: 100,
    billScanPerMonth: 30,
    voiceReminderPerMonth: 30,
    bankPdfImportPerMonth: 10,
    noticeboardPostsPerMonth: 30,
  },
  pro: {
    familyMembers: null,
    reminders: null,
    wiseAiPerMonth: null,
    billScanPerMonth: null,
    voiceReminderPerMonth: null,
    bankPdfImportPerMonth: null,
    noticeboardPostsPerMonth: null,
  },
};

export const FLAGS: Record<PlanId, PlanFlags> = {
  free: { pdfReports: false, prioritySupport: false, caregiverSharing: false },
  starter: { pdfReports: false, prioritySupport: false, caregiverSharing: true },
  family: { pdfReports: true, prioritySupport: false, caregiverSharing: true },
  pro: { pdfReports: true, prioritySupport: true, caregiverSharing: true },
};

export const PLAN_ORDER: PlanId[] = ['free', 'starter', 'family', 'pro'];

export function nextPlanUp(planId: PlanId): PlanId {
  const idx = PLAN_ORDER.indexOf(planId);
  if (idx === -1 || idx === PLAN_ORDER.length - 1) return 'pro';
  return PLAN_ORDER[idx + 1];
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    limits: LIMITS.free,
    flags: FLAGS.free,
    productIdMonthly: null,
    productIdYearly: null,
  },
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 99,
    priceYearly: 799,
    limits: LIMITS.starter,
    flags: FLAGS.starter,
    productIdMonthly: 'lifewise_starter_monthly',
    productIdYearly: 'lifewise_starter_yearly',
  },
  {
    id: 'family',
    name: 'Family',
    priceMonthly: 199,
    priceYearly: 1499,
    limits: LIMITS.family,
    flags: FLAGS.family,
    productIdMonthly: 'lifewise_family_monthly',
    productIdYearly: 'lifewise_family_yearly',
    recommended: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 499,
    priceYearly: 3999,
    limits: LIMITS.pro,
    flags: FLAGS.pro,
    productIdMonthly: 'lifewise_pro_monthly',
    productIdYearly: 'lifewise_pro_yearly',
  },
];

export function getPlanById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
