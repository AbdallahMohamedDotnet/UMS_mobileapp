import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  PulsingView,
  RippleRing,
} from '@/components/Motion';
import { StudentProfiles } from '@/components/attendance/StudentProfiles';
import { DEFAULT_SESSION } from '@/constants/attendance';

type Props = {
  /** Live scroll offset, written on the UI thread by the list's scroll handler. */
  scrollY: SharedValue<number>;
  displayName: string;
  isDemoMode: boolean;
  isDemoHistory: boolean;
  showHistory: boolean;
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  onToggleHistory: () => void;
  onStart: () => void;
};

export const HomeHeader = React.memo(function HomeHeader({
  scrollY,
  displayName,
  isDemoMode,
  isDemoHistory,
  showHistory,
  selectedStudentId,
  onSelectStudent,
  onToggleHistory,
  onStart,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  // Greeting drifts up and fades as the list scrolls; on overscroll (negative
  // offset) the hero stretches, which is what makes a pull-to-top feel elastic.
  const greetingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 90], [1, 0], 'clamp'),
    transform: [
      { translateY: interpolate(scrollY.value, [0, 120], [0, -26], 'clamp') },
    ],
  }));

  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-140, 0, 200], [22, 0, -34], 'clamp') },
      { scale: interpolate(scrollY.value, [-140, 0], [1.06, 1], 'clamp') },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-140, 0, 260], [-34, 0, 58], 'clamp') },
      { scale: interpolate(scrollY.value, [-140, 0], [1.25, 1], 'clamp') },
    ],
  }));

  return (
    <View>
      <AnimatedEntrance style={styles.topBar} delay={40} distance={12}>
        <Animated.View style={[styles.greetingBlock, greetingStyle]}>
          <Text style={styles.overline}>
            {isDemoMode ? 'DEMO PREVIEW · SAMPLE DATA' : 'MONDAY · AUG 31'}
          </Text>
          <Text style={styles.greeting} numberOfLines={1}>
            Good morning, {displayName}
          </Text>
        </Animated.View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={100} distance={18}>
        <Animated.View style={[styles.heroCard, heroStyle]}>
          <Animated.View style={[styles.heroGlow, glowStyle]} />
          <View style={styles.heroTopline}>
            <View style={styles.statusDotWrap}>
              <RippleRing style={styles.statusRipple} duration={2600} maxScale={3.2} />
              <PulsingView style={styles.statusDot} maxScale={1.3} duration={1100} minOpacity={0.6} />
            </View>
            <Text style={styles.statusText}>NEXT SESSION</Text>
            <Text style={styles.timeText}>{DEFAULT_SESSION.startsAt}</Text>
          </View>
          <Text style={styles.heroTitle}>Ready to check in?</Text>
          <Text style={styles.heroDescription}>
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
            <Feather name="maximize" size={18} color={colors.primaryForeground} />
            <Text style={styles.primaryButtonText}>Start attendance</Text>
          </AnimatedPressable>
        </Animated.View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={150} distance={14}>
        <AnimatedPressable
          accessibilityLabel={`Today's session: ${DEFAULT_SESSION.course}`}
          style={styles.sessionRow}
          pressedScale={0.985}
          haptic="selection"
        >
          <View style={styles.sessionIcon}>
            <Feather name="book-open" size={18} color={colors.accentForeground} />
          </View>
          <View style={styles.sessionCopy}>
            <Text style={styles.sessionLabel}>TODAY’S SESSION</Text>
            <Text style={styles.sessionTitle}>{DEFAULT_SESSION.course}</Text>
            <Text style={styles.sessionMeta}>{DEFAULT_SESSION.location}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </AnimatedPressable>
      </AnimatedEntrance>

      <StudentProfiles selectedId={selectedStudentId} onSelect={onSelectStudent} />

      <AnimatedEntrance style={styles.sectionHeader} delay={250} distance={12}>
        <View style={styles.historyTitleRow}>
          <Text style={styles.sectionTitle}>Attendance history</Text>
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

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    // Right padding leaves room for the avatar pinned by the floating bar.
    topBar: { paddingTop: 14, paddingBottom: 26, paddingRight: 56 },
    greetingBlock: { alignItems: 'flex-start' },
    overline: { color: colors.mutedForeground, fontSize: 11, letterSpacing: 1.4, fontFamily: 'Inter_600SemiBold' },
    greeting: { color: colors.foreground, fontSize: 25, lineHeight: 32, fontFamily: 'Inter_700Bold', marginTop: 5 },
    heroCard: { overflow: 'hidden', borderRadius: 26, padding: 22, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, minHeight: 264 },
    heroGlow: { position: 'absolute', right: -50, top: -75, width: 190, height: 190, borderRadius: 95, backgroundColor: colors.accentSoft, opacity: 0.85 },
    heroTopline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusDotWrap: { width: 7, height: 7, alignItems: 'center', justifyContent: 'center' },
    statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
    statusRipple: { position: 'absolute', width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: colors.primary },
    statusText: { color: colors.accentForeground, fontSize: 11, letterSpacing: 1.3, fontFamily: 'Inter_700Bold' },
    timeText: { color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium', marginLeft: 'auto' },
    heroTitle: { color: colors.foreground, fontSize: 28, lineHeight: 34, fontFamily: 'Inter_700Bold', marginTop: 28, maxWidth: 260 },
    heroDescription: { color: colors.secondaryForeground, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', maxWidth: 300, marginTop: 10 },
    primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 54, paddingHorizontal: 18, borderRadius: 16, backgroundColor: colors.primary },
    heroButton: { alignSelf: 'flex-start', marginTop: 22, minHeight: 48, paddingHorizontal: 17 },
    primaryButtonText: { color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_700Bold' },
    sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: colors.border },
    sessionIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    sessionCopy: { flex: 1 },
    sessionLabel: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 1.15, fontFamily: 'Inter_700Bold' },
    sessionTitle: { color: colors.foreground, fontSize: 15, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
    sessionMeta: { color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 25, paddingBottom: 14 },
    historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sampleBadge: { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: colors.secondary },
    sampleBadgeText: { color: colors.mutedForeground, fontSize: 8, letterSpacing: 0.7, fontFamily: 'Inter_700Bold' },
    sectionTitle: { color: colors.foreground, fontSize: 17, fontFamily: 'Inter_700Bold' },
    toggleButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sectionAction: { color: colors.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  });
}
