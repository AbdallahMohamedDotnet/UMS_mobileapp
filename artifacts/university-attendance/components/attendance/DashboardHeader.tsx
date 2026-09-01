import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import {
  AnimatedPressable,
  MOTION,
  ProgressTrack,
  PulsingView,
  RippleRing,
} from '@/components/Motion';
import { StudentProfiles } from '@/components/attendance/StudentProfiles';
import {
  SUBJECTS,
  WEEK_DAYS,
  type HomePage,
  type Subject,
  type WeekDayEntry,
} from '@/constants/attendance';

type Props = {
  /** Live scroll offset from the dashboard list, written on the UI thread. */
  scrollY: SharedValue<number>;
  displayName: string;
  initials: string;
  isDemoMode: boolean;
  isDemoHistory: boolean;
  showHistory: boolean;
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  onToggleHistory: () => void;
  onStart: () => void;
  onNavigate: (page: HomePage) => void;
};

export const DashboardHeader = React.memo(function DashboardHeader({
  scrollY,
  displayName,
  initials,
  isDemoMode,
  isDemoHistory,
  showHistory,
  selectedStudentId,
  onSelectStudent,
  onToggleHistory,
  onStart,
  onNavigate,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  // The editorial greeting drifts up and dissolves as you scroll; the check-in
  // card stretches on overscroll so a pull-to-top feels elastic.
  const headingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 120], [1, 0], 'clamp'),
    transform: [{ translateY: interpolate(scrollY.value, [0, 150], [0, -30], 'clamp') }],
  }));

  const checkinStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-140, 0, 220], [20, 0, -28], 'clamp') },
      { scale: interpolate(scrollY.value, [-140, 0], [1.05, 1], 'clamp') },
    ],
  }));

  return (
    <View>
      <AnimatedEntrance style={styles.topBar} delay={30} distance={10}>
        <View style={styles.brandLockup}>
          <View style={styles.brandSquare}>
            <Text style={styles.brandSquareText}>N</Text>
          </View>
          <View>
            <Text style={styles.brandName}>nahda</Text>
            <Text style={styles.brandMeta}>LMS · 2026 SPRING</Text>
          </View>
        </View>
        <AnimatedPressable
          testID="profile-button"
          accessibilityLabel="Open profile settings"
          onPress={() => onNavigate('settings')}
          haptic="selection"
          style={styles.profileBubble}
        >
          <Text style={styles.profileInitials}>{initials}</Text>
        </AnimatedPressable>
      </AnimatedEntrance>

      <AnimatedEntrance delay={80} distance={14}>
        <Animated.View style={[styles.editorialHeading, headingStyle]}>
          <Text style={styles.overline}>
            {isDemoMode ? 'DEMO PREVIEW · SAMPLE DATA' : 'MONDAY · MAY 26 · SPRING 26'}
          </Text>
          <Text style={styles.editorialGreeting}>good morning, {displayName}.</Text>
          <Text style={styles.editorialSummary}>
            you’ve got <Text style={styles.editorialAccent}>3 things due this week</Text> — a
            design doc, a hash-tables quiz, and an AI lab.
          </Text>
        </Animated.View>
      </AnimatedEntrance>

      <View style={styles.metricStrip}>
        {METRICS.map((metric, index) => (
          <AnimatedEntrance key={metric.label} delay={140 + index * 70} distance={12} style={styles.metricSlot}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
            </View>
          </AnimatedEntrance>
        ))}
      </View>

      <AnimatedEntrance delay={200} distance={18}>
        <Animated.View style={[styles.checkinCard, checkinStyle]}>
          <View style={styles.checkinRule} />
          <View style={styles.checkinTopline}>
            <View style={styles.statusDotWrap}>
              <RippleRing style={styles.statusRipple} duration={2600} maxScale={3.2} />
              <PulsingView style={styles.statusDot} maxScale={1.3} duration={1100} minOpacity={0.6} />
            </View>
            <Text style={styles.statusText}>NEXT SESSION</Text>
            <Text style={styles.timeText}>09:00 AM</Text>
          </View>
          <Text style={styles.checkinTitle}>Ready to check in?</Text>
          <Text style={styles.checkinDescription}>
            Be in the room, scan the code, and verify your presence in under a minute.
          </Text>
          <AnimatedPressable
            accessibilityLabel="Start attendance check in"
            testID="start-attendance"
            onPress={onStart}
            haptic="medium"
            pressedScale={0.95}
            style={[styles.primaryButton, styles.heroButton]}
          >
            <Feather name="maximize" size={17} color={colors.primaryForeground} />
            <Text style={styles.primaryButtonText}>Start attendance</Text>
          </AnimatedPressable>
        </Animated.View>
      </AnimatedEntrance>

      <AnimatedEntrance style={styles.sectionHeaderEditorial} delay={260} distance={12}>
        <Text style={styles.editorialSectionTitle}>this week</Text>
        <Text style={styles.sectionSubline}>May 26 — Jun 1, 2026</Text>
      </AnimatedEntrance>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekRail}
        decelerationRate="fast"
        snapToInterval={WEEK_CARD_WIDTH + RAIL_GAP}
        snapToAlignment="start"
      >
        {WEEK_DAYS.map((day, index) => (
          <WeekDayCard key={day.day} day={day} index={index} today={index === 0} />
        ))}
      </ScrollView>

      <AnimatedEntrance style={styles.sectionHeaderEditorial} delay={320} distance={12}>
        <Text style={styles.editorialSectionTitle}>your subjects</Text>
        <Text style={styles.sectionSubline}>spring 2026 · 6 courses</Text>
      </AnimatedEntrance>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.subjectRail}
        decelerationRate="fast"
        snapToInterval={SUBJECT_CARD_WIDTH + RAIL_GAP}
        snapToAlignment="start"
      >
        {SUBJECTS.map((subject, index) => (
          <SubjectCard key={subject.code} subject={subject} index={index} />
        ))}
      </ScrollView>

      {isDemoMode && (
        <StudentProfiles selectedId={selectedStudentId} onSelect={onSelectStudent} />
      )}

      <AnimatedEntrance style={styles.sectionHeaderRow} delay={380} distance={12}>
        <View style={styles.historyTitleRow}>
          <Text style={styles.editorialSectionTitle}>attendance history</Text>
          {isDemoHistory && (
            <View style={styles.sampleBadge}>
              <Text style={styles.sampleBadgeText}>SAMPLE</Text>
            </View>
          )}
        </View>
        <AnimatedPressable
          accessibilityLabel={showHistory ? 'Hide attendance history' : 'Show attendance history'}
          accessibilityRole="button"
          testID="toggle-history"
          onPress={onToggleHistory}
          haptic="selection"
          hitSlop={10}
          style={styles.toggleButton}
        >
          <Text style={styles.sectionAction}>{showHistory ? 'Hide' : 'View all'}</Text>
          <RotatingChevron expanded={showHistory} color={colors.primary} />
        </AnimatedPressable>
      </AnimatedEntrance>
    </View>
  );
});

