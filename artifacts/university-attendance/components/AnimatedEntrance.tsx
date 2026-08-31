import React, { type ReactNode } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
  return (
    <Animated.View
      entering={FadeInDown.duration(480)
        .delay(delay)
        .springify()
        .damping(18)
        .stiffness(140)
        .withInitialValues({ opacity: 0, transform: [{ translateY: distance }] })}
      style={style}
    >
      {children}
    </Animated.View>
  );
}