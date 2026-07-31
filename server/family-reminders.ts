// Projects Family Hub records into Bill-shaped reminders. Mirrors the frontend's
// lib/family-reminders.ts projection so the server and client never disagree.
// The family record is authoritative; nothing here is persisted as its own row.

export type FamilySourceKind =
  | 'appointment'
  | 'medicine-stock'
  | 'family-bill'
  | 'subscription'
  | 'task'
  | 'routine'
  | 'checkin'
  | 'travel';

export interface ProjectedFamilyReminder {
  id: string;
  memberId: string;
  memberName: string;
  sourceKind: FamilySourceKind;
  sourceId: string;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  icon: string;
  reminderType: 'bill' | 'subscription' | 'custom';
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  status: 'active' | 'paid' | 'snoozed' | 'cancelled';
  isPaid: boolean;
  reminderDaysBefore: number[];
  source: 'family';
}

const KIND_META: Record<FamilySourceKind, { category: string; icon: string; reminderType: 'bill' | 'subscription' | 'custom' }> = {
  'appointment': { category: 'health', icon: 'medkit', reminderType: 'custom' },
  'medicine-stock': { category: 'health', icon: 'medical', reminderType: 'custom' },
  'family-bill': { category: 'bills', icon: 'receipt', reminderType: 'custom' },
  'subscription': { category: 'subscriptions', icon: 'refresh', reminderType: 'subscription' },
  'task': { category: 'tasks', icon: 'checkmark-circle', reminderType: 'custom' },
  'routine': { category: 'habits', icon: 'time', reminderType: 'custom' },
  'checkin': { category: 'family', icon: 'call', reminderType: 'custom' },
  'travel': { category: 'travel', icon: 'airplane', reminderType: 'custom' },
};

const LEAD_TIMES: Record<FamilySourceKind, number[]> = {
  'appointment': [1, 0],
  'medicine-stock': [3, 1],
  'family-bill': [3, 1, 0],
  'subscription': [3, 1],
  'task': [1, 0],
  'routine': [0],
  'checkin': [0],
  'travel': [1, 0],
};

function buildId(sourceKind: FamilySourceKind, memberId: string, sourceId: string): string {
  return `fam:${sourceKind}:${memberId}:${sourceId}`;
}

