import React, { type ComponentProps, type ReactNode, useEffect } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = Omit<
  ComponentProps<typeof Pressable>,
  "style"
> & {
  style?: StyleProp<ViewStyle>;
};

/** Native-thread press feedback shared by the app's primary interactions. */
export function AnimatedPressable({
  style,
  disabled,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <ReanimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        scale.value = withTiming(0.97, {
          duration: 90,
          reduceMotion: ReduceMotion.System,
        });
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withTiming(1, {
          duration: 150,
          reduceMotion: ReduceMotion.System,
        });
        props.onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}

export function ScannerBeam({ style }: { style?: StyleProp<ViewStyle> }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0.5;
      return;
    }
    progress.value = withRepeat(withTiming(1, { duration: 1800 }), -1, true);
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.35, 1, 0.35]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [8, 258]) }],
  }));

  return <Animated.View pointerEvents="none" style={[style, animatedStyle]} />;
}

export function PulsingView({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(withTiming(1, { duration: 950 }), -1, true);
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.055]) }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}
