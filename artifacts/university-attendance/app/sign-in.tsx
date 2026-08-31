import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useAuth, useSignIn, useSSO } from '@clerk/expo';
import { Link, type Href, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AnimatedPressable } from '@/components/Motion';

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignInScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const styles = useMemo(() => createAuthStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const isLoading = fetchStatus === 'fetching';

  const goHome = useCallback(async () => {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) return;
        const url = decorateUrl('/');
        router.replace(url as Href);
      },
    });
  }, [router, signIn]);

  const handleSubmit = useCallback(async () => {
    const { error } = await signIn.password({ emailAddress: emailAddress.trim(), password });
    if (error) return;
    if (signIn.status === 'complete') {
      await goHome();
    }
  }, [emailAddress, goHome, password, signIn]);

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleError(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({ scheme: 'university-attendance' }),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            router.replace(decorateUrl('/') as Href);
          },
        });
      }
    } catch {
      setGoogleError('Google sign-in was cancelled or could not be completed.');
    }
  }, [router, startSSOFlow]);

  const handleVerify = useCallback(async () => {
    await signIn.mfa.verifyEmailCode({ code });
    if (signIn.status === 'complete') await goHome();
  }, [code, goHome, signIn]);

  if (isSignedIn) {
    return null;
  }

  const needsVerification = signIn.status === 'needs_client_trust';
  const errorMessage =
    googleError ||
    errors.fields.identifier?.message ||
    errors.fields.password?.message ||
    errors.fields.code?.message;

  return (
    <View style={[styles.screen, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.scrollContent, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedEntrance style={styles.brandRow} distance={10}>
          <View style={styles.brandMark}>
            <Feather name="check" size={18} color={colors.primaryForeground} />
          </View>
          <Text style={styles.brandName}>CAMPUS ENGINE</Text>
        </AnimatedEntrance>

        <AnimatedEntrance style={styles.intro} delay={90} distance={14}>
          <Text style={styles.eyebrow}>{needsVerification ? 'SECURITY CHECK' : 'STUDENT PORTAL'}</Text>
          <Text style={styles.title}>{needsVerification ? 'Verify your sign-in' : 'Welcome back'}</Text>
          <Text style={styles.subtitle}>
            {needsVerification
              ? 'Enter the code sent to your email to finish signing in.'
              : 'Sign in to check in to class and keep your attendance record in one place.'}
          </Text>
        </AnimatedEntrance>

        <AnimatedEntrance style={styles.formCard} delay={160} distance={18}>
          {needsVerification ? (
            <>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                testID="verification-code"
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Enter your 6-digit code"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                autoFocus
              />
              <AnimatedPressable
                testID="verify-sign-in"
                onPress={handleVerify}
                disabled={!code || isLoading}
                style={[styles.primaryButton, (!code || isLoading) && styles.disabledButton]}
              >
                {isLoading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryButtonText}>Verify and continue</Text>}
              </AnimatedPressable>
              <Pressable onPress={() => signIn.reset()} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                <Text style={styles.textButtonText}>Start over</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>University email</Text>
              <View style={styles.inputWrap}>
                <Feather name="mail" size={17} color={colors.mutedForeground} />
                <TextInput
                  testID="sign-in-email"
                  style={styles.inputInline}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={emailAddress}
                  onChangeText={setEmailAddress}
                  placeholder="you@university.edu"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={17} color={colors.mutedForeground} />
                <TextInput
                  testID="sign-in-password"
                  style={styles.inputInline}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={10}
                >
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={17} color={colors.mutedForeground} />
                </Pressable>
              </View>
              {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
              <AnimatedPressable
                testID="sign-in-submit"
                onPress={handleSubmit}
                disabled={!emailAddress.trim() || !password || isLoading}
                style={[styles.primaryButton, (!emailAddress.trim() || !password || isLoading) && styles.disabledButton]}
              >
                {isLoading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryButtonText}>Continue</Text>}
                {!isLoading && <Feather name="arrow-right" size={18} color={colors.primaryForeground} />}
              </AnimatedPressable>
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.divider} />
              </View>
              <AnimatedPressable
                testID="google-sign-in"
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                style={styles.googleButton}
              >
                <View style={styles.googleIcon}><Text style={styles.googleG}>G</Text></View>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </AnimatedPressable>
            </>
          )}
        </AnimatedEntrance>

        {!needsVerification && (
          <AnimatedEntrance style={styles.bottomPrompt} delay={240} distance={10}>
            <Text style={styles.promptText}>New to Campus Engine?</Text>
            <Link href={'/sign-up' as Href} asChild>
              <Pressable>
                <Text style={styles.linkText}>Create account</Text>
              </Pressable>
            </Link>
          </AnimatedEntrance>
        )}
        {!needsVerification && (
          <AnimatedEntrance delay={290} distance={10}>
            <Link href={'/?demo=1' as Href} asChild>
              <Pressable style={({ pressed }) => [styles.demoLink, pressed && styles.pressed]}>
                <Feather name="play-circle" size={14} color={colors.accentForeground} />
                <Text style={styles.demoLinkText}>Explore demo with sample data</Text>
              </Pressable>
            </Link>
          </AnimatedEntrance>
        )}
        <AnimatedEntrance style={styles.privacyRow} delay={340} distance={8}>
          <Feather name="shield" size={13} color={colors.mutedForeground} />
          <Text style={styles.privacyText}>Secure student access · Your attendance stays private</Text>
        </AnimatedEntrance>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function createAuthStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, justifyContent: 'center' },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' },
    brandMark: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    brandName: { color: colors.foreground, fontSize: 12, letterSpacing: 1.5, fontFamily: 'Inter_700Bold' },
    intro: { marginTop: 46, alignItems: 'center' },
    eyebrow: { color: colors.primary, fontSize: 10, letterSpacing: 1.6, fontFamily: 'Inter_700Bold' },
    title: { color: colors.foreground, fontSize: 31, lineHeight: 38, fontFamily: 'Inter_700Bold', marginTop: 10, textAlign: 'center' },
    subtitle: { color: colors.mutedForeground, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', textAlign: 'center', maxWidth: 310, marginTop: 10 },
    formCard: { backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, marginTop: 29 },
    label: { color: colors.secondaryForeground, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 8, marginTop: 12 },
    input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.muted, color: colors.foreground, paddingHorizontal: 14, fontSize: 14, fontFamily: 'Inter_400Regular' },
    inputWrap: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.muted, paddingHorizontal: 14 },
    inputInline: { flex: 1, color: colors.foreground, fontSize: 14, fontFamily: 'Inter_400Regular', paddingVertical: 13 },
    errorText: { color: colors.destructive, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: 10 },
    primaryButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 15, backgroundColor: colors.primary, marginTop: 20 },
    primaryButtonText: { color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_700Bold' },
    disabledButton: { opacity: 0.42 },
    pressed: { opacity: 0.75 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
    divider: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 1.2, fontFamily: 'Inter_600SemiBold' },
    googleButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary },
    googleIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.foreground },
    googleG: { color: colors.background, fontSize: 13, fontFamily: 'Inter_700Bold' },
    googleButtonText: { color: colors.secondaryForeground, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    textButton: { alignSelf: 'center', marginTop: 18, padding: 5 },
    textButtonText: { color: colors.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    bottomPrompt: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 22 },
    promptText: { color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' },
    linkText: { color: colors.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    demoLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', marginTop: 18, padding: 5 },
    demoLinkText: { color: colors.accentForeground, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
    privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28 },
    privacyText: { color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_400Regular' },
  });
}
