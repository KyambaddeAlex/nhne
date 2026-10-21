import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { User } from 'firebase/auth';
import { AccountScreen, type CloudStatus } from './src/features/auth/AccountScreen';
import { DailyDashboard } from './src/features/dashboard/DailyDashboard';
import { HistoryScreen } from './src/features/dashboard/HistoryScreen';
import { SpendingScreen } from './src/features/finance/SpendingScreen';
import { PlanScreen } from './src/features/roadmap/PlanScreen';
import {
  clearProfile,
  emptyProfile,
  loadProfile,
  loadProfileUpdatedAt,
  saveProfile,
  type UserProfile,
} from './src/features/profile/profileStorage';
import { ProfileScreen } from './src/features/profile/ProfileScreen';
import {
  loadAppData,
  saveAppData,
} from './src/features/storage/appDataStorage';
import {
  createJournalEntry,
  emptyAppData,
  isValidDateKey,
  localDateKey,
  type AppData,
  type SyncRecord,
} from './src/domain/models';
import {
  mergeAppData,
  saveCloudProfile,
  saveCloudRecord,
  syncAccountData,
} from './src/services/firebase/cloudSync';
import {
  auth,
  createAccount,
  isFirebaseConfigured,
  observeAccount,
  sendAccountPasswordReset,
  signInAccount,
  signOutAccount,
} from './src/services/firebase/firebase';
import { colors } from './src/components/Primitives';

type Screen = 'practice' | 'history' | 'roadmap' | 'spending' | 'profile' | 'account';
type DataCollection = keyof AppData;
type PendingQueue = Map<string, Promise<void>>;

function enqueue<T>(
  queues: PendingQueue,
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const result = previous.then(operation);
  queues.set(key, result.then(() => undefined, () => undefined));
  return result;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected storage error occurred.';
}

