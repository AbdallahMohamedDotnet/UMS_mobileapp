import React, { useCallback } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AnimatedPressable, ProgressTrack } from '@/components/Motion';
import { SUBJECTS, WEEK_DAYS } from '@/constants/attendance';

export const CalendarPage = React.memo(function CalendarPage() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.innerPage}>
      <Text style={styles.pageIntro}>
        A focused view of classes, deadlines, and the small spaces between them.
      </Text>
      <View style={styles.calendarMonth}>
        <View style={styles.calendarMonthHeader}>
          <Text style={styles.calendarMonthTitle}>May 2026</Text>
          <Feather name="chevron-down" size={17} color={colors.mutedForeground} />
        </View>
        {WEEK_DAYS.slice(0, 5).map((day, index) => (
          <AnimatedEntrance key={day.day} delay={80 + index * 60} distance={12}>
            <AnimatedPressable
              accessibilityLabel={`${day.day} ${day.date}: ${day.classes[0]?.title ?? 'open study day'}`}
              pressedScale={0.985}
              haptic="selection"
              style={styles.calendarListRow}
            >
              <View style={styles.calendarDate}>
                <Text style={styles.calendarDay}>{day.day}</Text>
                <Text style={styles.calendarDateNumber}>{day.date}</Text>
              </View>
              <View style={styles.calendarEventCopy}>
                <Text style={styles.calendarEventTitle} numberOfLines={1}>
                  {day.classes[0]?.title || 'Open study day'}
                </Text>
                <Text style={styles.calendarEventMeta}>
                  {day.classes[0]
                    ? `${day.classes[0].time} · ${day.classes[0].room}`
                    : 'No scheduled sessions'}
                </Text>
              </View>
              <View style={styles.calendarEventDot} />
            </AnimatedPressable>
          </AnimatedEntrance>
        ))}
      </View>
    </View>
  );
});

const LETTER_GRADES = ['A-', 'B+', 'A'];

export const GradesPage = React.memo(function GradesPage() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.innerPage}>
      <Text style={styles.pageIntro}>Your academic pulse, without the spreadsheet feeling.</Text>
      <AnimatedEntrance delay={70} distance={16}>
        <View style={styles.gradeHero}>
          <Text style={styles.gradeHeroLabel}>CURRENT CUMULATIVE GPA</Text>
          <Text style={styles.gradeHeroValue}>3.71</Text>
          {/* Fills from zero on mount, so the number and the bar arrive together. */}
          <ProgressTrack progress={0.78} style={styles.gradeBar} fillStyle={styles.gradeBarFill} />
          <Text style={styles.gradeHeroMeta}>Strong term · 78% of the way to your target</Text>
        </View>
      </AnimatedEntrance>
      {SUBJECTS.map((subject, index) => (
        <AnimatedEntrance key={subject.code} delay={150 + index * 70} distance={12}>
          <AnimatedPressable
            accessibilityLabel={`${subject.title}, grade ${LETTER_GRADES[index]}`}
            pressedScale={0.985}
            haptic="selection"
            style={styles.gradeRow}
          >
            <View style={[styles.gradeIcon, { backgroundColor: colors[subject.color] }]}>
              <Feather name={subject.icon} size={16} color={colors.primaryForeground} />
            </View>
            <View style={styles.gradeCopy}>
              <Text style={styles.gradeTitle} numberOfLines={1}>
                {subject.title}
              </Text>
              <Text style={styles.gradeMeta}>
                {subject.code} · {subject.progress}% complete
              </Text>
            </View>
            <Text style={styles.gradeValue}>{LETTER_GRADES[index]}</Text>
          </AnimatedPressable>
        </AnimatedEntrance>
      ))}
    </View>
  );
});

const SETTINGS_ROWS: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
}[] = [
  { icon: 'user', title: 'Profile', subtitle: 'Student details and program' },
  { icon: 'bell', title: 'Notifications', subtitle: 'Deadlines and class reminders' },
  { icon: 'shield', title: 'Privacy', subtitle: 'Selfie verification controls' },
  { icon: 'help-circle', title: 'Help center', subtitle: 'Find an answer quickly' },
];

