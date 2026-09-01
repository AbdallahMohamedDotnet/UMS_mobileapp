import React, { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AnimatedPressable, MOTION } from '@/components/Motion';
import { MOCK_STUDENTS, type MockStudent } from '@/constants/attendance';

type Props = {
  selectedId: string;
  onSelect: (id: string) => void;
};

/**
 * Horizontal cohort carousel.
 *
 * Selection is driven by a per-card shared value, so tapping a card animates
 * border, background and avatar on the UI thread — the parent list never
 * re-renders for a selection change.
 */
export const StudentProfiles = React.memo(function StudentProfiles({ selectedId, onSelect }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  return (
    <AnimatedEntrance style={styles.profilesSection} delay={200} distance={14}>
      <View style={styles.profileSectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Student profiles</Text>
          <Text style={styles.sectionSubline}>Classmates in your cohort</Text>
        </View>
        <View style={styles.demoPill}>
          <Feather name="eye" size={12} color={colors.accentForeground} />
          <Text style={styles.demoPillText}>DEMO</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.profileCards}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
      >
        {MOCK_STUDENTS.map((student, index) => (
          <StudentCard
            key={student.id}
            student={student}
            index={index}
            selected={student.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ScrollView>
      <Text style={styles.demoCaption}>
        Preview only · selecting a profile does not change your account
      </Text>
    </AnimatedEntrance>
  );
});

const StudentCard = React.memo(function StudentCard({
  student,
  index,
  selected,
  onSelect,
}: {
  student: MockStudent;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, MOTION.settle);
  }, [progress, selected]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [colors.border, colors.primary]),
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.card, colors.secondary]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 1.03]) },
      { translateY: interpolate(progress.value, [0, 1], [0, -4]) },
    ],
  }));

  const avatarStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.muted, colors.primary]),
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [0, -6])}deg` },
      { scale: interpolate(progress.value, [0, 1], [1, 1.08]) },
    ],
  }));

  const avatarTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [colors.secondaryForeground, colors.primaryForeground],
    ),
  }));

  const handlePress = useCallback(() => onSelect(student.id), [onSelect, student.id]);

  return (
    <AnimatedEntrance delay={230 + index * 60} distance={14} from="left">
      <AnimatedPressable
        testID={`mock-student-${student.id}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${student.name}, ${student.program}, ${student.attendance} attendance`}
        onPress={handlePress}
        haptic="selection"
        pressedScale={0.97}
        style={styles.cardTouchable}
      >
        <Animated.View style={[styles.mockProfileCard, cardStyle]}>
          <Animated.View style={[styles.mockAvatar, avatarStyle]}>
            <Animated.Text style={[styles.mockAvatarText, avatarTextStyle]}>
              {student.initials}
            </Animated.Text>
          </Animated.View>
          <Text style={styles.mockProfileName} numberOfLines={1}>
            {student.name}
          </Text>
          <Text style={styles.mockProfileProgram} numberOfLines={1}>
            {student.program}
          </Text>
          <View style={styles.mockProfileFooter}>
            <Text style={styles.mockProfileLabel}>ATTENDANCE</Text>
            <Text style={styles.mockProfileRate}>{student.attendance}</Text>
          </View>
        </Animated.View>
      </AnimatedPressable>
    </AnimatedEntrance>
  );
});

const CARD_WIDTH = 156;
const CARD_GAP = 10;

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    profilesSection: { paddingTop: 24, paddingBottom: 2 },
    profileSectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    sectionTitle: { color: colors.foreground, fontSize: 17, fontFamily: 'Inter_700Bold' },
    sectionSubline: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
    demoPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.secondary },
    demoPillText: { color: colors.accentForeground, fontSize: 9, letterSpacing: 1, fontFamily: 'Inter_700Bold' },
    // Vertical padding leaves room for the selected card's lift and scale.
    profileCards: { gap: CARD_GAP, paddingTop: 15, paddingBottom: 10, paddingHorizontal: 3 },
    cardTouchable: { borderRadius: 17 },
    mockProfileCard: { width: CARD_WIDTH, minHeight: 155, borderRadius: 17, padding: 13, borderWidth: 1 },
    mockAvatar: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    mockAvatarText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
    mockProfileName: { color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 11 },
    mockProfileProgram: { color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
    mockProfileFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    mockProfileLabel: { color: colors.mutedForeground, fontSize: 8, letterSpacing: 0.6, fontFamily: 'Inter_700Bold' },
    mockProfileRate: { color: colors.accentForeground, fontSize: 12, fontFamily: 'Inter_700Bold' },
    demoCaption: { color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  });
}