const navigationTabs: { key: Exclude<Screen, 'account'>; label: string; icon: string }[] = [
  { key: 'practice', label: 'Today', icon: 'T' },
  { key: 'history', label: 'History', icon: 'H' },
  { key: 'roadmap', label: 'Roadmap', icon: 'R' },
  { key: 'spending', label: 'Money', icon: '$' },
  { key: 'profile', label: 'Profile', icon: 'P' },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('practice');
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [profileUpdatedAt, setProfileUpdatedAt] = useState('1970-01-01T00:00:00.000Z');
  const [data, setData] = useState<AppData>({ ...emptyAppData });
  const [selectedJournalDate, setSelectedJournalDate] = useState(localDateKey);
  const [account, setAccount] = useState<User | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(
    !isFirebaseConfigured || !auth,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(
    isFirebaseConfigured ? 'signed-out' : 'device-only',
  );
  const [cloudError, setCloudError] = useState<string | null>(null);
  const currentUser = useRef<User | null>(null);
  const currentScope = useRef('local');
  const latestSnapshot = useRef({
    profile,
    profileUpdatedAt,
    data,
  });
  const localQueues = useRef<PendingQueue>(new Map());
  const cloudQueues = useRef<PendingQueue>(new Map());

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      return;
    }

    return observeAccount(
      (user) => {
        currentUser.current = user;
        currentScope.current = user?.uid ?? 'local';
        setSelectedJournalDate(localDateKey());
        setIsLoading(true);
        setAccount(user);
        setCloudError(null);
        setIsAuthResolved(true);
      },
      (error) => {
        setCloudError(errorMessage(error));
        setCloudStatus('error');
        setIsAuthResolved(true);
      },
    );
  }, []);

  const syncNow = useCallback(async () => {
    const user = currentUser.current;
    if (!user) {
      setCloudStatus(isFirebaseConfigured ? 'signed-out' : 'device-only');
      return;
    }

    setCloudStatus('syncing');
    setCloudError(null);
    try {
      await enqueue(cloudQueues.current, user.uid, async () => {
        const local = latestSnapshot.current;
        const result = await syncAccountData(
          user.uid,
          local.data,
          local.profile,
          local.profileUpdatedAt,
        );
        const latest = latestSnapshot.current;
        const nextData = mergeAppData(result.data, latest.data);
        const preferLatestProfile =
          latest.profileUpdatedAt >= result.profileUpdatedAt;
        const nextProfile = preferLatestProfile ? latest.profile : result.profile;
        const nextProfileUpdatedAt = preferLatestProfile
          ? latest.profileUpdatedAt
          : result.profileUpdatedAt;
        await Promise.all([
          saveAppData(nextData, user.uid),
          saveProfile(nextProfile, user.uid, nextProfileUpdatedAt),
        ]);
        if (currentUser.current?.uid !== user.uid) return;
        latestSnapshot.current = {
          profile: nextProfile,
          profileUpdatedAt: nextProfileUpdatedAt,
          data: nextData,
        };
        setProfile(nextProfile);
        setProfileUpdatedAt(nextProfileUpdatedAt);
        setData(nextData);
      });
      if (currentUser.current?.uid === user.uid) {
        setCloudStatus('synced');
        setCloudError(null);
      }
    } catch (error) {
      if (currentUser.current?.uid === user.uid) {
        setCloudStatus('error');
        setCloudError(`Cloud sync failed: ${errorMessage(error)}`);
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthResolved) return;
    let isCurrent = true;
    const scope = account?.uid ?? 'local';
    currentScope.current = scope;

    async function loadCurrentSpace() {
      try {
        const [storedProfile, storedProfileUpdatedAt, storedData] = await Promise.all([
          loadProfile(scope),
          loadProfileUpdatedAt(scope),
          loadAppData(scope),
        ]);
        if (!isCurrent) return;
        latestSnapshot.current = {
          profile: storedProfile,
          profileUpdatedAt: storedProfileUpdatedAt,
          data: storedData,
        };
        setProfile(storedProfile);
        setProfileUpdatedAt(storedProfileUpdatedAt);
        setData(storedData);
        setIsLoading(false);

        if (account?.uid) {
          setCloudStatus('syncing');
          void syncNow();
        } else {
          setCloudStatus(isFirebaseConfigured ? 'signed-out' : 'device-only');
        }
      } catch (error) {
        if (!isCurrent) return;
        setStorageError(errorMessage(error));
        setIsLoading(false);
      }
    }

    void loadCurrentSpace();
    return () => {
      isCurrent = false;
    };
  }, [account?.uid, isAuthResolved, loadAttempt, syncNow]);

  const updateRecord = useCallback(
    <K extends DataCollection>(collection: K, record: AppData[K][number]) => {
      const scope = currentScope.current;
      const userId = currentUser.current?.uid ?? null;
      const existingRecords = latestSnapshot.current.data[collection] as SyncRecord[];
      const nextRecords = [
        ...existingRecords.filter((existing) => existing.id !== record.id),
        record as SyncRecord,
      ];
      const nextData = {
        ...latestSnapshot.current.data,
        [collection]: nextRecords,
      } as AppData;
      latestSnapshot.current = { ...latestSnapshot.current, data: nextData };
      setData(nextData);

      void enqueue(localQueues.current, scope, async () => {
        let localSaved = false;
        try {
          await saveAppData(nextData, scope);
          localSaved = true;
          if (userId) {
            setCloudStatus('syncing');
            await enqueue(cloudQueues.current, userId, () =>
              saveCloudRecord(userId, collection, record),
            );
            if (currentUser.current?.uid === userId) {
              setCloudStatus('synced');
              setCloudError(null);
            }
          }
        } catch (error) {
          if (localSaved && userId) {
            if (currentUser.current?.uid === userId) {
              setCloudStatus('error');
              setCloudError(`Saved on this device; cloud sync failed: ${errorMessage(error)}`);
            }
          } else if (currentScope.current === scope) {
            setStorageError(`Your change could not be saved: ${errorMessage(error)}`);
          }
        }
      });
    },
    [],
  );

  const saveProfileChanges = useCallback(async (nextProfile: UserProfile) => {
    const scope = currentScope.current;
    const userId = currentUser.current?.uid ?? null;
    const updatedAt = new Date().toISOString();
    latestSnapshot.current = {
      ...latestSnapshot.current,
      profile: nextProfile,
      profileUpdatedAt: updatedAt,
    };
    setProfile(nextProfile);
    setProfileUpdatedAt(updatedAt);
    setStorageError(null);
    try {
      await enqueue(localQueues.current, scope, async () => {
        await saveProfile(nextProfile, scope, updatedAt);
      });
    } catch (error) {
      setStorageError(`Your profile could not be saved: ${errorMessage(error)}`);
      return false;
    }

    if (userId) {
      setCloudStatus('syncing');
      try {
        await enqueue(cloudQueues.current, userId, () =>
          saveCloudProfile(userId, nextProfile, updatedAt),
        );
        if (currentUser.current?.uid === userId) {
          setCloudStatus('synced');
          setCloudError(null);
        }
      } catch (error) {
        if (currentUser.current?.uid === userId) {
          setCloudStatus('error');
          setCloudError(`Profile saved on this device; cloud sync failed: ${errorMessage(error)}`);
        }
      }
    }
    return true;
  }, []);

  const clearSavedProfile = useCallback(async () => {
    const scope = currentScope.current;
    const userId = currentUser.current?.uid ?? null;
    const updatedAt = new Date().toISOString();
    const clearedProfile = { ...emptyProfile };
    latestSnapshot.current = {
      ...latestSnapshot.current,
      profile: clearedProfile,
      profileUpdatedAt: updatedAt,
    };
    setProfile(clearedProfile);
    setProfileUpdatedAt(updatedAt);
    setStorageError(null);

    try {
      await enqueue(localQueues.current, scope, async () => {
        await clearProfile(scope);
        await saveProfile(clearedProfile, scope, updatedAt);
      });
    } catch (error) {
      setStorageError(`Your profile could not be cleared: ${errorMessage(error)}`);
      return false;
    }

    if (userId) {
      setCloudStatus('syncing');
      try {
        await enqueue(cloudQueues.current, userId, () =>
          saveCloudProfile(userId, clearedProfile, updatedAt),
        );
        setCloudStatus('synced');
        setCloudError(null);
      } catch (error) {
        setCloudStatus('error');
        setCloudError(`Profile cleared on this device; cloud sync failed: ${errorMessage(error)}`);
      }
    }
    return true;
  }, []);

  const saveJournal = useCallback(
    (entry: AppData['journalEntries'][number]) =>
      updateRecord('journalEntries', { ...entry, id: entry.date }),
    [updateRecord],
  );
  const saveControlNote = useCallback(
    (note: AppData['controlNotes'][number]) => updateRecord('controlNotes', note),
    [updateRecord],
  );
  const saveGoal = useCallback(
    (goal: AppData['goals'][number]) => updateRecord('goals', goal),
    [updateRecord],
  );
  const saveRoutine = useCallback(
    (routine: AppData['routines'][number]) => updateRecord('routines', routine),
    [updateRecord],
  );
  const saveMilestone = useCallback(
    (milestone: AppData['milestones'][number]) => updateRecord('milestones', milestone),
    [updateRecord],
  );
  const saveRoutineLog = useCallback(
    (log: AppData['routineLogs'][number]) => updateRecord('routineLogs', log),
    [updateRecord],
  );
  const saveExpense = useCallback(
    (expense: AppData['expenses'][number]) => updateRecord('expenses', expense),
    [updateRecord],
  );
  const saveBudget = useCallback(
    (budget: AppData['budgets'][number]) => updateRecord('budgets', budget),
    [updateRecord],
  );

  const openJournalDate = useCallback((date: string) => {
    if (!isValidDateKey(date) || date > localDateKey()) {
      setStorageError('That journal date is invalid or in the future.');
      return;
    }
    setSelectedJournalDate(date);
    setScreen('practice');
  }, []);

  const todayEntry =
    data.journalEntries.find(
      (entry) => entry.date === selectedJournalDate && entry.deletedAt === null,
    ) ?? createJournalEntry(selectedJournalDate);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.green} />
        <Text style={styles.loadingText}>Opening your private space…</Text>
      </View>
    );
  }

  if (storageError && !data.journalEntries.length && !data.goals.length && !data.expenses.length) {
    return (
      <View style={styles.errorScreen}>
        <StatusBar style="dark" />
        <Text style={styles.errorTitle}>Your private space is unavailable</Text>
        <Text style={styles.errorCopy}>{storageError}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setStorageError(null);
            setIsLoading(true);
            setLoadAttempt((attempt) => attempt + 1);
          }}
        >
          <Text style={styles.retry}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {screen === 'practice' && (
          <DailyDashboard
            key={todayEntry.id}
            displayName={profile.preferredName}
            journalEntry={todayEntry}
            journalEntries={data.journalEntries}
            controlNotes={data.controlNotes}
            routines={data.routines}
            routineLogs={data.routineLogs}
            onSaveJournal={saveJournal}
            onSaveControlNote={saveControlNote}
            onSaveRoutineLog={saveRoutineLog}
            onSelectJournalDate={openJournalDate}
            onOpenProfile={() => setScreen('profile')}
          />
        )}
        {screen === 'history' && (
          <HistoryScreen
            journalEntries={data.journalEntries}
            controlNotes={data.controlNotes}
            routineLogs={data.routineLogs}
            onBack={() => {
              setSelectedJournalDate(localDateKey());
              setScreen('practice');
            }}
            onOpenDate={openJournalDate}
          />
        )}
        {screen === 'roadmap' && (
          <PlanScreen
            goals={data.goals}
            routines={data.routines}
            milestones={data.milestones}
            routineLogs={data.routineLogs}
            onSaveGoal={saveGoal}
            onSaveRoutine={saveRoutine}
            onSaveMilestone={saveMilestone}
            onSaveRoutineLog={saveRoutineLog}
          />
        )}
        {screen === 'spending' && (
          <SpendingScreen
            expenses={data.expenses}
            budgets={data.budgets}
            profile={profile}
            onSaveExpense={saveExpense}
            onSaveBudget={saveBudget}
          />
        )}
        {screen === 'profile' && (
          <ProfileScreen
            key={account?.uid ?? 'local'}
            initialProfile={profile}
            storageError={storageError}
            accountEmail={account?.email ?? null}
            cloudStatus={cloudStatusLabel(cloudStatus)}
            onBack={() => setScreen('practice')}
            onOpenAccount={() => setScreen('account')}
            onClear={clearSavedProfile}
            onSave={saveProfileChanges}
          />
        )}
        {screen === 'account' && (
          <AccountScreen
            account={account}
            configured={isFirebaseConfigured}
            status={cloudStatus}
            errorMessage={cloudError}
            onBack={() => setScreen('profile')}
            onCreateAccount={createAccount}
            onSignIn={signInAccount}
            onPasswordReset={sendAccountPasswordReset}
            onSignOut={signOutAccount}
            onSyncNow={syncNow}
          />
        )}
      </View>
      {storageError && (
        <View accessibilityRole="alert" style={styles.notice}>
          <Text style={styles.noticeText}>{storageError}</Text>
        </View>
      )}
      {cloudError && screen !== 'account' && (
        <View accessibilityRole="alert" style={styles.notice}>
          <Text style={styles.noticeText}>{cloudError}</Text>
        </View>
      )}
      {screen !== 'account' && (
        <NavigationBar
          screen={screen}
          onSelect={(nextScreen) => {
            if (nextScreen === 'practice') setSelectedJournalDate(localDateKey());
            setScreen(nextScreen);
          }}
        />
      )}
    </View>
  );
}

