import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AnimatedPressable, PopIn, RippleRing } from '@/components/Motion';
import { DEFAULT_SESSION } from '@/constants/attendance';

type Props = {
  timeLabel: string;
  onDone: () => void;
  contentTop: number;
  contentBottom: number;
};

export const SuccessScreen = React.memo(function SuccessScreen({
  timeLabel,
  onDone,
  contentTop,
  contentBottom,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.root, { paddingTop: contentTop, paddingBottom: contentBottom }]}>
      <View style={styles.successContent}>
        {/* Rings radiate out of the checkmark as it lands — the one moment in
            the flow that is allowed to be celebratory. */}
        <View style={styles.iconWrap}>
          <RippleRing style={styles.successRing} duration={2000} maxScale={2.2} />
          <RippleRing style={styles.successRing} duration={2000} maxScale={2.2} delay={700} />
          <PopIn style={styles.successIcon} delay={90} from={0.3}>
            <Feather name="check" size={38} color={colors.primaryForeground} />
          </PopIn>
        </View>

        <AnimatedEntrance delay={260} distance={14} style={styles.copy}>
          <Text style={styles.successEyebrow}>CHECK-IN COMPLETE</Text>
          <Text style={styles.successTitle}>You’re marked present.</Text>
          <Text style={styles.successDescription}>
            Your attendance for today’s session was verified at {timeLabel}.
          </Text>
        </AnimatedEntrance>

        <AnimatedEntrance delay={360} distance={18} style={styles.cardWrap}>
          <View style={styles.successCard}>
            <View style={styles.successCardCopy}>
              <Text style={styles.successCardLabel}>SESSION</Text>
              <Text style={styles.successCardTitle}>{DEFAULT_SESSION.course}</Text>
              <Text style={styles.successCardMeta}>{DEFAULT_SESSION.location}</Text>
            </View>
            <PopIn delay={520} style={styles.successCardBadge}>
              <Feather name="shield" size={14} color={colors.primary} />
              <Text style={styles.successBadgeText}>Verified</Text>
            </PopIn>
          </View>
        </AnimatedEntrance>

        <AnimatedEntrance delay={460} distance={14} style={styles.buttonWrap}>
          <AnimatedPressable
            accessibilityLabel="Return to attendance home"
            testID="return-home"
            onPress={onDone}
            haptic="medium"
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Back to home</Text>
            <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
          </AnimatedPressable>
        </AnimatedEntrance>
      </View>
    </View>
  );
});

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    successContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingBottom: 30 },
    iconWrap: { width: 130, height: 130, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    successRing: { position: 'absolute', width: 82, height: 82, borderRadius: 30, borderWidth: 2, borderColor: colors.primary },
    successIcon: { width: 82, height: 82, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    copy: { alignItems: 'center' },
    successEyebrow: { color: colors.primary, fontSize: 11, letterSpacing: 1.6, fontFamily: 'Inter_700Bold', textAlign: 'center' },
    successTitle: { color: colors.foreground, fontSize: 28, lineHeight: 34, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 10 },
    successDescription: { color: colors.mutedForeground, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', textAlign: 'center', maxWidth: 300, marginTop: 10 },
    cardWrap: { width: '100%', marginTop: 29 },
    successCard: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 17, gap: 12 },
    successCardCopy: { flex: 1 },
    successCardLabel: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
    successCardTitle: { color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 5 },
    successCardMeta: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
    successCardBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.accentSoft },
    successBadgeText: { color: colors.primary, fontSize: 10, fontFamily: 'Inter_600SemiBold' },
    buttonWrap: { width: '100%', marginTop: 26 },
    primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 54, paddingHorizontal: 18, borderRadius: 16, backgroundColor: colors.primary },
    primaryButtonText: { color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_700Bold' },
  });
}