function makeTitle(title: string, memberName: string): string {
  return `${title} · ${memberName}`;
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Routines/check-ins store a wall-clock "HH:MM AM/PM" with no date, since they
// repeat daily. Resolve to the next occurrence: today if still ahead, else tomorrow.
function resolveNextClockTime(clock: string, now: Date): Date | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(clock).trim());
  if (!match) return null;
  let hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hh < 12) hh += 12;
  if (ampm === 'AM' && hh === 12) hh = 0;
  if (hh > 23 || mm > 59) return null;

  const candidate = new Date(now);
  candidate.setHours(hh, mm, 0, 0);
  if (candidate.getTime() < now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

function makeReminder(
  sourceKind: FamilySourceKind,
  memberId: string,
  memberName: string,
  sourceId: string,
  title: string,
  dueDate: Date,
  overrides: Partial<Pick<ProjectedFamilyReminder, 'amount' | 'repeatType' | 'status' | 'isPaid'>> = {},
): ProjectedFamilyReminder {
  const meta = KIND_META[sourceKind];
  return {
    id: buildId(sourceKind, memberId, sourceId),
    memberId,
    memberName,
    sourceKind,
    sourceId,
    name: makeTitle(title, memberName),
    amount: overrides.amount ?? 0,
    dueDate: dueDate.toISOString(),
    category: meta.category,
    icon: meta.icon,
    reminderType: meta.reminderType,
    repeatType: overrides.repeatType ?? 'none',
    status: overrides.status ?? 'active',
    isPaid: overrides.isPaid ?? false,
    reminderDaysBefore: LEAD_TIMES[sourceKind],
    source: 'family',
  };
}

// Projects every reminder-eligible record on a single family member. Mirrors the
// client's skip rules exactly (see spec §3) so server and client never disagree.
export function projectMemberReminders(member: any): ProjectedFamilyReminder[] {
  const memberId = member._id?.toString?.() ?? String(member._id);
  const memberName = member.name || 'Family member';
  const out: ProjectedFamilyReminder[] = [];
  const now = new Date();

  for (const appt of Array.isArray(member.appointments) ? member.appointments : []) {
    if (appt.completed) continue;
    const due = parseDate(appt.date);
    if (!due) continue;
    out.push(makeReminder('appointment', memberId, memberName, String(appt.id), appt.doctorName || 'Appointment', due));
  }

  for (const item of Array.isArray(member.medicationStock) ? member.medicationStock : []) {
    const dailyUsage = Number(item.dailyUsage);
    if (!(dailyUsage > 0)) continue;
    const quantityRemaining = Number(item.quantityRemaining) || 0;
    const lowStockThreshold = Number(item.lowStockThreshold) || 0;
    const usableUnits = quantityRemaining - lowStockThreshold;
    const daysLeft = Math.floor(usableUnits / dailyUsage);
    const refillDate = new Date(now);
    refillDate.setDate(refillDate.getDate() + Math.max(0, daysLeft));
    refillDate.setHours(9, 0, 0, 0);
    out.push(makeReminder('medicine-stock', memberId, memberName, String(item.id), `Refill ${item.name || 'medicine'}`, refillDate));
  }

  for (const bill of Array.isArray(member.familyBills) ? member.familyBills : []) {
    if (bill.isPaid) continue;
    const due = parseDate(bill.dueDate);
    if (!due) continue;
    out.push(makeReminder('family-bill', memberId, memberName, String(bill.id), bill.name || 'Bill', due, {
      amount: Number(bill.amount) || 0,
      repeatType: 'monthly',
      isPaid: !!bill.isPaid,
    }));
  }

  for (const sub of Array.isArray(member.subscriptions) ? member.subscriptions : []) {
    if (sub.cancelled || sub.isPaid) continue;
    const due = parseDate(sub.renewalDate);
    if (!due) continue;
    out.push(makeReminder('subscription', memberId, memberName, String(sub.id), sub.name || 'Subscription', due, {
      amount: Number(sub.amount) || 0,
      repeatType: sub.billingCycle === 'yearly' ? 'yearly' : 'monthly',
    }));
  }

  for (const task of Array.isArray(member.familyTasks) ? member.familyTasks : []) {
    if (task.completed) continue;
    if (!task.dueDate) continue;
    const due = parseDate(task.dueDate);
    if (!due) continue;
    out.push(makeReminder('task', memberId, memberName, String(task.id), task.title || task.name || 'Task', due));
  }

  for (const routine of Array.isArray(member.routines) ? member.routines : []) {
    if (routine.enabled === false) continue;
    if (!routine.time) continue;
    const due = resolveNextClockTime(routine.time, now);
    if (!due) continue;
    out.push(makeReminder('routine', memberId, memberName, String(routine.id), routine.title || routine.name || 'Routine', due, {
      repeatType: 'daily',
    }));
  }

  for (const checkin of Array.isArray(member.checkins) ? member.checkins : []) {
    if (checkin.enabled === false) continue;
    if (!checkin.time) continue;
    // Note: server does not yet filter by checkin.days (weekday selection) — matches
    // the current frontend projection, which also treats every check-in as daily (spec §3.2).
    const due = resolveNextClockTime(checkin.time, now);
    if (!due) continue;
    out.push(makeReminder('checkin', memberId, memberName, String(checkin.id), checkin.title || checkin.name || 'Check-in', due, {
      repeatType: 'daily',
    }));
  }

  for (const trip of Array.isArray(member.travelItems) ? member.travelItems : []) {
    if (trip.completed) continue;
    const due = parseDate(trip.date);
    if (!due) continue;
    out.push(makeReminder('travel', memberId, memberName, String(trip.id), trip.title || trip.name || 'Travel', due));
  }

  return out;
}

export function projectFamilyReminders(members: any[]): ProjectedFamilyReminder[] {
  return members.flatMap(projectMemberReminders);
}

export function notificationBody(title: string, daysBefore: number): string {
  if (daysBefore === 0) return `${title} is due today`;
  if (daysBefore === 1) return `${title} in 1 day`;
  return `${title} in ${daysBefore} days`;
}
