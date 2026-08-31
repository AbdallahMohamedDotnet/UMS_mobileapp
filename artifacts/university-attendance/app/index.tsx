import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Redirect, type Href, useLocalSearchParams } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type AttendanceRecord = {
  id: string;
  course: string;
  location: string;
  dateLabel: string;
  timeLabel: string;
  status: 'Present' | 'Pending';
};

type MockStudent = {
  id: string;
  name: string;
  initials: string;
  program: string;
  attendance: string;
};

type FlowStep = 'home' | 'scan' | 'qr-validating' | 'selfie' | 'submitting' | 'success';

const STORAGE_KEY = '@university-attendance/history';
const DEFAULT_SESSION = {
  course: 'Software Engineering',
  location: 'Innovation Hall · Room 204',
  startsAt: '09:00 AM',
};

const MOCK_STUDENTS: MockStudent[] = [
  { id: 'youssef', name: 'Youssef Magdy', initials: 'YM', program: 'Computer Science', attendance: '96%' },
  { id: 'mariam', name: 'Mariam Adel', initials: 'MA', program: 'Software Engineering', attendance: '91%' },
  { id: 'karim', name: 'Karim Nabil', initials: 'KN', program: 'Information Systems', attendance: '88%' },
];

const MOCK_ATTENDANCE: AttendanceRecord[] = [
  { id: 'mock-1', course: 'Software Engineering', location: 'Innovation Hall · Room 204', dateLabel: 'Aug 29, 2026', timeLabel: '9:04 AM', status: 'Present' },
  { id: 'mock-2', course: 'Database Systems', location: 'Science Block · Room 110', dateLabel: 'Aug 27, 2026', timeLabel: '11:02 AM', status: 'Present' },
  { id: 'mock-3', course: 'Human Computer Interaction', location: 'Design Lab · Room 12', dateLabel: 'Aug 25, 2026', timeLabel: '1:01 PM', status: 'Present' },
];

function isLikelyAttendanceCode(payload: string) {
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    return Boolean(parsed.sessionId || parsed.session || parsed.attendanceToken || parsed.course);
  } catch {
    // University systems often use opaque signed tokens rather than JSON.
    return payload.length >= 8;
  }
}

