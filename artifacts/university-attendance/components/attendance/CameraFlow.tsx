import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import {
  AnimatedPressable,
  MOTION,
  ScannerBeam,
  ShakeView,
} from '@/components/Motion';
import { QR_SCANNER_SETTINGS } from '@/constants/attendance';

const FRAME_SIZE = 270;

type Props = {
  mode: 'scan' | 'selfie';
  /** Set once a selfie has been taken; switches the screen into review state. */
  selfieUri: string | null;
  scanError: string | null;
  onClose: () => void;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  onCaptured: (uri: string) => void;
  onCaptureFailed: () => void;
  onRetake: () => void;
  onConfirm: () => void;
  contentTop: number;
  contentBottom: number;
};

export const CameraFlow = React.memo(function CameraFlow({
  mode,
  selfieUri,
  scanError,
  onClose,
  onBarcodeScanned,
  onCaptured,
  onCaptureFailed,
  onRetake,
  onConfirm,
  contentTop,
  contentBottom,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const cameraRef = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const isSelfie = mode === 'selfie';
  const isReviewing = isSelfie && Boolean(selfieUri);

  // Shutter flash + ring, driven entirely on the UI thread so the capture
  // reads as instant even while the native photo write is still in flight.
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const captureSelfie = useCallback(async () => {
    const camera = cameraRef.current;
    if (!camera || isCapturing) return;
    setIsCapturing(true);
    flash.value = withSequence(
      withTiming(0.85, { duration: 60 }),
      withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }),
    );
    try {
      const photo = await camera.takePictureAsync({ quality: 0.65, skipProcessing: true });
      if (photo?.uri) onCaptured(photo.uri);
      else onCaptureFailed();
    } catch {
      onCaptureFailed();
    } finally {
      setIsCapturing(false);
    }
  }, [flash, isCapturing, onCaptured, onCaptureFailed]);

  return (
    <View style={styles.cameraScreen}>
      {/*
        The preview is unmounted while reviewing so the camera pipeline stops
        burning CPU/battery behind a still image the user is looking at.
      */}
      {!isReviewing && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={isSelfie ? 'front' : 'back'}
          barcodeScannerSettings={isSelfie ? undefined : QR_SCANNER_SETTINGS}
          onBarcodeScanned={isSelfie ? undefined : onBarcodeScanned}
        />
      )}
      {isReviewing && selfieUri && (
        <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
          <Image
            source={{ uri: selfieUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
          />
        </Animated.View>
      )}

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.flash, flashStyle]}
      />

      <View style={[styles.cameraShade, { paddingTop: contentTop, paddingBottom: contentBottom }]}>
        <AnimatedEntrance style={styles.cameraHeader} distance={10}>
          <AnimatedPressable
            accessibilityLabel="Close attendance flow"
            testID="close-attendance-flow"
            onPress={onClose}
            style={styles.iconButton}
          >
            <Feather name="x" size={22} color={colors.cameraText} />
          </AnimatedPressable>
          <View style={styles.cameraStepPill}>
            <StepDots active={isSelfie ? 1 : 0} color={colors.primary} idleColor={colors.cameraTextMuted} />
            <Text style={styles.cameraStepText}>{isSelfie ? '2 of 2' : '1 of 2'}</Text>
          </View>
          <View style={styles.iconButtonPlaceholder} />
        </AnimatedEntrance>

        <AnimatedEntrance style={styles.cameraCenter} delay={90} distance={18}>
          <View style={[styles.scanFrame, isSelfie && styles.selfieFrame]}>
            {!isSelfie && <ScannerBeam style={styles.scannerBeam} travel={FRAME_SIZE - 12} />}
            <BreathingCorners active={!isReviewing} styles={styles} />
            {isSelfie && !isReviewing && (
              <Feather name="user" size={70} color={colors.cameraText} style={styles.faceGuide} />
            )}
          </View>
          <Animated.View
            key={isReviewing ? 'review' : mode}
            entering={FadeIn.duration(260).delay(60)}
            exiting={FadeOut.duration(140)}
            style={styles.cameraInstruction}
          >
            <Text style={styles.cameraTitle}>
              {isReviewing ? 'Looks good?' : isSelfie ? 'Take a quick selfie' : 'Scan attendance QR'}
            </Text>
            <Text style={styles.cameraDescription}>
              {isReviewing
                ? 'Confirm to submit this photo with your check-in, or retake it.'
                : isSelfie
                  ? 'Keep your face inside the frame and look at the camera.'
                  : 'Point your camera at the code shown by your instructor.'}
            </Text>
          </Animated.View>
        </AnimatedEntrance>

        <AnimatedEntrance style={styles.cameraFooter} delay={160} distance={10}>
          {scanError && (
            <ShakeView trigger={scanError}>
              <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.cameraError}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={styles.cameraErrorText}>{scanError}</Text>
              </Animated.View>
            </ShakeView>
          )}

          {isReviewing ? (
            <Animated.View entering={FadeIn.duration(240)} style={styles.reviewActions}>
              <AnimatedPressable
                accessibilityLabel="Retake selfie"
                testID="retake-selfie"
                onPress={onRetake}
                style={styles.secondaryAction}
              >
                <Feather name="rotate-ccw" size={17} color={colors.cameraText} />
                <Text style={styles.secondaryActionText}>Retake</Text>
              </AnimatedPressable>
              <AnimatedPressable
                accessibilityLabel="Confirm selfie and submit attendance"
                testID="confirm-selfie"
                onPress={onConfirm}
                haptic="medium"
                style={styles.confirmAction}
              >
                <Text style={styles.confirmActionText}>Confirm check-in</Text>
                <Feather name="arrow-right" size={17} color={colors.primaryForeground} />
              </AnimatedPressable>
            </Animated.View>
          ) : isSelfie ? (
            <AnimatedPressable
              accessibilityLabel="Capture selfie"
              testID="capture-selfie"
              onPress={captureSelfie}
              disabled={isCapturing}
              haptic="medium"
              pressedScale={0.9}
              style={styles.shutterOuter}
            >
              {isCapturing ? (
                <ActivityIndicator color={colors.overlay} />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </AnimatedPressable>
          ) : (
            <Animated.View entering={FadeIn.duration(300).delay(200)} style={styles.scanHint}>
              <Feather name="maximize" size={18} color={colors.cameraText} />
              <Text style={styles.scanHintText}>Scanning automatically</Text>
            </Animated.View>
          )}
        </AnimatedEntrance>
      </View>
    </View>
  );
});

