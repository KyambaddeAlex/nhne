import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../components/Primitives';
import {
  isValidDateKey,
  localDateKey,
  type ControlNote,
  type JournalEntry,
  type RoutineLog,
} from '../../domain/models';

type HistoryScreenProps = {
  journalEntries: JournalEntry[];
  controlNotes: ControlNote[];
  routineLogs: RoutineLog[];
  onBack: () => void;
  onOpenDate: (date: string) => void;
};

function noteDate(note: ControlNote): string {
  return note.date ?? localDateKey(new Date(note.updatedAt));
}

function journalAnswerCount(entry: JournalEntry | undefined): number {
  if (!entry) return 0;
  return [
    ...entry.morning.priorities,
    entry.morning.anticipatedChallenge,
    entry.evening.habitCurbed,
    entry.evening.impulsiveMoment,
    entry.evening.improvementTomorrow,
  ].filter((answer) => answer.trim().length > 0).length;
}

export function HistoryScreen({
  journalEntries,
  controlNotes,
  routineLogs,
  onBack,
  onOpenDate,
}: HistoryScreenProps) {
  const days = useMemo(() => {
    const today = localDateKey();
    const dateKeys = new Set<string>();
    const firstRecentDay = new Date(`${today}T12:00:00`);
    firstRecentDay.setDate(firstRecentDay.getDate() - 29);
    for (let day = new Date(firstRecentDay); localDateKey(day) <= today; day.setDate(day.getDate() + 1)) {
      dateKeys.add(localDateKey(day));
    }

    for (const entry of journalEntries) {
      if (entry.deletedAt === null && isValidDateKey(entry.date) && entry.date <= today) {
        dateKeys.add(entry.date);
      }
    }
    for (const note of controlNotes) {
      const date = noteDate(note);
      if (note.deletedAt === null && isValidDateKey(date) && date <= today) dateKeys.add(date);
    }
    for (const log of routineLogs) {
      if (log.deletedAt === null && isValidDateKey(log.date) && log.date <= today) {
        dateKeys.add(log.date);
      }
    }

    return [...dateKeys].sort((left, right) => right.localeCompare(left)).map((date) => {
      const journal = journalEntries
        .filter((entry) => entry.date === date && entry.deletedAt === null)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
      const notes = controlNotes.filter(
        (note) => note.deletedAt === null && noteDate(note) === date,
      ).length;
      const logs = routineLogs.filter(
        (log) => log.deletedAt === null && log.date === date,
      );
      const completedHabits = logs.filter((log) => log.status === 'completed').length;
      const answered = journalAnswerCount(journal);

      return {
        date,
        journalAnswers: answered,
        notes,
        completedHabits,
        hasPractice: answered > 0 || notes > 0 || logs.length > 0,
      };
    });
  }, [controlNotes, journalEntries, routineLogs]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to today's practice"
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>TODAY&apos;S PRACTICE</Text>
        </Pressable>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>YOUR PRACTICE, OVER TIME</Text>
          <Text style={styles.title}>Daily history</Text>
          <Text style={styles.description}>
            Revisit a day to read or update its journal, control notes, and habit log.
          </Text>
        </View>

        {days.map((day) => {
          const date = new Date(`${day.date}T12:00:00`);
          const isToday = day.date === localDateKey();
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${date.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })} record`}
              key={day.date}
              onPress={() => onOpenDate(day.date)}
              style={({ pressed }) => [styles.dayCard, pressed && styles.pressed]}
            >
              <View style={styles.dateColumn}>
                <Text style={styles.weekday}>
                  {date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}
                </Text>
                <Text style={styles.dayNumber}>{date.getDate()}</Text>
                <Text style={styles.monthYear}>
                  {date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.dayContent}>
                <View style={styles.dayTitleRow}>
                  <Text style={styles.dayTitle}>{isToday ? 'Today' : 'Daily reflection'}</Text>
                  <View style={[styles.statusDot, day.hasPractice && styles.activeStatusDot]} />
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText}>Journal {day.journalAnswers}/7</Text>
                  <Text style={styles.summaryText}>Clarity {day.notes}</Text>
                  <Text style={styles.summaryText}>Habits {day.completedHabits}</Text>
                </View>
                <Text style={styles.statusText}>
                  {day.hasPractice ? 'Practice recorded' : 'No record yet · tap to begin'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 820,
    paddingHorizontal: 22,
    paddingTop: 38,
    paddingBottom: 36,
  },
  backButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 26,
  },
  backArrow: { color: colors.green, fontSize: 27 },
  backText: { color: colors.green, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  heading: { marginBottom: 22 },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 34, fontFamily: 'Georgia', marginTop: 7 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  dayCard: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 14,
    marginBottom: 9,
  },
  pressed: { opacity: 0.78 },
  dateColumn: { width: 58, alignItems: 'center' },
  weekday: { color: colors.muted, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  dayNumber: { color: colors.green, fontSize: 24, fontWeight: '700', marginTop: 1 },
  monthYear: { color: colors.muted, fontSize: 8, marginTop: 1 },
  dayContent: { flex: 1, marginLeft: 12 },
  dayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  dayTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
  activeStatusDot: { backgroundColor: colors.green },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryText: { color: colors.muted, fontSize: 9 },
  statusText: { color: colors.green, fontSize: 9, marginTop: 7 },
  chevron: { color: colors.green, fontSize: 24, marginLeft: 8 },
});
