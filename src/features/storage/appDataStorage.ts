import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  emptyAppData,
  isValidDateKey,
  type AppData,
} from '../../domain/models';

const STORAGE_KEY = 'daily-sovereign.app-data.v1';

function storageKey(scope: string): string {
  return scope === 'local' ? STORAGE_KEY : `${STORAGE_KEY}.${scope}`;
}

function getBrowserStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  if (typeof globalThis.localStorage === 'undefined') {
    throw new Error('Browser storage is unavailable.');
  }
  return globalThis.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeAppData(value: unknown): AppData {
  if (!isRecord(value)) {
    throw new Error('Saved app data has an invalid format.');
  }

  const listKeys = Object.keys(emptyAppData) as (keyof AppData)[];
  for (const key of listKeys) {
    if (value[key] !== undefined && !Array.isArray(value[key])) {
      throw new Error(`Saved ${key} data has an invalid format.`);
    }
  }

  const journalEntries = (value.journalEntries as AppData['journalEntries'] | undefined) ?? [];
  for (const entry of journalEntries) {
    if (!isRecord(entry) || typeof entry.date !== 'string' || !isValidDateKey(entry.date)) {
      throw new Error('Saved journal data contains an invalid date.');
    }
  }

  const controlNotes = (value.controlNotes as AppData['controlNotes'] | undefined) ?? [];
  for (const note of controlNotes) {
    if (!isRecord(note) || (
      note.date !== undefined &&
      (typeof note.date !== 'string' || !isValidDateKey(note.date))
    )) {
      throw new Error('Saved control note data contains an invalid date.');
    }
  }

  const routineLogs = (value.routineLogs as AppData['routineLogs'] | undefined) ?? [];
  for (const log of routineLogs) {
    if (!isRecord(log) || typeof log.date !== 'string' || !isValidDateKey(log.date)) {
      throw new Error('Saved routine log data contains an invalid date.');
    }
  }

  const journalEntriesByDate = new Map<string, AppData['journalEntries'][number]>();
  for (const entry of journalEntries) {
    const existing = journalEntriesByDate.get(entry.date);
    if (!existing || entry.updatedAt >= existing.updatedAt) {
      journalEntriesByDate.set(entry.date, { ...entry, id: entry.date });
    }
  }

  return {
    journalEntries: [...journalEntriesByDate.values()],
    controlNotes,
    goals: (value.goals as AppData['goals'] | undefined) ?? [],
    milestones: (value.milestones as AppData['milestones'] | undefined) ?? [],
    routines: (value.routines as AppData['routines'] | undefined) ?? [],
    routineLogs,
    expenses: (value.expenses as AppData['expenses'] | undefined) ?? [],
    budgets: (value.budgets as AppData['budgets'] | undefined) ?? [],
  };
}

export async function loadAppData(scope = 'local'): Promise<AppData> {
  const browserStorage = getBrowserStorage();
  const serialized = browserStorage
    ? browserStorage.getItem(storageKey(scope))
    : await AsyncStorage.getItem(storageKey(scope));
  if (!serialized) return { ...emptyAppData };

  try {
    return normalizeAppData(JSON.parse(serialized));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Saved app data could not be parsed.');
    }
    throw error;
  }
}

export async function saveAppData(data: AppData, scope = 'local'): Promise<void> {
  const serialized = JSON.stringify(normalizeAppData(data));
  const browserStorage = getBrowserStorage();
  if (browserStorage) {
    browserStorage.setItem(storageKey(scope), serialized);
    return;
  }
  await AsyncStorage.setItem(storageKey(scope), serialized);
}