export const SettingsPage = React.memo(function SettingsPage({
  isDemoMode,
}: {
  isDemoMode: boolean;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.innerPage}>
      <Text style={styles.pageIntro}>Make campus engine feel like yours.</Text>
      <View style={styles.settingsCard}>
        {SETTINGS_ROWS.map((row, index) => (
          <SettingsRow key={row.title} row={row} index={index} />
        ))}
      </View>
      <AnimatedEntrance delay={360} distance={12}>
        <View style={styles.accountNote}>
          <Text style={styles.accountNoteLabel}>
            {isDemoMode ? 'DEMO ACCOUNT' : 'ACCOUNT STATUS'}
          </Text>
          <Text style={styles.accountNoteText}>
            {isDemoMode
              ? 'Exploring with sample student data.'
              : 'Signed in and syncing securely.'}
          </Text>
        </View>
      </AnimatedEntrance>
    </View>
  );
});

const SettingsRow = React.memo(function SettingsRow({
  row,
  index,
}: {
  row: (typeof SETTINGS_ROWS)[number];
  index: number;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  const handlePress = useCallback(() => {
    Alert.alert(row.title, row.subtitle);
  }, [row.subtitle, row.title]);

  return (
    <AnimatedEntrance delay={90 + index * 60} distance={12}>
      <AnimatedPressable
        testID={`settings-${row.title.toLowerCase().replace(' ', '-')}`}
        accessibilityRole="button"
        accessibilityLabel={`${row.title}: ${row.subtitle}`}
        onPress={handlePress}
        pressedScale={0.985}
        style={styles.settingsRow}
      >
        <View style={styles.settingsIcon}>
          <Feather name={row.icon} size={17} color={colors.primary} />
        </View>
        <View style={styles.settingsCopy}>
          <Text style={styles.settingsTitle}>{row.title}</Text>
          <Text style={styles.settingsSubtitle}>{row.subtitle}</Text>
        </View>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </AnimatedPressable>
    </AnimatedEntrance>
  );
});

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    innerPage: { paddingTop: 6 },
    pageIntro: { color: colors.mutedForeground, fontSize: 14, lineHeight: 22, fontFamily: 'Inter_400Regular', marginBottom: 22, maxWidth: 320 },
    calendarMonth: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14 },
    calendarMonthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    calendarMonthTitle: { color: colors.foreground, fontSize: 15, fontFamily: 'Inter_700Bold' },
    calendarListRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
    calendarDate: { width: 44, alignItems: 'center' },
    calendarDay: { color: colors.mutedForeground, fontSize: 9, letterSpacing: 1, fontFamily: 'Inter_700Bold' },
    calendarDateNumber: { color: colors.foreground, fontSize: 17, fontFamily: 'Inter_700Bold', marginTop: 2 },
    calendarEventCopy: { flex: 1 },
    calendarEventTitle: { color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    calendarEventMeta: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
    calendarEventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    gradeHero: { borderRadius: 20, padding: 18, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, marginBottom: 18 },
    gradeHeroLabel: { color: colors.mutedForeground, fontSize: 9, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
    gradeHeroValue: { color: colors.foreground, fontSize: 40, lineHeight: 46, fontFamily: 'Inter_700Bold', marginTop: 6 },
    gradeBar: { height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden', marginTop: 12 },
    gradeBarFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
    gradeHeroMeta: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 10 },
    gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    gradeIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    gradeCopy: { flex: 1 },
    gradeTitle: { color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    gradeMeta: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
    gradeValue: { color: colors.primary, fontSize: 16, fontFamily: 'Inter_700Bold' },
    settingsCard: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14 },
    settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
    settingsIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
    settingsCopy: { flex: 1 },
    settingsTitle: { color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    settingsSubtitle: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
    accountNote: { marginTop: 18, borderRadius: 16, padding: 15, backgroundColor: colors.secondary },
    accountNoteLabel: { color: colors.mutedForeground, fontSize: 9, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
    accountNoteText: { color: colors.secondaryForeground, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 5 },
  });
}
