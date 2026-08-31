import React, { type ReactNode, useMemo } from 'react';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

type AnimatedEntranceProps = {
  children: ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedEntrance({
  children,
  delay = 0,
  distance = 16,
  style,
}: AnimatedEntranceProps) {
  const entering = useMemo(
    () =>
      FadeInDown.duration(480)
        .delay(delay)
        .springify()
        .damping(18)
        .stiffness(140)
        .reduceMotion(ReduceMotion.System)
        .withInitialValues({ opacity: 0, transform: [{ translateY: distance }] }),
    [delay, distance],
  );

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
