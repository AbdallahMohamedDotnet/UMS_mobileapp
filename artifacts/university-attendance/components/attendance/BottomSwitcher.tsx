import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { AnimatedPressable, MOTION } from '@/components/Motion';
import type { HomePage } from '@/constants/attendance';

const TABS: { key: HomePage; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'grades', label: 'Grades', icon: 'bar-chart-2' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

type Props = {
  active: HomePage;
  onChange: (page: HomePage) => void;
  bottomInset: number;
};

export const BottomSwitcher = React.memo(function BottomSwitcher({
  active,
  onChange,
  bottomInset,
}: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.bottomSwitcher, { paddingBottom: Math.max(bottomInset, 10) }]}>
      {TABS.map((tab) => (
        <Tab key={tab.key} tab={tab} active={active === tab.key} onChange={onChange} />
      ))}
    </View>
  );
});

/**
 * Each tab owns its own selection spring, so switching pages animates the
 * pill, icon and label on the UI thread without re-rendering the page body.
 */
const Tab = React.memo(function Tab({
  tab,
  active,
  onChange,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  onChange: (page: HomePage) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, MOTION.settle);
  }, [active, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(0,0,0,0)', colors.primary],
    ),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.9, 1]) },
      { translateY: interpolate(progress.value, [0, 1], [0, -2]) },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.mutedForeground, colors.primary]),
    opacity: interpolate(progress.value, [0, 1], [0.8, 1]),
  }));

  // Cross-fade two icons rather than swapping the color prop, which would
  // otherwise snap between states.
  const idleIconStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const activeIconStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const handlePress = useCallback(() => onChange(tab.key), [onChange, tab.key]);

  return (
    <AnimatedPressable
      testID={`tab-${tab.key}`}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      onPress={handlePress}
      haptic="selection"
      pressedScale={0.92}
      style={styles.bottomTab}
    >
      <Animated.View style={[styles.bottomIconWrap, pillStyle]}>
        <Animated.View style={[styles.iconLayer, idleIconStyle]}>
          <Feather name={tab.icon} size={18} color={colors.mutedForeground} />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, activeIconStyle]}>
          <Feather name={tab.icon} size={18} color={colors.primaryForeground} />
        </Animated.View>
      </Animated.View>
      <Animated.Text style={[styles.bottomLabel, labelStyle]}>{tab.label}</Animated.Text>
    </AnimatedPressable>
  );
});

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    bottomSwitcher: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-start',
      paddingTop: 10,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    bottomTab: { alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingTop: 2 },
    bottomIconWrap: { width: 42, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    iconLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    bottomLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  });
}
