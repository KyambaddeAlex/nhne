import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type { AppData, SyncRecord } from '../../domain/models';
import { emptyAppData } from '../../domain/models';
import type { UserProfile } from '../../features/profile/profileStorage';
import { firestore } from './firebase';

type RecordCollection = Exclude<keyof AppData, 'profile'>;
type Collections = {
  [K in keyof AppData]: K;
};

const collections: Collections = {
  journalEntries: 'journalEntries',
  controlNotes: 'controlNotes',
  goals: 'goals',
  milestones: 'milestones',
  routines: 'routines',
  routineLogs: 'routineLogs',
  expenses: 'expenses',
  budgets: 'budgets',
};

function requireFirestore() {
  if (!firestore) {
    throw new Error('Cloud sync is not configured for this app.');
  }
  return firestore;
}

function mergeRecords<T extends SyncRecord>(local: T[], remote: T[]): T[] {
  const merged = new Map<string, T>();
  for (const record of local) merged.set(record.id, record);
  for (const record of remote) {
    const localRecord = merged.get(record.id);
    if (!localRecord || record.updatedAt >= localRecord.updatedAt) {
      merged.set(record.id, record);
    }
  }
  return [...merged.values()];
}

export function mergeAppData(local: AppData, remote: AppData): AppData {
  const mergedData: AppData = { ...emptyAppData };
  for (const key of Object.keys(collections) as RecordCollection[]) {
    const localRecords = local[key] as SyncRecord[];
    const remoteRecords = remote[key] as SyncRecord[];
    (mergedData[key] as SyncRecord[]) = mergeRecords(localRecords, remoteRecords);
  }
  const journalEntriesByDate = new Map<string, AppData['journalEntries'][number]>();
  for (const entry of mergedData.journalEntries) {
    const existing = journalEntriesByDate.get(entry.date);
    if (!existing || entry.updatedAt >= existing.updatedAt) {
      journalEntriesByDate.set(entry.date, { ...entry, id: entry.date });
    }
  }
  mergedData.journalEntries = [...journalEntriesByDate.values()];
  return mergedData;
}

async function writeInBatches(
  userId: string,
  collectionName: RecordCollection,
  records: SyncRecord[],
): Promise<void> {
  const db = requireFirestore();
  for (let start = 0; start < records.length; start += 450) {
    const batch = writeBatch(db);
    for (const record of records.slice(start, start + 450)) {
      batch.set(
        doc(db, 'users', userId, collectionName, record.id),
        record,
      );
    }
    await batch.commit();
  }
}

export async function syncAccountData(
  userId: string,
  localData: AppData,
  localProfile: UserProfile,
  localProfileUpdatedAt: string,
): Promise<{
  data: AppData;
  profile: UserProfile;
  profileUpdatedAt: string;
}> {
  const db = requireFirestore();
  const remoteData: AppData = { ...emptyAppData };
  for (const key of Object.keys(collections) as RecordCollection[]) {
    const remoteSnapshot = await getDocs(
      collection(db, 'users', userId, collections[key]),
    );
    const remoteRecords = remoteSnapshot.docs.map(
      (snapshot) => snapshot.data() as SyncRecord,
    );
    (remoteData[key] as SyncRecord[]) = remoteRecords;
    const remoteById = new Map(remoteRecords.map((record) => [record.id, record]));
    const recordsToUpload = (localData[key] as SyncRecord[]).filter((record) => {
      const remoteRecord = remoteById.get(record.id);
      return !remoteRecord || record.updatedAt > remoteRecord.updatedAt;
    });
    await writeInBatches(userId, key, recordsToUpload);
  }
  const mergedData = mergeAppData(localData, remoteData);

  const profileReference = doc(db, 'users', userId, 'profile', 'current');
  const remoteProfileSnapshot = await getDoc(profileReference);
  const remoteProfile = remoteProfileSnapshot.exists()
    ? remoteProfileSnapshot.data()
    : null;
  const remoteProfileUpdatedAt =
    typeof remoteProfile?.updatedAt === 'string' ? remoteProfile.updatedAt : '';
  const shouldUseRemoteProfile =
    remoteProfile && remoteProfileUpdatedAt >= localProfileUpdatedAt;
  const profile = shouldUseRemoteProfile
    ? (remoteProfile.profile as UserProfile)
    : localProfile;
  const profileUpdatedAt = shouldUseRemoteProfile
    ? remoteProfileUpdatedAt
    : localProfileUpdatedAt;

  const shouldUploadProfile =
    !remoteProfile || localProfileUpdatedAt > remoteProfileUpdatedAt;
  if (shouldUploadProfile) {
    await setDoc(profileReference, { profile, updatedAt: profileUpdatedAt });
  }

  return { data: mergedData, profile, profileUpdatedAt };
}

export async function saveCloudRecord<K extends RecordCollection>(
  userId: string,
  collectionName: K,
  record: AppData[K][number],
): Promise<void> {
  const db = requireFirestore();
  await setDoc(
    doc(db, 'users', userId, collectionName, record.id),
    record,
  );
}

export async function saveCloudProfile(
  userId: string,
  profile: UserProfile,
  updatedAt: string,
): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, 'users', userId, 'profile', 'current'), {
    profile,
    updatedAt,
  });
}