function makeId() {
  return `${Date.now().toString()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AttendanceHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const isDemoMode = demo === '1';
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cameraRef = useRef<CameraView>(null);
  const [flow, setFlow] = useState<FlowStep>('home');
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState('');
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [selectedMockStudent, setSelectedMockStudent] = useState('youssef');
  const [scanError, setScanError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState('Checking QR code');
  const userStorageKey = user?.id ? `${STORAGE_KEY}:${user.id}` : null;
  const activeMockStudent = MOCK_STUDENTS.find((student) => student.id === selectedMockStudent) || MOCK_STUDENTS[0];
  const displayName = isDemoMode ? activeMockStudent.name.split(' ')[0] : user?.firstName || 'Student';
  const initials = isDemoMode
    ? activeMockStudent.initials
    : (user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || 'S').toUpperCase();
  const isDemoHistory = history.length === 0;
  const visibleHistory = isDemoHistory ? MOCK_ATTENDANCE : history;

  useEffect(() => {
    if (!userStorageKey) return;
    AsyncStorage.getItem(userStorageKey)
      .then((stored) => {
        if (stored) {
          setHistory(JSON.parse(stored) as AttendanceRecord[]);
        }
      })
      .catch(() => {
        setHistory([]);
      });
  }, [userStorageKey]);

  const triggerFeedback = useCallback(async (kind: 'success' | 'warning' | 'error') => {
    await Haptics.notificationAsync(
      kind === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : kind === 'warning'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error,
    );
  }, []);

  const beginAttendance = useCallback(async () => {
    setScanError(null);
    setSelfieUri(null);
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        setScanError('Camera access is needed to scan the attendance code and capture your selfie.');
        return;
      }
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlow('scan');
  }, [cameraPermission?.granted, requestCameraPermission]);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (flow !== 'scan') return;
      const payload = result.data.trim();
      if (!payload) {
        setScanError('That code is empty. Try scanning the attendance QR code again.');
        return;
      }
      setScannedData(payload);
      setScanError(null);
      setFlow('qr-validating');
      void triggerFeedback('success');
    },
    [flow, triggerFeedback],
  );

  useEffect(() => {
    if (flow !== 'qr-validating') return;
    setValidationMessage('Checking QR code');
    const firstTimer = setTimeout(() => setValidationMessage('Confirming today’s class'), 600);
    const secondTimer = setTimeout(() => setValidationMessage('QR code accepted'), 1250);
    const completeTimer = setTimeout(() => {
      if (isLikelyAttendanceCode(scannedData)) {
        setFlow('selfie');
      } else {
        setScanError('This does not look like an active university attendance code.');
        setFlow('scan');
        void triggerFeedback('error');
      }
    }, 1700);
    return () => {
      clearTimeout(firstTimer);
      clearTimeout(secondTimer);
      clearTimeout(completeTimer);
    };
  }, [flow, scannedData, triggerFeedback]);

  const captureSelfie = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.75,
        skipProcessing: false,
      });
      if (photo?.uri) {
        setSelfieUri(photo.uri);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      setScanError('We could not capture the selfie. Please try again.');
      await triggerFeedback('error');
    }
  }, [triggerFeedback]);

  const submitAttendance = useCallback(async () => {
    if (!selfieUri) return;
    setFlow('submitting');
    setValidationMessage('Sending secure check-in');
    await new Promise((resolve) => setTimeout(resolve, 800));
    setValidationMessage('Matching selfie to student profile');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setValidationMessage('Attendance confirmed');
    await new Promise((resolve) => setTimeout(resolve, 700));

    const now = new Date();
    const nextRecord: AttendanceRecord = {
      id: makeId(),
      course: DEFAULT_SESSION.course,
      location: DEFAULT_SESSION.location,
      dateLabel: formatDate(now),
      timeLabel: formatTime(now),
      status: 'Present',
    };
    const nextHistory = [nextRecord, ...history];
    setHistory(nextHistory);
    await AsyncStorage.setItem(userStorageKey || STORAGE_KEY, JSON.stringify(nextHistory));
    setFlow('success');
    await triggerFeedback('success');
  }, [history, selfieUri, triggerFeedback, userStorageKey]);

  const resetFlow = useCallback(() => {
    setFlow('home');
    setScannedData('');
    setSelfieUri(null);
    setScanError(null);
  }, []);

  const contentTop = Platform.OS === 'web' ? 67 : insets.top;
  const contentBottom = Platform.OS === 'web' ? 34 : insets.bottom;

  if (!isSignedIn && !isDemoMode) {
    return <Redirect href={'/sign-in' as Href} />;
  }

  if (flow === 'scan' || flow === 'selfie') {
    const isSelfie = flow === 'selfie';
    return (
      <View style={styles.cameraScreen}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={isSelfie ? 'front' : 'back'}
          barcodeScannerSettings={isSelfie ? undefined : { barcodeTypes: ['qr'] }}
          onBarcodeScanned={isSelfie ? undefined : handleBarcodeScanned}
        />
        <View style={[styles.cameraShade, { paddingTop: contentTop, paddingBottom: contentBottom }]}>
          <View style={styles.cameraHeader}>
            <Pressable
              accessibilityLabel="Close attendance flow"
              testID="close-attendance-flow"
              onPress={resetFlow}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <View style={styles.cameraStepPill}>
              <Text style={styles.cameraStepText}>{isSelfie ? '2 of 2' : '1 of 2'}</Text>
            </View>
            <View style={styles.iconButtonPlaceholder} />
          </View>

          <View style={styles.cameraCenter}>
            <View style={[styles.scanFrame, isSelfie && styles.selfieFrame]}>
              <View style={[styles.frameCorner, styles.frameTopLeft]} />
              <View style={[styles.frameCorner, styles.frameTopRight]} />
              <View style={[styles.frameCorner, styles.frameBottomLeft]} />
              <View style={[styles.frameCorner, styles.frameBottomRight]} />
              {isSelfie && <Feather name="user" size={70} color={colors.foreground} style={styles.faceGuide} />}
            </View>
            <View style={styles.cameraInstruction}>
              <Text style={styles.cameraTitle}>
                {isSelfie ? 'Take a quick selfie' : 'Scan attendance QR'}
              </Text>
              <Text style={styles.cameraDescription}>
                {isSelfie
                  ? 'Keep your face inside the frame and look at the camera.'
                  : 'Point your camera at the code shown by your instructor.'}
              </Text>
            </View>
          </View>

          <View style={styles.cameraFooter}>
            {scanError && (
              <View style={styles.cameraError}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={styles.cameraErrorText}>{scanError}</Text>
              </View>
            )}
            {isSelfie ? (
              <Pressable
                accessibilityLabel="Capture selfie"
                testID="capture-selfie"
                onPress={captureSelfie}
                style={({ pressed }) => [styles.shutterOuter, pressed && styles.pressed]}
              >
                <View style={styles.shutterInner} />
              </Pressable>
            ) : (
              <View style={styles.scanHint}>
                <Feather name="maximize" size={18} color={colors.accentForeground} />
                <Text style={styles.scanHintText}>Scanning automatically</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (flow === 'qr-validating' || flow === 'submitting') {
    return (
      <View style={[styles.root, { paddingTop: contentTop, paddingBottom: contentBottom }]}>
        <View style={styles.validationHeader}>
          <View style={styles.brandMarkSmall}>
            <Feather name="check" size={16} color={colors.primaryForeground} />
          </View>
          <Text style={styles.brandWordmark}>CAMPUS ENGINE</Text>
        </View>
        <View style={styles.validationContent}>
          <View style={styles.loadingOrb}>
            <ActivityIndicator size="large" color={colors.primary} />
            <View style={styles.loadingOrbDot} />
          </View>
          <Text style={styles.validationEyebrow}>{flow === 'submitting' ? 'SECURE VALIDATION' : 'QR VALIDATION'}</Text>
          <Text style={styles.validationTitle}>{validationMessage}</Text>
          <Text style={styles.validationDescription}>
            {flow === 'submitting'
              ? 'Your QR check-in and selfie are being checked together. Keep this screen open.'
              : 'We’re verifying this session before asking for your selfie.'}
          </Text>
          <View style={styles.validationSteps}>
            <ValidationRow label="QR code captured" done />
            <ValidationRow label="Session is active" done={flow === 'submitting' || validationMessage !== 'Checking QR code'} />
            <ValidationRow label="Identity confirmation" done={flow === 'submitting'} active={flow === 'submitting'} />
          </View>
        </View>
      </View>
    );
  }

  if (flow === 'success') {
    return (
      <View style={[styles.root, { paddingTop: contentTop, paddingBottom: contentBottom }]}>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Feather name="check" size={38} color={colors.primaryForeground} />
          </View>
          <Text style={styles.successEyebrow}>CHECK-IN COMPLETE</Text>
          <Text style={styles.successTitle}>You’re marked present.</Text>
          <Text style={styles.successDescription}>
            Your attendance for today’s session was verified successfully.
          </Text>
          <View style={styles.successCard}>
            <View>
              <Text style={styles.successCardLabel}>SESSION</Text>
              <Text style={styles.successCardTitle}>{DEFAULT_SESSION.course}</Text>
              <Text style={styles.successCardMeta}>{DEFAULT_SESSION.location}</Text>
            </View>
            <View style={styles.successCardBadge}>
              <Feather name="shield" size={14} color={colors.primary} />
              <Text style={styles.successBadgeText}>Verified</Text>
            </View>
          </View>
          <Pressable
            accessibilityLabel="Return to attendance home"
            testID="return-home"
            onPress={resetFlow}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Back to home</Text>
            <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: contentTop, paddingBottom: contentBottom }]}>
      <FlatList
        data={showHistory ? visibleHistory : []}
        keyExtractor={(item) => item.id}
        scrollEnabled={showHistory && history.length > 0}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <View>
                <Text style={styles.overline}>{isDemoMode ? 'DEMO PREVIEW · SAMPLE DATA' : 'MONDAY · AUG 31'}</Text>
                <Text style={styles.greeting}>Good morning, {displayName}</Text>
              </View>
              <View style={styles.profileBubble}>
                <Text style={styles.profileInitials}>{initials}</Text>
              </View>
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroGlow} />
              <View style={styles.heroTopline}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>NEXT SESSION</Text>
                <Text style={styles.timeText}>{DEFAULT_SESSION.startsAt}</Text>
              </View>
              <Text style={styles.heroTitle}>Ready to check in?</Text>
              <Text style={styles.heroDescription}>
                Be in the room, scan the code, and verify your presence in under a minute.
              </Text>
              <Pressable
                accessibilityLabel="Start attendance check in"
                testID="start-attendance"
                onPress={beginAttendance}
                style={({ pressed }) => [styles.primaryButton, styles.heroButton, pressed && styles.pressed]}
              >
                <Feather name="maximize" size={18} color={colors.primaryForeground} />
                <Text style={styles.primaryButtonText}>Start attendance</Text>
              </Pressable>
            </View>

            <View style={styles.sessionRow}>
              <View style={styles.sessionIcon}>
                <Feather name="book-open" size={18} color={colors.accentForeground} />
              </View>
              <View style={styles.sessionCopy}>
                <Text style={styles.sessionLabel}>TODAY’S SESSION</Text>
                <Text style={styles.sessionTitle}>{DEFAULT_SESSION.course}</Text>
                <Text style={styles.sessionMeta}>{DEFAULT_SESSION.location}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>

            <View style={styles.profilesSection}>
              <View style={styles.profileSectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Student profiles</Text>
                  <Text style={styles.sectionSubline}>Classmates in your cohort</Text>
                </View>
                <View style={styles.demoPill}>
                  <Feather name="eye" size={12} color={colors.accentForeground} />
                  <Text style={styles.demoPillText}>DEMO</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileCards}>
                {MOCK_STUDENTS.map((student) => {
                  const isSelected = student.id === selectedMockStudent;
                  return (
                    <Pressable
                      key={student.id}
                      testID={`mock-student-${student.id}`}
                      onPress={() => setSelectedMockStudent(student.id)}
                      style={({ pressed }) => [
                        styles.mockProfileCard,
                        isSelected && styles.mockProfileCardSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.mockAvatar, isSelected && styles.mockAvatarSelected]}>
                        <Text style={[styles.mockAvatarText, isSelected && styles.mockAvatarTextSelected]}>{student.initials}</Text>
                      </View>
                      <Text style={styles.mockProfileName}>{student.name}</Text>
                      <Text style={styles.mockProfileProgram}>{student.program}</Text>
                      <View style={styles.mockProfileFooter}>
                        <Text style={styles.mockProfileLabel}>ATTENDANCE</Text>
                        <Text style={styles.mockProfileRate}>{student.attendance}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={styles.demoCaption}>Preview only · selecting a profile does not change your account</Text>
            </View>

            <View style={styles.sectionHeader}>
              <View style={styles.historyTitleRow}>
                <Text style={styles.sectionTitle}>Attendance history</Text>
                {isDemoHistory && (
                  <View style={styles.sampleBadge}>
                    <Text style={styles.sampleBadgeText}>SAMPLE</Text>
                  </View>
                )}
              </View>
              <Pressable
                accessibilityLabel={showHistory ? 'Hide attendance history' : 'Show attendance history'}
                testID="toggle-history"
                onPress={() => setShowHistory((value) => !value)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.sectionAction}>{showHistory ? 'Hide' : 'View all'}</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="calendar" size={20} color={colors.mutedForeground} />
            </View>
                <Text style={styles.emptyTitle}>{showHistory ? 'No check-ins yet' : 'Your record is clear'}</Text>
            <Text style={styles.emptyDescription}>
              {showHistory ? 'Completed attendance sessions will appear here.' : 'Complete your first check-in to start your attendance record.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <AttendanceRow item={item} styles={styles} colors={colors} />}
        ListFooterComponent={
          <View style={styles.footerNote}>
            <Feather name="lock" size={13} color={colors.mutedForeground} />
            <Text style={styles.footerText}>Your selfie is used only for this check-in</Text>
          </View>
        }
      />
    </View>
  );
}

function ValidationRow({ label, done, active = false }: { label: string; done: boolean; active?: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.validationRow}>
      <View style={[styles.validationCheck, done && styles.validationCheckDone]}>
        {active ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : done ? <Feather name="check" size={13} color={colors.primaryForeground} /> : null}
      </View>
      <Text style={[styles.validationRowText, done && styles.validationRowTextDone]}>{label}</Text>
    </View>
  );
}

function AttendanceRow({
  item,
  styles,
  colors,
}: {
  item: AttendanceRecord;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyDate}>
        <Text style={styles.historyDateText}>{item.dateLabel.split(' ')[1]?.replace(',', '') ?? '--'}</Text>
        <Text style={styles.historyMonthText}>{item.dateLabel.split(' ')[0]}</Text>
      </View>
      <View style={styles.historyCopy}>
        <Text style={styles.historyTitle}>{item.course}</Text>
        <Text style={styles.historyMeta}>{item.timeLabel} · {item.location}</Text>
      </View>
      <View style={styles.presentBadge}>
        <View style={styles.presentDot} />
        <Text style={[styles.presentText, { color: colors.primary }]}>{item.status}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 18 },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingBottom: 26 },
    overline: { color: colors.mutedForeground, fontSize: 11, letterSpacing: 1.4, fontFamily: 'Inter_600SemiBold' },
    greeting: { color: colors.foreground, fontSize: 25, lineHeight: 32, fontFamily: 'Inter_700Bold', marginTop: 5 },
    profileBubble: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    profileInitials: { color: colors.accentForeground, fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
    heroCard: { overflow: 'hidden', borderRadius: 26, padding: 22, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, minHeight: 264 },
    heroGlow: { position: 'absolute', right: -50, top: -75, width: 190, height: 190, borderRadius: 95, backgroundColor: colors.accent, opacity: 0.75 },
    heroTopline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
    statusText: { color: colors.accentForeground, fontSize: 11, letterSpacing: 1.3, fontFamily: 'Inter_700Bold' },
    timeText: { color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium', marginLeft: 'auto' },
    heroTitle: { color: colors.foreground, fontSize: 28, lineHeight: 34, fontFamily: 'Inter_700Bold', marginTop: 28, maxWidth: 260 },
    heroDescription: { color: colors.secondaryForeground, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', maxWidth: 300, marginTop: 10 },
    primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 54, paddingHorizontal: 18, borderRadius: 16, backgroundColor: colors.primary },
    heroButton: { alignSelf: 'flex-start', marginTop: 22, minHeight: 48, paddingHorizontal: 17 },
    primaryButtonText: { color: colors.primaryForeground, fontSize: 14, fontFamily: 'Inter_700Bold' },
    pressed: { opacity: 0.76 },
    sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: colors.border },
    sessionIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    sessionCopy: { flex: 1 },
    sessionLabel: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 1.15, fontFamily: 'Inter_700Bold' },
    sessionTitle: { color: colors.foreground, fontSize: 15, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
    sessionMeta: { color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
    profilesSection: { paddingTop: 24, paddingBottom: 2 },
    profileSectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    sectionSubline: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
    demoPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.secondary },
    demoPillText: { color: colors.accentForeground, fontSize: 9, letterSpacing: 1, fontFamily: 'Inter_700Bold' },
    profileCards: { gap: 10, paddingTop: 13, paddingBottom: 6 },
    mockProfileCard: { width: 156, minHeight: 155, borderRadius: 17, padding: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    mockProfileCardSelected: { borderColor: colors.primary, backgroundColor: colors.secondary },
    mockAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    mockAvatarSelected: { backgroundColor: colors.primary },
    mockAvatarText: { color: colors.secondaryForeground, fontSize: 11, fontFamily: 'Inter_700Bold' },
    mockAvatarTextSelected: { color: colors.primaryForeground },
    mockProfileName: { color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 11 },
    mockProfileProgram: { color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
    mockProfileFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    mockProfileLabel: { color: colors.mutedForeground, fontSize: 8, letterSpacing: 0.6, fontFamily: 'Inter_700Bold' },
    mockProfileRate: { color: colors.accentForeground, fontSize: 12, fontFamily: 'Inter_700Bold' },
    demoCaption: { color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 25, paddingBottom: 14 },
    historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sampleBadge: { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: colors.secondary },
    sampleBadgeText: { color: colors.mutedForeground, fontSize: 8, letterSpacing: 0.7, fontFamily: 'Inter_700Bold' },
    sectionTitle: { color: colors.foreground, fontSize: 17, fontFamily: 'Inter_700Bold' },
    sectionAction: { color: colors.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 23, paddingBottom: 19 },
    emptyIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted, marginBottom: 12 },
    emptyTitle: { color: colors.secondaryForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
    emptyDescription: { color: colors.mutedForeground, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 6, maxWidth: 255 },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    historyDate: { width: 42, height: 48, borderRadius: 13, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    historyDateText: { color: colors.foreground, fontSize: 15, fontFamily: 'Inter_700Bold' },
    historyMonthText: { color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_600SemiBold', marginTop: 1 },
    historyCopy: { flex: 1 },
    historyTitle: { color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    historyMeta: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
    presentBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    presentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
    presentText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
    footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 26 },
    footerText: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular' },
    cameraScreen: { flex: 1, backgroundColor: colors.overlay },
    cameraShade: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingHorizontal: 22 },
    cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cameraSurface, alignItems: 'center', justifyContent: 'center' },
    iconButtonPlaceholder: { width: 42, height: 42 },
    cameraStepPill: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.cameraSurface },
    cameraStepText: { color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
    cameraCenter: { alignItems: 'center', justifyContent: 'center', marginTop: -20 },
    scanFrame: { width: 270, height: 270, position: 'relative' },
    selfieFrame: { borderRadius: 135, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(246,251,255,0.32)', alignItems: 'center', justifyContent: 'center' },
    frameCorner: { position: 'absolute', width: 30, height: 30, borderColor: colors.primary, zIndex: 2 },
    frameTopLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
    frameTopRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
    frameBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
    frameBottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
    faceGuide: { opacity: 0.7 },
    cameraInstruction: { alignItems: 'center', marginTop: 26, paddingHorizontal: 30 },
    cameraTitle: { color: colors.foreground, fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
    cameraDescription: { color: colors.cameraTextMuted, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8, maxWidth: 290 },
    cameraFooter: { alignItems: 'center', minHeight: 122 },
    cameraError: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: colors.cameraSurface, marginBottom: 14 },
    cameraErrorText: { color: colors.foreground, fontSize: 12, fontFamily: 'Inter_500Medium', maxWidth: 285 },
    shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.foreground, alignItems: 'center', justifyContent: 'center' },
    shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.foreground },
    scanHint: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.cameraSurface },
    scanHintText: { color: colors.accentForeground, fontSize: 12, fontFamily: 'Inter_500Medium' },
    validationHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 20, paddingTop: 16 },
    brandMarkSmall: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    brandWordmark: { color: colors.foreground, fontSize: 11, letterSpacing: 1.3, fontFamily: 'Inter_700Bold' },
    validationContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 40 },
    loadingOrb: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 28 },
    loadingOrbDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, top: 10, right: 18 },
    validationEyebrow: { color: colors.primary, fontSize: 11, letterSpacing: 1.6, fontFamily: 'Inter_700Bold' },
    validationTitle: { color: colors.foreground, fontSize: 25, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 10 },
    validationDescription: { color: colors.mutedForeground, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', textAlign: 'center', maxWidth: 300, marginTop: 10 },
    validationSteps: { width: '100%', borderTopWidth: 1, borderTopColor: colors.border, marginTop: 35, paddingTop: 9 },
    validationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 11 },
    validationCheck: { width: 23, height: 23, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    validationCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },
    validationRowText: { color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium' },
    validationRowTextDone: { color: colors.secondaryForeground },
    successContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingBottom: 30 },
    successIcon: { width: 82, height: 82, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
    successEyebrow: { color: colors.primary, fontSize: 11, letterSpacing: 1.6, fontFamily: 'Inter_700Bold' },
    successTitle: { color: colors.foreground, fontSize: 28, lineHeight: 34, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 10 },
    successDescription: { color: colors.mutedForeground, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', textAlign: 'center', maxWidth: 300, marginTop: 10 },
    successCard: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 17, marginTop: 29, gap: 12 },
    successCardLabel: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
    successCardTitle: { color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 5 },
    successCardMeta: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4, maxWidth: 180 },
    successCardBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.accent },
    successBadgeText: { color: colors.primary, fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  });
}