function cloudStatusLabel(status: CloudStatus): string {
  switch (status) {
    case 'syncing': return 'Syncing changes…';
    case 'synced': return 'Changes are up to date.';
    case 'error': return 'Some changes need to sync.';
    case 'device-only': return 'Saved on this device.';
    case 'signed-out': return 'Sign in to sync.';
  }
}

function NavigationBar({
  screen,
  onSelect,
}: {
  screen: Screen;
  onSelect: (screen: Screen) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.navigation}>
      {navigationTabs.map((tab) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: screen === tab.key }}
          key={tab.key}
          onPress={() => onSelect(tab.key)}
          style={styles.navigationItem}
        >
          <View style={[styles.navigationIcon, screen === tab.key && styles.activeNavigationIcon]}>
            <Text style={[styles.navigationIconText, screen === tab.key && styles.activeNavigationIconText]}>
              {tab.icon}
            </Text>
          </View>
          <Text style={[styles.navigationLabel, screen === tab.key && styles.activeNavigationLabel]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: colors.background,
  },
  loadingText: { color: colors.muted, fontSize: 13 },
  errorScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: colors.background,
  },
  errorTitle: { color: colors.ink, fontSize: 23, textAlign: 'center', fontFamily: 'Georgia' },
  errorCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12, maxWidth: 380 },
  retry: { color: colors.green, fontSize: 14, fontWeight: '700', marginTop: 20, padding: 10 },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    minHeight: 68,
    paddingTop: 7,
    paddingBottom: 7,
    paddingHorizontal: 8,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  navigationItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navigationIcon: {
    width: 27,
    height: 27,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  activeNavigationIcon: { backgroundColor: colors.greenLight },
  navigationIconText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  activeNavigationIconText: { color: colors.green },
  navigationLabel: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  activeNavigationLabel: { color: colors.green, fontWeight: '700' },
  notice: { backgroundColor: '#FFF5E8', borderTopWidth: 1, borderTopColor: '#E9D5B7', padding: 10 },
  noticeText: { color: '#6B512A', fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
