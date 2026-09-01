import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

type WelcomeGateProps = {
  children: React.ReactNode;
};

export function WelcomeGate({ children }: WelcomeGateProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(true);
  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.72);
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkY = useSharedValue(12);
  const taglineOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    markOpacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
    markScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.25)) });
    wordmarkOpacity.value = withDelay(260, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    wordmarkY.value = withDelay(260, withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }));
    taglineOpacity.value = withDelay(520, withTiming(1, { duration: 420 }));

    const fadeTimer = setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: 360, easing: Easing.inOut(Easing.cubic) });
      setTimeout(() => setVisible(false), 380);
    }, 1320);

    return () => clearTimeout(fadeTimer);
  }, [markOpacity, markScale, overlayOpacity, taglineOpacity, wordmarkOpacity, wordmarkY]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkY.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  return (
    <View style={styles.root}>
      {children}
      {visible && (
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <Animated.View style={[styles.mark, markStyle]}>
            <Feather name="check" size={28} color={colors.primaryForeground} />
          </Animated.View>
          <Animated.View style={wordmarkStyle}>
            <Text style={styles.wordmark}>CAMPUS ENGINE</Text>
          </Animated.View>
          <Animated.View style={taglineStyle}>
            <Text style={styles.tagline}>ATTENDANCE, VERIFIED</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    mark: {
      width: 76,
      height: 76,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      shadowColor: colors.overlay,
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    wordmark: {
      color: colors.foreground,
      fontSize: 18,
      letterSpacing: 3.2,
      fontFamily: 'Inter_700Bold',
      marginTop: 24,
    },
    tagline: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 2,
      fontFamily: 'Inter_600SemiBold',
      marginTop: 13,
    },
  });
}