const METRICS = [
  { value: '3.71', label: 'CUMULATIVE GPA' },
  { value: '6', label: 'ENROLLED SUBJECTS' },
  { value: '18', label: 'CREDIT HRS' },
];

const WeekDayCard = React.memo(function WeekDayCard({
  day,
  index,
  today,
}: {
  day: WeekDayEntry;
  index: number;
  today: boolean;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  return (
    <AnimatedEntrance delay={290 + index * 45} distance={14} from="left">
      <AnimatedPressable
        accessibilityLabel={`${day.day} ${day.date}, ${day.classes.length} sessions`}
        pressedScale={0.97}
        haptic="selection"
        style={[styles.weekDay, today && styles.weekDaySelected]}
      >
        <View style={styles.weekDayHeader}>
          <Text style={styles.weekDayName}>{day.day}</Text>
          <Text style={styles.weekDayDate}>{day.date}</Text>
        </View>
        {day.classes.length ? (
          day.classes.map((item) => (
            <View key={item.title} style={[styles.classChip, { backgroundColor: colors[item.color] }]}>
              <Text style={styles.classTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.classMeta}>
                {item.code} · {item.time}
              </Text>
              <Text style={styles.classRoom}>{item.room}</Text>
            </View>
          ))
        ) : (
          <View style={styles.restDay}>
            <Feather name="sun" size={14} color={colors.mutedForeground} />
            <Text style={styles.restDayText}>open day</Text>
          </View>
        )}
      </AnimatedPressable>
    </AnimatedEntrance>
  );
});

const SubjectCard = React.memo(function SubjectCard({
  subject,
  index,
}: {
  subject: Subject;
  index: number;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  return (
    <AnimatedEntrance delay={350 + index * 60} distance={14} from="left">
      <AnimatedPressable
        accessibilityLabel={`${subject.title}, ${subject.progress} percent complete`}
        pressedScale={0.97}
        style={styles.subjectCard}
      >
        <View style={[styles.subjectCover, { backgroundColor: colors[subject.color] }]}>
          <Feather name={subject.icon} size={25} color={colors.primaryForeground} />
          <Text style={styles.subjectCode}>{subject.code}</Text>
        </View>
        <View style={styles.subjectBody}>
          <Text style={styles.subjectTitle} numberOfLines={1}>
            {subject.title}
          </Text>
          <Text style={styles.subjectInstructor} numberOfLines={1}>
            {subject.instructor}
          </Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressMeta}>{subject.modules} modules</Text>
            <Text style={styles.progressMeta}>{subject.progress}% done</Text>
          </View>
          {/* Springs up from zero on mount rather than appearing pre-filled. */}
          <ProgressTrack
            progress={subject.progress / 100}
            style={styles.progressTrack}
            fillStyle={styles.progressFill}
          />
        </View>
      </AnimatedPressable>
    </AnimatedEntrance>
  );
});

/** Flips between "collapse" and "expand" instead of swapping two icons. */
function RotatingChevron({ expanded, color }: { expanded: boolean; color: string }) {
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(expanded ? 1 : 0, MOTION.settle);
  }, [expanded, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Feather name="chevron-down" size={16} color={color} />
    </Animated.View>
  );
}

