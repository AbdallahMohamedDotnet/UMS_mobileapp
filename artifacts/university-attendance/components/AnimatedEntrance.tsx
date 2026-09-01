import React, { type ReactNode, useMemo } from 'react';
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  ReduceMotion,
} from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

type Direction = 'up' | 'down' | 'left' | 'right';

type AnimatedEntranceProps = {
  children: ReactNode;
  delay?: number;
  distance?: number;
  /** Which edge the content travels in from. */
  from?: Direction;
  /**
   * Set false to render statically. Recycled list rows pass false so scrolling
   * back up doesn't replay the entrance for content the user has already seen.
   */
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const BUILDERS = {
  up: FadeInDown,
  down: FadeInUp,
  left: FadeInRight,
  right: FadeInLeft,
} as const;

export function AnimatedEntrance({
  children,
  delay = 0,
  distance = 16,
  from = 'up',
  enabled = true,
  style,
}: AnimatedEntranceProps) {
  const entering = useMemo(() => {
    if (!enabled) return undefined;
    const axis = from === 'left' || from === 'right' ? 'translateX' : 'translateY';
    const sign = from === 'up' || from === 'left' ? 1 : -1;
    return BUILDERS[from]
      .duration(460)
      .delay(delay)
      .springify()
      .damping(19)
      .stiffness(160)
      .mass(0.85)
      .reduceMotion(ReduceMotion.System)
      .withInitialValues({
        opacity: 0,
        transform: [{ [axis]: distance * sign } as never],
      });
  }, [delay, distance, enabled, from]);

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
