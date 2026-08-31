import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSignUp, useAuth } from '@clerk/expo';
import { Link, type Href, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

export default function SignUpScreen() {
  const colors = useColors();
  const styles = useMemo(() => createSignUpStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const isLoading = fetchStatus === 'fetching';
  const needsVerification = signUp.status === 'missing_requirements' && signUp.unverifiedFields.includes('email_address');

  const finish = async () => {
    await signUp.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) return;
        router.replace(decorateUrl('/') as Href);
      },
    });
  };

  const handleSubmit = async () => {
    const { error } = await signUp.password({ emailAddress: emailAddress.trim(), password });
    if (!error) await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === 'complete') await finish();
  };

  if (isSignedIn) return null;

  return (
    <View style={[styles.screen, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.scrollContent, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><Feather name="check" size={18} color={colors.primaryForeground} /></View>
          <Text style={styles.brandName}>CAMPUS CHECK</Text>
        </View>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>{needsVerification ? 'VERIFY EMAIL' : 'STUDENT PORTAL'}</Text>
          <Text style={styles.title}>{needsVerification ? 'Check your inbox' : 'Create your account'}</Text>
          <Text style={styles.subtitle}>
            {needsVerification ? 'Enter the verification code we sent to finish setting up your account.' : 'Use your university email to start checking in to class.'}
          </Text>
        </View>
        <View style={styles.formCard}>
          {needsVerification ? (
            <>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                testID="sign-up-code"
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Enter your 6-digit code"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                autoFocus
              />
              {errors.fields.code && <Text style={styles.errorText}>{errors.fields.code.message}</Text>}
              <Pressable
                testID="verify-sign-up"
                onPress={handleVerify}
                disabled={!code || isLoading}
                style={({ pressed }) => [styles.primaryButton, (!code || isLoading) && styles.disabledButton, pressed && styles.pressed]}
              >
                {isLoading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryButtonText}>Verify email</Text>}
              </Pressable>
              <Pressable onPress={() => signUp.verifications.sendEmailCode()} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                <Text style={styles.textButtonText}>Send a new code</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>University email</Text>
              <View style={styles.inputWrap}>
                <Feather name="mail" size={17} color={colors.mutedForeground} />
                <TextInput testID="sign-up-email" style={styles.inputInline} autoCapitalize="none" keyboardType="email-address" value={emailAddress} onChangeText={setEmailAddress} placeholder="you@university.edu" placeholderTextColor={colors.mutedForeground} />
              </View>
              {errors.fields.emailAddress && <Text style={styles.errorText}>{errors.fields.emailAddress.message}</Text>}
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={17} color={colors.mutedForeground} />
                <TextInput testID="sign-up-password" style={styles.inputInline} secureTextEntry value={password} onChangeText={setPassword} placeholder="Create a password" placeholderTextColor={colors.mutedForeground} />
              </View>
              {errors.fields.password && <Text style={styles.errorText}>{errors.fields.password.message}</Text>}
              <Pressable testID="sign-up-submit" onPress={handleSubmit} disabled={!emailAddress.trim() || !password || isLoading} style={({ pressed }) => [styles.primaryButton, (!emailAddress.trim() || !password || isLoading) && styles.disabledButton, pressed && styles.pressed]}>
                {isLoading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryButtonText}>Create account</Text>}
                {!isLoading && <Feather name="arrow-right" size={18} color={colors.primaryForeground} />}
              </Pressable>
            </>
          )}
        </View>
        <View style={styles.bottomPrompt}>
          <Text style={styles.promptText}>Already have an account?</Text>
          <Link href={'/sign-in' as Href} asChild><Pressable><Text style={styles.linkText}>Sign in</Text></Pressable></Link>
        </View>
        <View nativeID="clerk-captcha" />
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function createSignUpStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, justifyContent: 'center' },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' },
    brandMark: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    brandName: { color: colors.foreground, fontSize: 12, letterSpacing: 1.5, fontFamily: 'Inter_700Bold' },
    intro: { marginTop: 46, alignItems: 'center' },
    eyebrow: { color: colors.primary, fontSize: 10, letterSpacing: 1.6, fontFamily: 'Inter_700Bold' },
    title: { color: colors.foreground, fontSize: 30, lineHeight: 37, fontFamily: 'Inter_700Bold', marginTop: 10, textAlign: 'center' },
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
    textButton: { alignSelf: 'center', marginTop: 18, padding: 5 },
    textButtonText: { color: colors.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    bottomPrompt: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 22 },
    promptText: { color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' },
    linkText: { color: colors.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  });
}