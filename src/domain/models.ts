import type { UserProfile } from '../features/profile/profileStorage';

export type SyncRecord = {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type JournalEntry = SyncRecord & {
  date: string;
  morning: {
    priorities: [string, string, string];
    anticipatedChallenge: string;
  };
  evening: {
    habitCurbed: string;
    impulsiveMoment: string;
    improvementTomorrow: string;
  };
};

export type ControlNote = SyncRecord & {
  date?: string;
  situation: string;
  category: 'within' | 'outside';
};

export type Goal = SyncRecord & {
  title: string;
  description: string;
  horizonYears: 1 | 3 | 5;
  level: 'vision' | 'monthly' | 'daily';
  parentGoalId: string | null;
  targetDate: string | null;
  status: 'active' | 'completed' | 'paused';
};

export type Milestone = SyncRecord & {
  title: string;
  description: string;
  lessonLearned: string;
  achievedOn: string;
};

export type Routine = SyncRecord & {
  title: string;
  description: string;
  active: boolean;
};

export type RoutineLog = SyncRecord & {
  routineId: string;
  date: string;
  status: 'completed' | 'skipped';
  note: string | null;
};

export type Expense = SyncRecord & {
  amountMinor: number;
  currency: string;
  category: 'necessity' | 'growth' | 'impulse';
  description: string;
  spentOn: string;
};

export type Budget = SyncRecord & {
  month: string;
  capMinor: number;
  currency: string;
};

export type AppData = {
  journalEntries: JournalEntry[];
  controlNotes: ControlNote[];
  goals: Goal[];
  milestones: Milestone[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  expenses: Expense[];
  budgets: Budget[];
};

export type AccountSnapshot = {
  profile: UserProfile;
  profileUpdatedAt: string;
  data: AppData;
};

export const emptyAppData: AppData = {
  journalEntries: [],
  controlNotes: [],
  goals: [],
  milestones: [],
  routines: [],
  routineLogs: [],
  expenses: [],
  budgets: [],
};

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function createJournalEntry(date = localDateKey()): JournalEntry {
  if (!isValidDateKey(date)) {
    throw new Error('Journal date must be a real date in YYYY-MM-DD format.');
  }
  const timestamp = new Date().toISOString();
  return {
    id: date,
    date,
    morning: { priorities: ['', '', ''], anticipatedChallenge: '' },
    evening: { habitCurbed: '', impulsiveMoment: '', improvementTomorrow: '' },
    updatedAt: timestamp,
    deletedAt: null,
  };
}

export function createRecordId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function visibleRecords<T extends SyncRecord>(records: T[]): T[] {
  return records.filter((record) => record.deletedAt === null);
}
