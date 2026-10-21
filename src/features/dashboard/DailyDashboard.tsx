import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createRecordId,
  createJournalEntry,
  localDateKey,
  type ControlNote,
  type JournalEntry,
  type Routine,
  type RoutineLog,
} from '../../domain/models';
import { colors } from '../../components/Primitives';

type JournalTab = 'morning' | 'evening';
type ControlCategory = 'within' | 'outside';

function controlNoteDate(note: ControlNote): string {
  return note.date ?? localDateKey(new Date(note.updatedAt));
}

const palette = {
  background: '#F5F3EC',
  card: '#FFFFFF',
  ink: '#202A24',
  muted: '#72786F',
  green: '#274637',
  greenLight: '#EAF0E8',
  gold: '#D9B66F',
  line: '#E8E7DF',
  input: '#F8F8F4',
};

const morningPrompts = [
  'What are your three priorities?',
  'What challenge might arise, and how will you meet it?',
];

const eveningPrompts = [
  'What bad habit did you curb today?',
  'Where did you act impulsively or slip?',
  'How can you improve tomorrow?',
];

type DailyDashboardProps = {
  displayName: string;
  onOpenProfile: () => void;
  journalEntry: JournalEntry;
  journalEntries: JournalEntry[];
  controlNotes: ControlNote[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  onSaveJournal: (entry: JournalEntry) => void;
  onSaveControlNote: (note: ControlNote) => void;
  onSaveRoutineLog: (log: RoutineLog) => void;
  onSelectJournalDate: (date: string) => void;
};

export function DailyDashboard({
  displayName,
  onOpenProfile,
  journalEntry,
  journalEntries,
  controlNotes,
  routines,
  routineLogs,
  onSaveJournal,
  onSaveControlNote,
  onSaveRoutineLog,
  onSelectJournalDate,
}: DailyDashboardProps) {
  const [activeTab, setActiveTab] = useState<JournalTab>('morning');
  const [morningAnswers, setMorningAnswers] = useState([
    ...journalEntry.morning.priorities,
    journalEntry.morning.anticipatedChallenge,
  ]);
  const [eveningAnswers, setEveningAnswers] = useState([
    journalEntry.evening.habitCurbed,
    journalEntry.evening.impulsiveMoment,
    journalEntry.evening.improvementTomorrow,
  ]);
  const [situation, setSituation] = useState('');
  const [controlCategory, setControlCategory] = useState<ControlCategory>('within');
  const [hasEditedJournal, setHasEditedJournal] = useState(false);
  const journalDraft = useRef({
    date: journalEntry.date,
    morningAnswers,
    eveningAnswers,
    hasEditedJournal,
  });

  const formattedDate = new Date(`${journalEntry.date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    if (!hasEditedJournal) return;
    const timeout = setTimeout(() => {
      onSaveJournal({
        ...createJournalEntry(journalEntry.id),
        morning: {
          priorities: [
            morningAnswers[0] ?? '',
            morningAnswers[1] ?? '',
            morningAnswers[2] ?? '',
          ],
          anticipatedChallenge: morningAnswers[3] ?? '',
        },
        evening: {
          habitCurbed: eveningAnswers[0] ?? '',
          impulsiveMoment: eveningAnswers[1] ?? '',
          improvementTomorrow: eveningAnswers[2] ?? '',
        },
        updatedAt: new Date().toISOString(),
      });
    }, 650);

    return () => clearTimeout(timeout);
  }, [eveningAnswers, hasEditedJournal, journalEntry.id, morningAnswers, onSaveJournal]);

  function updateAnswer(index: number, value: string) {
    setHasEditedJournal(true);
    if (activeTab === 'morning') {
      setMorningAnswers((answers) =>
        answers.map((answer, answerIndex) => answerIndex === index ? value : answer),
      );
      return;
    }

    setEveningAnswers((answers) =>
      answers.map((answer, answerIndex) => answerIndex === index ? value : answer),
    );
  }

  const saveCurrentDraft = useCallback(() => {
    const draft = journalDraft.current;
    if (!draft.hasEditedJournal) return;
    onSaveJournal({
      ...createJournalEntry(draft.date),
      morning: {
        priorities: [
          draft.morningAnswers[0] ?? '',
          draft.morningAnswers[1] ?? '',
          draft.morningAnswers[2] ?? '',
        ],
        anticipatedChallenge: draft.morningAnswers[3] ?? '',
      },
      evening: {
        habitCurbed: draft.eveningAnswers[0] ?? '',
        impulsiveMoment: draft.eveningAnswers[1] ?? '',
        improvementTomorrow: draft.eveningAnswers[2] ?? '',
      },
      updatedAt: new Date().toISOString(),
    });
    journalDraft.current.hasEditedJournal = false;
  }, [onSaveJournal]);

  useEffect(() => {
    journalDraft.current = {
      date: journalEntry.date,
      morningAnswers,
      eveningAnswers,
      hasEditedJournal,
    };
  }, [eveningAnswers, hasEditedJournal, journalEntry.date, morningAnswers]);

  useEffect(() => () => saveCurrentDraft(), [journalEntry.date, saveCurrentDraft]);

  function sortSituation() {
    if (!situation.trim()) return;

    const timestamp = new Date().toISOString();
    onSaveControlNote({
      id: createRecordId(),
      date: journalEntry.date,
      situation: situation.trim(),
      category: controlCategory,
      updatedAt: timestamp,
      deletedAt: null,
    });
    setSituation('');
  }

  function logRoutine(routine: Routine, status: RoutineLog['status']) {
    const id = `${journalEntry.date}_${routine.id}`;
    const existingLog = routineLogs.find((log) => log.id === id);
    onSaveRoutineLog({
      id,
      routineId: routine.id,
      date: journalEntry.date,
      status,
      note: existingLog?.note ?? null,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    });
  }

  const withinCount = controlNotes.filter(
    (note) => note.deletedAt === null && controlNoteDate(note) === journalEntry.date && note.category === 'within',
  ).length;
  const outsideCount = controlNotes.filter(
    (note) => note.deletedAt === null && controlNoteDate(note) === journalEntry.date && note.category === 'outside',
  ).length;
  const recentEntries = journalEntries
    .filter((entry) => entry.date !== journalEntry.date && entry.deletedAt === null)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 5);
  const recentControlNotes = controlNotes
    .filter((note) => note.deletedAt === null && controlNoteDate(note) === journalEntry.date)
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 5);
  const practiceDates = new Set<string>();
  for (const entry of journalEntries) {
    const hasJournalContent = [
      ...entry.morning.priorities,
      entry.morning.anticipatedChallenge,
      entry.evening.habitCurbed,
      entry.evening.impulsiveMoment,
      entry.evening.improvementTomorrow,
    ].some((answer) => answer.trim().length > 0);
    if (entry.deletedAt === null && hasJournalContent) practiceDates.add(entry.date);
  }
  for (const note of controlNotes) {
    if (note.deletedAt === null) practiceDates.add(controlNoteDate(note));
  }
  for (const log of routineLogs) {
    if (log.deletedAt === null && log.status === 'completed') practiceDates.add(log.date);
  }
  const today = localDateKey();
  let streakDate = new Date(`${today}T12:00:00`);
  if (!practiceDates.has(today)) streakDate.setDate(streakDate.getDate() - 1);
  let streak = 0;
  while (practiceDates.has(localDateKey(streakDate))) {
    streak += 1;
    streakDate.setDate(streakDate.getDate() - 1);
  }
  const completedRoutineCount = routineLogs.filter(
    (log) => log.date === journalEntry.date && log.deletedAt === null && log.status === 'completed',
  ).length;
  const answeredJournalPrompts = [
    ...morningAnswers,
    ...eveningAnswers,
  ].filter((answer) => answer.trim().length > 0).length;
  const earlierDate = new Date(`${journalEntry.date}T12:00:00`);
  earlierDate.setDate(earlierDate.getDate() - 1);
  const laterDate = new Date(`${journalEntry.date}T12:00:00`);
  laterDate.setDate(laterDate.getDate() + 1);
  const canGoForward = journalEntry.date < localDateKey();
  const selectDate = (date: string) => {
    saveCurrentDraft();
    onSelectJournalDate(date);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>S</Text>
            </View>
            <Text style={styles.brandName}>THE DAILY SOVEREIGN</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.dateNav}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show previous day"
                onPress={() => selectDate(localDateKey(earlierDate))}
                style={styles.dateArrow}
              >
                <Text style={styles.dateArrowText}>‹</Text>
              </Pressable>
              <Text style={styles.date}>{formattedDate}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show next day"
                disabled={!canGoForward}
                onPress={() => selectDate(localDateKey(laterDate))}
                style={[styles.dateArrow, !canGoForward && styles.disabledDateArrow]}
              >
                <Text style={styles.dateArrowText}>›</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open your profile"
              onPress={onOpenProfile}
              style={styles.profileButton}
            >
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {displayName.trim() ? displayName.trim().slice(0, 1).toUpperCase() : 'S'}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.profileButtonText}>
                {displayName.trim() || 'Profile'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.intro}>
          <Text style={styles.eyebrow}>A PRACTICE FOR EVERY DAY</Text>
          <Text style={styles.heading}>Return to what{'\n'}you can control.</Text>
          <Text style={styles.introCopy}>
            {displayName.trim()
              ? `A little reflection for you, ${displayName.trim()}.`
              : 'A little reflection today. A steadier life over time.'}
          </Text>
        </View>

        <View style={styles.streakCard}>
          <View style={styles.streakAccent} />
          <View style={styles.streakCopy}>
            <Text style={styles.streakLabel}>YOUR PRACTICE STREAK</Text>
            <Text style={styles.streakValue}>{streak} {streak === 1 ? 'day' : 'days'}</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakMetric}>
            <Text style={styles.streakMetricValue}>{answeredJournalPrompts}/7</Text>
            <Text style={styles.streakMetricLabel}>journal prompts</Text>
          </View>
          <View style={styles.streakMetric}>
            <Text style={styles.streakMetricValue}>{completedRoutineCount}</Text>
            <Text style={styles.streakMetricLabel}>habits completed</Text>
          </View>
        </View>

        <View style={styles.quoteCard}>
          <View style={styles.quoteTopline}>
            <Text style={styles.quoteLabel}>TODAY&apos;S STOIC THOUGHT</Text>
            <View style={styles.quoteDot} />
          </View>
          <Text style={styles.quote}>
            “You have power over your mind—not outside events. Realize this,
            and you will find strength.”
          </Text>
          <Text style={styles.attribution}>MARCUS AURELIUS · MEDITATIONS</Text>
          <View style={styles.quoteRule} />
          <Text style={styles.reflectionLabel}>CARRY THIS WITH YOU</Text>
          <Text style={styles.reflection}>
            What is one thing you can give your attention to, and one thing you
            can let go of today?
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.eyebrow}>CHECK IN WITH YOURSELF</Text>
            <Text style={styles.sectionTitle}>Your daily journal</Text>
          </View>
          <Text style={styles.duration}>3 MIN</Text>
        </View>

        <View style={styles.journalCard}>
          <View style={styles.tabs} accessibilityRole="tablist">
            <TabButton
              label="Morning intention"
              selected={activeTab === 'morning'}
              onPress={() => setActiveTab('morning')}
            />
            <TabButton
              label="Evening audit"
              selected={activeTab === 'evening'}
              onPress={() => setActiveTab('evening')}
            />
          </View>

          {activeTab === 'morning' ? (
            <View style={styles.tabContent}>
              <Text style={styles.tabIntro}>
                Meet the day with intention, not expectation.
              </Text>
              <Text style={styles.fieldLabel}>YOUR TOP THREE PRIORITIES</Text>
              {[0, 1, 2].map((index) => (
                <View key={index} style={styles.priorityRow}>
                  <Text style={styles.priorityNumber}>0{index + 1}</Text>
                  <TextInput
                    accessibilityLabel={`Priority ${index + 1}`}
                    onChangeText={(value) => updateAnswer(index, value)}
                    placeholder={`A priority for today`}
                    placeholderTextColor={palette.muted}
                    style={styles.priorityInput}
                    value={morningAnswers[index]}
                  />
                </View>
              ))}
              <Text style={[styles.fieldLabel, styles.challengeLabel]}>
                PRAEMEDITATIO MALORUM
              </Text>
              <Text style={styles.fieldHint}>
                What might be difficult today? How will you respond with
                patience and good judgment?
              </Text>
              <TextInput
                accessibilityLabel={morningPrompts[1]}
                multiline
                onChangeText={(value) => updateAnswer(3, value)}
                placeholder="Think ahead, then meet the day as it comes…"
                placeholderTextColor={palette.muted}
                style={styles.multilineInput}
                textAlignVertical="top"
                value={morningAnswers[3]}
              />
            </View>
          ) : (
            <View style={styles.tabContent}>
              <Text style={styles.tabIntro}>
                Review the day honestly, and without judgment.
              </Text>
              {eveningPrompts.map((prompt, index) => (
                <View key={prompt} style={styles.eveningField}>
                  <Text style={styles.fieldLabel}>0{index + 1}</Text>
                  <Text style={styles.eveningPrompt}>{prompt}</Text>
                  <TextInput
                    accessibilityLabel={prompt}
                    multiline
                    onChangeText={(value) => updateAnswer(index, value)}
                    placeholder="Take a moment to reflect…"
                    placeholderTextColor={palette.muted}
                    style={styles.multilineInput}
                    textAlignVertical="top"
                    value={eveningAnswers[index]}
                  />
                </View>
              ))}
            </View>
          )}
          <Text style={styles.privacyNote}>
            Your reflections save automatically on this device. Sign in from your profile to sync them privately.
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.eyebrow}>A MOMENT OF CLARITY</Text>
            <Text style={styles.sectionTitle}>The dichotomy of control</Text>
          </View>
        </View>
        <View style={styles.controlCard}>
          <Text style={styles.controlCopy}>
            Name what is on your mind. Then choose where to place your energy.
          </Text>
          <TextInput
            accessibilityLabel="Situation on your mind"
            onChangeText={setSituation}
            placeholder="What's on your mind?"
            placeholderTextColor={palette.muted}
            style={styles.situationInput}
            value={situation}
          />
          <View style={styles.controlChoices}>
            <ChoiceButton
              label="Within my control"
              selected={controlCategory === 'within'}
              onPress={() => setControlCategory('within')}
            />
            <ChoiceButton
              label="Outside my control"
              selected={controlCategory === 'outside'}
              onPress={() => setControlCategory('outside')}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={sortSituation}
            style={({ pressed }) => [
              styles.sortButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.sortButtonText}>Place it in perspective</Text>
          </Pressable>
          {(withinCount > 0 || outsideCount > 0) && (
            <Text style={styles.sortedCount}>
              {withinCount} within your control · {outsideCount} to release
            </Text>
          )}
          {recentControlNotes.map((note) => (
            <View key={note.id} style={styles.noteRow}>
              <View style={[styles.noteDot, note.category === 'outside' && styles.outsideDot]} />
              <Text numberOfLines={2} style={styles.noteText}>{note.situation}</Text>
              <Text style={styles.noteCategory}>{note.category === 'within' ? 'KEEP' : 'RELEASE'}</Text>
            </View>
          ))}
        </View>

        <View style={styles.routineSection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.eyebrow}>SMALL PROMISES, KEPT</Text>
              <Text style={styles.sectionTitle}>Your daily routines</Text>
            </View>
          </View>
          <View style={styles.routineCard}>
            {routines.filter((routine) => routine.deletedAt === null && routine.active).length === 0 ? (
              <Text style={styles.routineEmpty}>
                Add a routine in Roadmap to track it here each day.
              </Text>
            ) : (
              routines
                .filter((routine) => routine.deletedAt === null && routine.active)
                .map((routine) => {
                  const log = routineLogs.find(
                    (item) => item.id === `${journalEntry.date}_${routine.id}` && item.deletedAt === null,
                  );
                  return (
                    <View key={routine.id} style={styles.routineRow}>
                      <View style={styles.routineDescription}>
                        <Text numberOfLines={1} style={styles.routineTitle}>{routine.title}</Text>
                        <Text numberOfLines={2} style={styles.routineStatus}>
                          {log?.status === 'completed'
                            ? 'Completed'
                            : log?.status === 'skipped'
                              ? 'Marked as skipped'
                              : 'Not logged'}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Mark ${routine.title} complete for ${journalEntry.date}`}
                        accessibilityState={{ selected: log?.status === 'completed' }}
                        onPress={() => logRoutine(routine, 'completed')}
                        style={[
                          styles.routineAction,
                          log?.status === 'completed' && styles.selectedRoutineAction,
                        ]}
                      >
                        <Text style={[
                          styles.routineActionText,
                          log?.status === 'completed' && styles.selectedRoutineActionText,
                        ]}>Done</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Mark ${routine.title} skipped for ${journalEntry.date}`}
                        accessibilityState={{ selected: log?.status === 'skipped' }}
                        onPress={() => logRoutine(routine, 'skipped')}
                        style={[
                          styles.routineAction,
                          log?.status === 'skipped' && styles.selectedRoutineAction,
                        ]}
                      >
                        <Text style={[
                          styles.routineActionText,
                          log?.status === 'skipped' && styles.selectedRoutineActionText,
                        ]}>Skip</Text>
                      </Pressable>
                    </View>
                  );
                })
            )}
          </View>
        </View>

        {recentEntries.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.eyebrow}>YOUR PRACTICE, OVER TIME</Text>
                <Text style={styles.sectionTitle}>Recent reflections</Text>
              </View>
            </View>
            {recentEntries.map((entry) => (
              <Pressable
                accessibilityRole="button"
                key={entry.id}
                onPress={() => selectDate(entry.date)}
                style={styles.historyCard}
              >
                <Text style={styles.historyDate}>
                  {new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <Text numberOfLines={1} style={styles.historyPriority}>
                  {entry.morning.priorities.find((priority) => priority.trim()) || 'Open this day’s reflection'}
                </Text>
                <Text style={styles.historyArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.footer}>PROGRESS, NOT PERFECTION.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type TabButtonProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function TabButton({ label, selected, onPress }: TabButtonProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tab, selected && styles.selectedTab]}
    >
      <Text style={[styles.tabText, selected && styles.selectedTabText]}>
        {label}
      </Text>
    </Pressable>
  );
}

type ChoiceButtonProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function ChoiceButton({ label, selected, onPress }: ChoiceButtonProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.selectedChoice]}
    >
      <Text style={[styles.choiceText, selected && styles.selectedChoiceText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  page: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 820,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 32 : 54,
    paddingBottom: 56,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 48,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dateArrow: { minWidth: 24, height: 34, alignItems: 'center', justifyContent: 'center' },
  disabledDateArrow: { opacity: 0.3 },
  dateArrowText: { color: palette.green, fontSize: 24, lineHeight: 28 },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  profileAvatar: {
    width: 27,
    height: 27,
    borderRadius: 10,
    backgroundColor: palette.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: palette.green,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'Georgia',
  },
  profileButtonText: {
    color: palette.green,
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 90,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: palette.card,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'Georgia',
  },
  brandName: {
    color: palette.green,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  date: {
    color: palette.muted,
    fontSize: 12,
  },
  intro: {
    marginBottom: 28,
  },
  eyebrow: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  heading: {
    color: palette.ink,
    fontSize: 42,
    lineHeight: 48,
    marginTop: 12,
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'Georgia',
    letterSpacing: -1,
  },
  introCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.card,
    padding: 16,
    marginBottom: 34,
  },
  streakAccent: {
    width: 4,
    height: 46,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  streakCopy: { minWidth: 76 },
  streakLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  streakValue: {
    color: colors.green,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  streakDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.line,
  },
  streakMetric: { flex: 1, alignItems: 'center' },
  streakMetricValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  streakMetricLabel: {
    color: colors.muted,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 4,
  },
  quoteCard: {
    backgroundColor: palette.green,
    borderRadius: 22,
    padding: 24,
    marginBottom: 38,
    shadowColor: '#183726',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  quoteTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  quoteLabel: {
    color: '#D9E0D7',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  quoteDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.gold,
  },
  quote: {
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 32,
    marginTop: 20,
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'Georgia',
    letterSpacing: -0.3,
  },
  attribution: {
    color: '#D9E0D7',
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 16,
  },
  quoteRule: {
    height: 1,
    backgroundColor: '#536B5A',
    marginVertical: 20,
  },
  reflectionLabel: {
    color: '#D9E0D7',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  reflection: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 21,
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'Georgia',
    marginTop: 6,
  },
  duration: {
    color: palette.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    paddingBottom: 3,
  },
  journalCard: {
    backgroundColor: palette.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 38,
    overflow: 'hidden',
    shadowColor: '#1F1F1A',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  tabs: {
    flexDirection: 'row',
    padding: 6,
    backgroundColor: '#F7F7F3',
    borderBottomWidth: 1,
    borderColor: palette.line,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  selectedTab: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
  },
  tabText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  selectedTabText: {
    color: palette.green,
  },
  tabContent: {
    padding: 20,
  },
  tabIntro: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
  },
  fieldLabel: {
    color: palette.green,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 9,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    minHeight: 46,
  },
  priorityNumber: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '700',
    width: 30,
  },
  priorityInput: {
    flex: 1,
    color: palette.ink,
    fontSize: 13,
    paddingVertical: 10,
  },
  challengeLabel: {
    marginTop: 22,
  },
  fieldHint: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 11,
  },
  multilineInput: {
    minHeight: 78,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    backgroundColor: palette.input,
    color: palette.ink,
    fontSize: 13,
    lineHeight: 19,
    padding: 12,
  },
  eveningField: {
    marginBottom: 19,
  },
  eveningPrompt: {
    color: palette.ink,
    fontSize: 14,
    marginBottom: 10,
    marginTop: -2,
  },
  privacyNote: {
    color: palette.muted,
    fontSize: 10,
    lineHeight: 15,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  controlCard: {
    backgroundColor: palette.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 20,
    shadowColor: '#1F1F1A',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  controlCopy: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  situationInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    backgroundColor: palette.input,
    paddingHorizontal: 12,
    fontSize: 13,
    color: palette.ink,
  },
  controlChoices: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  choice: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 8,
  },
  selectedChoice: {
    backgroundColor: palette.greenLight,
    borderColor: '#B6C7B5',
  },
  choiceText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedChoiceText: {
    color: palette.green,
  },
  sortButton: {
    backgroundColor: palette.green,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  sortButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.82,
  },
  sortedCount: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 12,
    textAlign: 'center',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: 10,
    marginTop: 10,
  },
  noteDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.green },
  outsideDot: { backgroundColor: palette.gold },
  noteText: { flex: 1, color: palette.ink, fontSize: 11, lineHeight: 16 },
  noteCategory: { color: palette.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
  routineSection: { marginTop: 30 },
  routineCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
  },
  routineEmpty: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 18,
  },
  routineRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  routineDescription: { flex: 1, minWidth: 72, paddingVertical: 9 },
  routineTitle: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  routineStatus: { color: colors.muted, fontSize: 9, marginTop: 4 },
  routineAction: {
    minWidth: 48,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: 8,
  },
  selectedRoutineAction: {
    backgroundColor: colors.greenLight,
    borderColor: '#B6C7B5',
  },
  routineActionText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  selectedRoutineActionText: { color: colors.green },
  historySection: { marginTop: 30 },
  historyCard: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    backgroundColor: palette.card,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  historyDate: { color: palette.green, fontSize: 10, fontWeight: '700', width: 65 },
  historyPriority: { color: palette.ink, fontSize: 12, flex: 1 },
  historyArrow: { color: palette.green, fontSize: 22 },
  footer: {
    color: palette.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.6,
    textAlign: 'center',
    marginTop: 38,
  },
});