const WEEK_CARD_WIDTH = 168;
const SUBJECT_CARD_WIDTH = 210;
const RAIL_GAP = 12;

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 18 },
    brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    brandSquare: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    brandSquareText: { color: colors.primaryForeground, fontSize: 16, fontFamily: 'Inter_700Bold' },
    brandName: { color: colors.foreground, fontSize: 15, fontFamily: 'Inter_700Bold' },
    brandMeta: { color: colors.mutedForeground, fontSize: 9, letterSpacing: 1, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
    profileBubble: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    profileInitials: { color: colors.accentForeground, fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
    editorialHeading: { paddingTop: 10, paddingBottom: 22 },
    overline: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 1.4, fontFamily: 'Inter_600SemiBold' },
    editorialGreeting: { color: colors.foreground, fontSize: 32, lineHeight: 38, fontFamily: 'Inter_700Bold', marginTop: 10 },
    editorialSummary: { color: colors.secondaryForeground, fontSize: 14, lineHeight: 22, fontFamily: 'Inter_400Regular', marginTop: 12 },
    editorialAccent: { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
    metricStrip: { flexDirection: 'row', gap: 10, paddingBottom: 22 },
    metricSlot: { flex: 1 },
    metric: { borderTopWidth: 2, borderTopColor: colors.foreground, paddingTop: 9 },
    metricValue: { color: colors.foreground, fontSize: 21, fontFamily: 'Inter_700Bold' },
    metricLabel: { color: colors.mutedForeground, fontSize: 8, letterSpacing: 0.8, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
    checkinCard: { borderRadius: 24, padding: 20, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    checkinRule: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.primary },
    checkinTopline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusDotWrap: { width: 7, height: 7, alignItems: 'center', justifyContent: 'center' },
    statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
    statusRipple: { position: 'absolute', width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: colors.primary },
    statusText: { color: colors.accentForeground, fontSize: 10, letterSpacing: 1.3, fontFamily: 'Inter_700Bold' },
    timeText: { color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium', marginLeft: 'auto' },
    checkinTitle: { color: colors.foreground, fontSize: 25, lineHeight: 31, fontFamily: 'Inter_700Bold', marginTop: 20 },
    checkinDescription: { color: colors.secondaryForeground, fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 9, maxWidth: 300 },
    primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 54, paddingHorizontal: 18, borderRadius: 16, backgroundColor: colors.primary },
    heroButton: { alignSelf: 'flex-start', marginTop: 20, minHeight: 46, paddingHorizontal: 16 },
    primaryButtonText: { color: colors.primaryForeground, fontSize: 13, fontFamily: 'Inter_700Bold' },
    sectionHeaderEditorial: { paddingTop: 30, paddingBottom: 4 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 30, paddingBottom: 8 },
    editorialSectionTitle: { color: colors.foreground, fontSize: 21, fontFamily: 'Inter_700Bold' },
    sectionSubline: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
    weekRail: { gap: RAIL_GAP, paddingTop: 14, paddingBottom: 6, paddingHorizontal: 2 },
    weekDay: { width: WEEK_CARD_WIDTH, borderRadius: 18, padding: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 8 },
    weekDaySelected: { borderColor: colors.primary, backgroundColor: colors.secondary },
    weekDayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    weekDayName: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 1.1, fontFamily: 'Inter_700Bold' },
    weekDayDate: { color: colors.foreground, fontSize: 17, fontFamily: 'Inter_700Bold' },
    classChip: { borderRadius: 12, padding: 9 },
    classTitle: { color: colors.primaryForeground, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
    classMeta: { color: colors.primaryForeground, fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 3, opacity: 0.85 },
    classRoom: { color: colors.primaryForeground, fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 1, opacity: 0.7 },
    restDay: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
    restDayText: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular' },
    subjectRail: { gap: RAIL_GAP, paddingTop: 14, paddingBottom: 6, paddingHorizontal: 2 },
    subjectCard: { width: SUBJECT_CARD_WIDTH, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    subjectCover: { height: 92, alignItems: 'flex-start', justifyContent: 'space-between', padding: 12 },
    subjectCode: { color: colors.primaryForeground, fontSize: 10, letterSpacing: 1, fontFamily: 'Inter_700Bold' },
    subjectBody: { padding: 12 },
    subjectTitle: { color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    subjectInstructor: { color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    progressMeta: { color: colors.mutedForeground, fontSize: 9, fontFamily: 'Inter_500Medium' },
    progressTrack: { height: 5, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden', marginTop: 7 },
    progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
    historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sampleBadge: { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: colors.secondary },
    sampleBadgeText: { color: colors.mutedForeground, fontSize: 8, letterSpacing: 0.7, fontFamily: 'Inter_700Bold' },
    toggleButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sectionAction: { color: colors.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  });
}
