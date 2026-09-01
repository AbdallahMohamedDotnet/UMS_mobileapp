import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import {
  MOTION,
  OrbitingView,
  ProgressTrack,
  PulsingView,
  RippleRing,
} from '@/components/Motion';

type Props = {
  /** 0..1 — how far through the multi-step check we are. */
  progress: number;
  message: string;
  isSubmitting: boolean;
  steps: { label: string; done: boolean; active: boolean }[];
  contentTop: number;
  contentBottom: number;
};

export const ValidationScreen = React.memo(function ValidationScreen({
  progress,
  message,
  isSubmitting,
  steps,
  contentTop,
  contentBottom,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.root, { paddingTop: contentTop, paddingBottom: contentBottom }]}>
      <View style={styles.validationHeader}>
        <View style={styles.brandMarkSmall}>
          <Feather name="check" size={16} color={colors.primaryForeground} />
        </View>
        <Text style={styles.brandWordmark}>CAMPUS ENGINE</Text>
      </View>

      <AnimatedEntrance style={styles.validationContent} delay={70} distance={18}>
        <View style={styles.orbWrap}>
          <RippleRing style={styles.orbRipple} duration={2400} maxScale={1.9} />
          <RippleRing style={styles.orbRipple} duration={2400} maxScale={1.9} delay={1200} />
          <PulsingView style={styles.loadingOrb} maxScale={1.04} duration={1200}>
            {/* A rotating arc reads as motion-with-direction; a bare spinner
                on a multi-second wait reads as a stall. */}
            <OrbitingView style={styles.orbArc} duration={1600} />
            <OrbitingView style={styles.orbArcInner} duration={2600} reverse />
            <View style={styles.orbCore} />
          </PulsingView>
        </View>

        <Text style={styles.validationEyebrow}>
          {isSubmitting ? 'SECURE VALIDATION' : 'QR VALIDATION'}
        </Text>

        {/* Keying on the message cross-fades each step instead of snapping. */}
        <Animated.Text
          key={message}
          entering={FadeIn.duration(240)}
          exiting={FadeOut.duration(140)}
          style={styles.validationTitle}
        >
          {message}
        </Animated.Text>

        <Text style={styles.validationDescription}>
          {isSubmitting
            ? 'Your QR check-in and selfie are being checked together. Keep this screen open.'
            : 'We’re verifying this session before asking for your selfie.'}
        </Text>

        <ProgressTrack progress={progress} style={styles.progressTrack} fillStyle={styles.progressFill} />

        <View style={styles.validationSteps}>
          {steps.map((step) => (
            <ValidationRow key={step.label} label={step.label} done={step.done} active={step.active} />
          ))}
        </View>
      </AnimatedEntrance>
    </View>
  );
});

/**
 * A step row that fills in with a spring when it completes, so progress is
 * felt as a sequence of small arrivals rather than a set of boolean flips.
 */
const ValidationRow = React.memo(function ValidationRow({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active: boolean;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const progress = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(done ? 1 : 0, MOTION.arrive);
  }, [done, progress]);

  const checkStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.background, colors.primary]),
    borderColor: interpolateColor(progress.value, [0, 1], [colors.border, colors.primary]),
    transform: [{ scale: interpolate(progress.value, [0, 0.6, 1], [1, 1.18, 1]) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.4, 1]) }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [colors.mutedForeground, colors.secondaryForeground],
    ),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, 2]) }],
  }));

  return (
    <View style={styles.validationRow}>
      <Animated.View style={[styles.validationCheck, checkStyle]}>
        {active && !done ? (
          <PulsingView style={styles.activeDot} maxScale={1.5} duration={620} minOpacity={0.4} />
        ) : (
          <Animated.View style={iconStyle}>
            <Feather name="check" size={13} color={colors.primaryForeground} />
          </Animated.View>
        )}
      </Animated.View>
      <Animated.Text style={[styles.validationRowText, textStyle]}>{label}</Animated.Text>
    </View>
  );
});

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    validationHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 20, paddingTop: 16 },
    brandMarkSmall: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    brandWordmark: { color: colors.foreground, fontSize: 11, letterSpacing: 1.3, fontFamily: 'Inter_700Bold' },
    validationContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 40 },
    orbWrap: { alignItems: 'center', justifyContent: 'center', width: 130, height: 130, marginBottom: 22 },
    orbRipple: { position: 'absolute', width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: colors.primary },
    loadingOrb: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    orbArc: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: 'transparent', borderTopColor: colors.primary, borderRightColor: colors.primary },
    orbArcInner: { position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'transparent', borderBottomColor: colors.accentForeground },
    orbCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary },
    validationEyebrow: { color: colors.primary, fontSize: 11, letterSpacing: 1.6, fontFamily: 'Inter_700Bold' },
    validationTitle: { color: colors.foreground, fontSize: 25, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 10 },
    validationDescription: { color: colors.mutedForeground, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', textAlign: 'center', maxWidth: 300, marginTop: 10 },
    progressTrack: { width: '100%', height: 5, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden', marginTop: 26 },
    progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
    validationSteps: { width: '100%', borderTopWidth: 1, borderTopColor: colors.border, marginTop: 28, paddingTop: 9 },
    validationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 11 },
    validationCheck: { width: 23, height: 23, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    validationRowText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  });
}
