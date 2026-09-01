import React, {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
} from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type WithSpringConfig,
  type WithTimingConfig,
} from 'react-native-reanimated';

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Shared motion vocabulary. Keeping the curves in one place is what makes
 * separate screens feel like a single, physically consistent product.
 */
export const MOTION = {
  /** Snappy, barely-overshooting spring for direct manipulation (press, select). */
  press: {
    damping: 18,
    stiffness: 340,
    mass: 0.55,
    reduceMotion: ReduceMotion.System,
  } satisfies WithSpringConfig,
  /** Softer spring with a little bounce for things that "arrive". */
  arrive: {
    damping: 14,
    stiffness: 190,
    mass: 0.9,
    reduceMotion: ReduceMotion.System,
  } satisfies WithSpringConfig,
  /** Non-bouncy spring for layout/position changes that should feel calm. */
  settle: {
    damping: 22,
    stiffness: 210,
    mass: 0.8,
    reduceMotion: ReduceMotion.System,
  } satisfies WithSpringConfig,
  /** Standard easing for color/opacity cross-fades. */
  fade: {
    duration: 220,
    easing: Easing.out(Easing.quad),
    reduceMotion: ReduceMotion.System,
  } satisfies WithTimingConfig,
} as const;

type HapticStyle = 'light' | 'medium' | 'selection' | 'none';

function fireHaptic(kind: HapticStyle) {
  // Fire-and-forget: awaiting haptics before a state update adds a visible
  // frame of latency to every tap.
  if (kind === 'none') return;
  if (kind === 'selection') {
    void Haptics.selectionAsync().catch(() => {});
    return;
  }
  void Haptics.impactAsync(
    kind === 'medium'
      ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Light,
  ).catch(() => {});
}

type AnimatedPressableProps = Omit<ComponentProps<typeof Pressable>, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far the target shrinks while held. */
  pressedScale?: number;
  /** Opacity while held. */
  pressedOpacity?: number;
  /** Tactile feedback fired on press-in. */
  haptic?: HapticStyle;
};

/**
 * Native-thread press feedback shared by the app's primary interactions.
 *
 * The scale/opacity pair runs entirely on the UI thread, so it stays at 60fps
 * even while JS is busy validating a QR payload or writing to AsyncStorage.
 */
export function AnimatedPressable({
  style,
  disabled,
  pressedScale = 0.96,
  pressedOpacity = 0.92,
  haptic = 'light',
  onPressIn,
  onPressOut,
  ...props
}: AnimatedPressableProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pressed.value, [0, 1], [1, pressedScale]) },
    ],
    opacity: interpolate(pressed.value, [0, 1], [1, pressedOpacity]),
  }));

  const handlePressIn = useCallback<NonNullable<typeof onPressIn>>(
    (event) => {
      pressed.value = withSpring(1, MOTION.press);
      fireHaptic(haptic);
      onPressIn?.(event);
    },
    [haptic, onPressIn, pressed],
  );

  const handlePressOut = useCallback<NonNullable<typeof onPressOut>>(
    (event) => {
      pressed.value = withSpring(0, MOTION.press);
      onPressOut?.(event);
    },
    [onPressOut, pressed],
  );

  return (
    <ReanimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    />
  );
}

/**
 * Sweeping laser line for the QR viewfinder. `travel` should match the frame
 * height so the beam stops exactly at the bottom edge.
 */
export function ScannerBeam({
  style,
  travel = 258,
  duration = 1800,
}: {
  style?: StyleProp<ViewStyle>;
  travel?: number;
  duration?: number;
}) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0.5;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [duration, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.3, 1, 0.3]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [8, travel]) },
      { scaleX: interpolate(progress.value, [0, 0.5, 1], [0.9, 1, 0.9]) },
    ],
  }));

  return <Animated.View pointerEvents="none" style={[style, animatedStyle]} />;
}

/** Slow "breathing" scale, for live-status affordances. */
export function PulsingView({
  children,
  style,
  minScale = 1,
  maxScale = 1.055,
  duration = 950,
  minOpacity = 1,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  minScale?: number;
  maxScale?: number;
  duration?: number;
  minOpacity?: number;
}) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [duration, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1], [minScale, maxScale]) },
    ],
    opacity: interpolate(progress.value, [0, 1], [minOpacity, 1]),
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * Radar ring that expands and fades out of a source dot — used to draw the eye
 * to live state (next session, successful check-in) without any layout cost.
 */
export function RippleRing({
  style,
  delay = 0,
  duration = 2200,
  maxScale = 2.6,
}: {
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  maxScale?: number;
}) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [delay, duration, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 0.45, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, maxScale]) }],
  }));

  return <Animated.View pointerEvents="none" style={[style, animatedStyle]} />;
}

/**
 * Spring "pop" entrance for hero moments (the success checkmark). Overshoots
 * once and settles — deliberately more expressive than the list entrances.
 */
export function PopIn({
  children,
  style,
  delay = 0,
  from = 0.4,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  from?: number;
}) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(delay, withSpring(1, MOTION.arrive));
    return () => cancelAnimation(progress);
  }, [delay, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 1, 1]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [from, 1]) },
      { rotate: `${interpolate(progress.value, [0, 1], [-12, 0])}deg` },
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * Continuous rotation, used behind the validating spinner so the wait reads as
 * progress rather than a frozen screen.
 */
export function OrbitingView({
  children,
  style,
  duration = 3600,
  reverse = false,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  reverse?: boolean;
}) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [duration, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${progress.value * (reverse ? -360 : 360)}deg` },
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * Determinate progress track. `progress` is 0..1 and is animated on the UI
 * thread, so multi-second validation steps stay smooth under JS load.
 */
export function ProgressTrack({
  progress,
  style,
  fillStyle,
}: {
  progress: number;
  style?: StyleProp<ViewStyle>;
  fillStyle?: StyleProp<ViewStyle>;
}) {
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withSpring(Math.min(Math.max(progress, 0), 1), MOTION.settle);
  }, [progress, value]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${value.value * 100}%`,
  }));

  return (
    <Animated.View style={style} pointerEvents="none">
      <Animated.View style={[fillStyle, animatedStyle]} />
    </Animated.View>
  );
}

/**
 * Cross-fades between two background colors as `active` flips, avoiding the
 * hard style swap that makes state changes feel abrupt.
 */
export function ColorMorphView({
  active,
  fromColor,
  toColor,
  style,
  children,
  scaleOnActive = 1,
}: {
  active: boolean;
  fromColor: string;
  toColor: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  scaleOnActive?: number;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, MOTION.settle);
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [fromColor, toColor],
    ),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, scaleOnActive]) },
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * Horizontal shake for validation failures — the one motion in the app that is
 * intentionally sharp, because it signals "this needs your attention".
 */
export function ShakeView({
  children,
  style,
  trigger,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Any changing value (e.g. the error message) restarts the shake. */
  trigger: unknown;
}) {
  const offset = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || trigger == null) return;
    offset.value = withSequence(
      withTiming(-7, { duration: 55 }),
      withTiming(7, { duration: 65 }),
      withTiming(-4, { duration: 55 }),
      withSpring(0, MOTION.press),
    );
  }, [offset, reduceMotion, trigger]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