/**
 * The four viewfinder corners breathe in and out together. It is the cheapest
 * possible signal that the scanner is alive and looking.
 */
function BreathingCorners({
  active,
  styles,
}: {
  active: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!active || reduceMotion) {
      progress.value = withTiming(0, { duration: 200 });
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [active, progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.6, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.97, 1.02]) }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <View style={[styles.frameCorner, styles.frameTopLeft]} />
      <View style={[styles.frameCorner, styles.frameTopRight]} />
      <View style={[styles.frameCorner, styles.frameBottomLeft]} />
      <View style={[styles.frameCorner, styles.frameBottomRight]} />
    </Animated.View>
  );
}

/** Two-step progress indicator inside the header pill. */
function StepDots({
  active,
  color,
  idleColor,
}: {
  active: number;
  color: string;
  idleColor: string;
}) {
  const progress = useSharedValue(active);

  useEffect(() => {
    progress.value = withSpring(active, MOTION.settle);
  }, [active, progress]);

  const first = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [16, 6]),
    opacity: interpolate(progress.value, [0, 1], [1, 0.5]),
  }));
  const second = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [6, 16]),
    opacity: interpolate(progress.value, [0, 1], [0.5, 1]),
  }));

  return (
    <View style={dotStyles.row}>
      <Animated.View style={[dotStyles.dot, { backgroundColor: active === 0 ? color : idleColor }, first]} />
      <Animated.View style={[dotStyles.dot, { backgroundColor: active === 1 ? color : idleColor }, second]} />
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { height: 6, borderRadius: 3 },
});

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    cameraScreen: { flex: 1, backgroundColor: colors.overlay },
    flash: { backgroundColor: '#ffffff' },
    cameraShade: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingHorizontal: 22 },
    cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cameraSurface, alignItems: 'center', justifyContent: 'center' },
    iconButtonPlaceholder: { width: 42, height: 42 },
    cameraStepPill: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.cameraSurface },
    cameraStepText: { color: colors.cameraText, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
    cameraCenter: { alignItems: 'center', justifyContent: 'center', marginTop: -20 },
    scanFrame: { width: FRAME_SIZE, height: FRAME_SIZE, position: 'relative' },
    scannerBeam: { position: 'absolute', left: 10, right: 10, top: 0, height: 2, borderRadius: 2, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.8, shadowRadius: 7, elevation: 4 },
    selfieFrame: { borderRadius: FRAME_SIZE / 2, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(246,251,255,0.32)', alignItems: 'center', justifyContent: 'center' },
    frameCorner: { position: 'absolute', width: 30, height: 30, borderColor: colors.primary, zIndex: 2 },
    frameTopLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
    frameTopRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
    frameBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
    frameBottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
    faceGuide: { opacity: 0.7 },
    cameraInstruction: { alignItems: 'center', marginTop: 26, paddingHorizontal: 30 },
    cameraTitle: { color: colors.cameraText, fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
    cameraDescription: { color: colors.cameraTextMuted, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8, maxWidth: 290 },
    cameraFooter: { alignItems: 'center', justifyContent: 'flex-end', minHeight: 122 },
    cameraError: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: colors.cameraSurface, marginBottom: 14 },
    cameraErrorText: { color: colors.cameraText, fontSize: 12, fontFamily: 'Inter_500Medium', maxWidth: 285 },
    shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.cameraText, alignItems: 'center', justifyContent: 'center' },
    shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.cameraText },
    scanHint: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.cameraSurface },
    scanHintText: { color: colors.cameraText, fontSize: 12, fontFamily: 'Inter_500Medium' },
    reviewActions: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
    secondaryAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 52, paddingHorizontal: 18, borderRadius: 16, backgroundColor: colors.cameraSurface },
    secondaryActionText: { color: colors.cameraText, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    confirmAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 16, backgroundColor: colors.primary },
    confirmActionText: { color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_700Bold' },
  });
}
