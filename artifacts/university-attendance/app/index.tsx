import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeSettings } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Redirect, type Href, useLocalSearchParams } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AnimatedPressable, PulsingView, ScannerBeam } from '@/components/Motion';

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
type HomePage = 'dashboard' | 'calendar' | 'grades' | 'settings';

const STORAGE_KEY = '@university-attendance/history';
const MAX_HISTORY_RECORDS = 100;
const QR_SCANNER_SETTINGS: BarcodeSettings = { barcodeTypes: ['qr'] };
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

const WEEK_DAYS = [
  { day: 'MON', date: '26', classes: [{ title: 'Software Engineering', code: 'SE 301', time: '10:00', room: 'B-204', color: 'terracotta' as const }, { title: 'AI: Search agents', code: 'CS 420', time: '1:30', room: 'Hall 3', color: 'olive' as const }] },
  { day: 'TUE', date: '27', classes: [{ title: 'Data Structures', code: 'CS 220', time: '9:00', room: 'C-310', color: 'ink' as const }, { title: 'Operating Systems', code: 'CS 318', time: '11:00', room: 'A-110', color: 'sky' as const }] },
  { day: 'WED', date: '28', classes: [{ title: 'Design doc sprint', code: 'SE 301', time: '11:59', room: 'Online', color: 'lavender' as const }, { title: 'Networks', code: 'CS 340', time: '2:00', room: 'C-310', color: 'olive' as const }] },
  { day: 'THU', date: '29', classes: [{ title: 'Networks: Transport', code: 'CS 340', time: '10:00', room: 'C-310', color: 'sky' as const }] },
  { day: 'FRI', date: '30', classes: [{ title: 'Lab 03 — Search agents', code: 'CS 420', time: '5:00', room: 'Lab 2', color: 'terracotta' as const }] },
  { day: 'SAT', date: '31', classes: [{ title: 'Quiz 05 — Scheduling', code: 'CS 318', time: '11:00', room: 'A-110', color: 'ink' as const }] },
  { day: 'SUN', date: '1', classes: [] },
];

const SUBJECTS = [
  { code: 'SE 301', title: 'Software engineering', instructor: 'Dr. Hala Ramadan', progress: 64, modules: '8 of 12', color: 'terracotta' as const, icon: 'layers' as const },
  { code: 'CS 220', title: 'Data structures & algorithms', instructor: 'Prof. Omar Khaled', progress: 78, modules: '11 of 14', color: 'ink' as const, icon: 'git-branch' as const },
  { code: 'CS 330', title: 'Database systems', instructor: 'Dr. Marwan Naquib', progress: 42, modules: '5 of 12', color: 'olive' as const, icon: 'database' as const },
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
  const [homePage, setHomePage] = useState<HomePage>('dashboard');
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
    let isActive = true;
    AsyncStorage.getItem(userStorageKey)
      .then((stored) => {
        if (stored && isActive) {
          const parsed = JSON.parse(stored) as unknown;
          setHistory(Array.isArray(parsed) ? (parsed as AttendanceRecord[]).slice(0, MAX_HISTORY_RECORDS) : []);
        }
      })
      .catch(() => {
        if (isActive) setHistory([]);
      });
    return () => {
      isActive = false;
    };
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
        quality: 0.65,
        skipProcessing: true,
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
    const nextHistory = [nextRecord, ...history].slice(0, MAX_HISTORY_RECORDS);
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
          barcodeScannerSettings={isSelfie ? undefined : QR_SCANNER_SETTINGS}
          onBarcodeScanned={isSelfie ? undefined : handleBarcodeScanned}
        />
        <View style={[styles.cameraShade, { paddingTop: contentTop, paddingBottom: contentBottom }]}>
          <AnimatedEntrance style={styles.cameraHeader} distance={10}>
            <AnimatedPressable
              accessibilityLabel="Close attendance flow"
              testID="close-attendance-flow"
              onPress={resetFlow}
              style={styles.iconButton}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </AnimatedPressable>
            <View style={styles.cameraStepPill}>
              <Text style={styles.cameraStepText}>{isSelfie ? '2 of 2' : '1 of 2'}</Text>
            </View>
            <View style={styles.iconButtonPlaceholder} />
          </AnimatedEntrance>

          <AnimatedEntrance style={styles.cameraCenter} delay={90} distance={18}>
            <View style={[styles.scanFrame, isSelfie && styles.selfieFrame]}>
              {!isSelfie && <ScannerBeam style={styles.scannerBeam} />}
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
          </AnimatedEntrance>

          <AnimatedEntrance style={styles.cameraFooter} delay={160} distance={10}>
            {scanError && (
              <View style={styles.cameraError}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={styles.cameraErrorText}>{scanError}</Text>
              </View>
            )}
            {isSelfie ? (
              <AnimatedPressable
                accessibilityLabel="Capture selfie"
                testID="capture-selfie"
                onPress={captureSelfie}
                style={styles.shutterOuter}
              >
                <View style={styles.shutterInner} />
              </AnimatedPressable>
            ) : (
              <View style={styles.scanHint}>
                <Feather name="maximize" size={18} color={colors.accentForeground} />
                <Text style={styles.scanHintText}>Scanning automatically</Text>
              </View>
            )}
          </AnimatedEntrance>
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
        <AnimatedEntrance style={styles.validationContent} delay={70} distance={18}>
          <PulsingView style={styles.loadingOrb}>
            <ActivityIndicator size="large" color={colors.primary} />
            <View style={styles.loadingOrbDot} />
          </PulsingView>
          <Text style={styles.validationEyebrow}>{flow === 'submitting' ? 'SECURE VALIDATION' : 'QR VALIDATION'}</Text>
          <Text style={styles.validationTitle}>{validationMessage}</Text>
          <Text style={styles.validationDescription}>
            {flow === 'submitting'
              ? 'Your QR check-in and selfie are being checked together. Keep this screen open.'
              : 'We’re verifying this session before asking for your selfie.'}
          </Text>
          <View style={styles.validationSteps}>
            <ValidationRow label="QR code captured" done styles={styles} colors={colors} />
            <ValidationRow label="Session is active" done={flow === 'submitting' || validationMessage !== 'Checking QR code'} styles={styles} colors={colors} />
            <ValidationRow label="Identity confirmation" done={flow === 'submitting'} active={flow === 'submitting'} styles={styles} colors={colors} />
          </View>
        </AnimatedEntrance>
      </View>
    );
  }

  if (flow === 'success') {
    return (
      <View style={[styles.root, { paddingTop: contentTop, paddingBottom: contentBottom }]}>
        <AnimatedEntrance style={styles.successContent} delay={70} distance={22}>
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
          <AnimatedPressable
            accessibilityLabel="Return to attendance home"
            testID="return-home"
            onPress={resetFlow}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Back to home</Text>
            <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
          </AnimatedPressable>
        </AnimatedEntrance>
      </View>
    );
  }

  if (homePage === 'dashboard') {
    return (
      <View style={[styles.root, { paddingTop: contentTop }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottom + 92 }]}>
          <DashboardEditorial
            colors={colors}
            styles={styles}
            beginAttendance={beginAttendance}
            displayName={displayName}
            initials={initials}
            isDemoMode={isDemoMode}
            activeMockStudent={activeMockStudent}
            selectedMockStudent={selectedMockStudent}
            setSelectedMockStudent={setSelectedMockStudent}
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            visibleHistory={visibleHistory}
            isDemoHistory={isDemoHistory}
            onNavigate={setHomePage}
          />
        </ScrollView>
        <BottomSwitcher active={homePage} onChange={setHomePage} styles={styles} colors={colors} bottomInset={contentBottom} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: contentTop }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottom + 92 }]}>
        <View style={styles.pagePanel}>
          <Text style={styles.pageKicker}>{isDemoMode ? 'DEMO PREVIEW' : 'SPRING 2026'}</Text>
          <Text style={styles.pageHeadline}>{pageTitle(homePage)}</Text>
          {homePage === 'calendar' ? <CalendarPage styles={styles} colors={colors} /> : null}
          {homePage === 'grades' ? <GradesPage styles={styles} colors={colors} /> : null}
          {homePage === 'settings' ? <SettingsPage styles={styles} colors={colors} isDemoMode={isDemoMode} /> : null}
        </View>
      </ScrollView>
      <BottomSwitcher active={homePage} onChange={setHomePage} styles={styles} colors={colors} bottomInset={contentBottom} />
    </View>
  );

  /*
   * Legacy list renderer retained below for the attendance history fallback.
   * The editorial dashboard above is the authenticated home state.
   */
  return (
    <View style={[styles.root, { paddingTop: contentTop, paddingBottom: contentBottom }]}>
      <FlatList
        data={showHistory ? visibleHistory : []}
        keyExtractor={(item) => item.id}
        scrollEnabled={showHistory && visibleHistory.length > 0}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== 'web'}
        ListHeaderComponent={
          <View>
            <AnimatedEntrance style={styles.topBar} delay={40} distance={12}>
              <View>
                <Text style={styles.overline}>{isDemoMode ? 'DEMO PREVIEW · SAMPLE DATA' : 'MONDAY · AUG 31'}</Text>
                <Text style={styles.greeting}>Good morning, {displayName}</Text>
              </View>
              <View style={styles.profileBubble}>
                <Text style={styles.profileInitials}>{initials}</Text>
              </View>
            </AnimatedEntrance>

            <AnimatedEntrance style={styles.heroCard} delay={100} distance={18}>
              <View style={styles.heroGlow} />
              <View style={styles.heroTopline}>
                <PulsingView style={styles.statusDot} />
                <Text style={styles.statusText}>NEXT SESSION</Text>
                <Text style={styles.timeText}>{DEFAULT_SESSION.startsAt}</Text>
              </View>
              <Text style={styles.heroTitle}>Ready to check in?</Text>
              <Text style={styles.heroDescription}>
                Be in the room, scan the code, and verify your presence in under a minute.
              </Text>
              <AnimatedPressable
                accessibilityLabel="Start attendance check in"
                testID="start-attendance"
                onPress={beginAttendance}
                style={[styles.primaryButton, styles.heroButton]}
              >
                <Feather name="maximize" size={18} color={colors.primaryForeground} />
                <Text style={styles.primaryButtonText}>Start attendance</Text>
              </AnimatedPressable>
            </AnimatedEntrance>

            <AnimatedEntrance style={styles.sessionRow} delay={150} distance={14}>
              <View style={styles.sessionIcon}>
                <Feather name="book-open" size={18} color={colors.accentForeground} />
              </View>
              <View style={styles.sessionCopy}>
                <Text style={styles.sessionLabel}>TODAY’S SESSION</Text>
                <Text style={styles.sessionTitle}>{DEFAULT_SESSION.course}</Text>
                <Text style={styles.sessionMeta}>{DEFAULT_SESSION.location}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </AnimatedEntrance>

            <AnimatedEntrance style={styles.profilesSection} delay={200} distance={14}>
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
                    <AnimatedPressable
                      key={student.id}
                      testID={`mock-student-${student.id}`}
                      onPress={() => setSelectedMockStudent(student.id)}
                      style={[
                        styles.mockProfileCard,
                        isSelected && styles.mockProfileCardSelected,
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
                    </AnimatedPressable>
                  );
                })}
              </ScrollView>
              <Text style={styles.demoCaption}>Preview only · selecting a profile does not change your account</Text>
            </AnimatedEntrance>

            <AnimatedEntrance style={styles.sectionHeader} delay={250} distance={12}>
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
            </AnimatedEntrance>
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
        renderItem={({ item, index }) => <AttendanceRow item={item} index={index} styles={styles} colors={colors} />}
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

function pageTitle(page: HomePage) {
  return page === 'calendar' ? 'your calendar.' : page === 'grades' ? 'your grades.' : 'your settings.';
}

type EditorialProps = {
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof createStyles>;
  beginAttendance: () => Promise<void>;
  displayName: string;
  initials: string;
  isDemoMode: boolean;
  activeMockStudent: MockStudent;
  selectedMockStudent: string;
  setSelectedMockStudent: React.Dispatch<React.SetStateAction<string>>;
  showHistory: boolean;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  visibleHistory: AttendanceRecord[];
  isDemoHistory: boolean;
  onNavigate: (page: HomePage) => void;
};

function DashboardEditorial({
  colors,
  styles,
  beginAttendance,
  displayName,
  initials,
  isDemoMode,
  activeMockStudent,
  selectedMockStudent,
  setSelectedMockStudent,
  showHistory,
  setShowHistory,
  visibleHistory,
  isDemoHistory,
  onNavigate,
}: EditorialProps) {
  return (
    <View>
      <View style={styles.topBar}>
        <View style={styles.brandLockup}>
          <View style={styles.brandSquare}><Text style={styles.brandSquareText}>N</Text></View>
          <View>
            <Text style={styles.brandName}>nahda</Text>
            <Text style={styles.brandMeta}>LMS · 2026 SPRING</Text>
          </View>
        </View>
        <Pressable testID="profile-button" accessibilityLabel="Open profile settings" onPress={() => onNavigate('settings')} style={({ pressed }) => [styles.profileBubble, pressed && styles.pressed]}>
          <Text style={styles.profileInitials}>{initials}</Text>
        </Pressable>
      </View>
      <View style={styles.editorialHeading}>
        <Text style={styles.overline}>{isDemoMode ? 'DEMO PREVIEW · SAMPLE DATA' : 'MONDAY · MAY 26 · SPRING 26'}</Text>
        <Text style={styles.editorialGreeting}>good morning, {displayName}.</Text>
        <Text style={styles.editorialSummary}>you’ve got <Text style={styles.editorialAccent}>3 things due this week</Text> — a design doc, a hash-tables quiz, and an AI lab.</Text>
      </View>
      <View style={styles.metricStrip}>
        <Metric value="3.71" label="CUMULATIVE GPA" styles={styles} />
        <Metric value="6" label="ENROLLED SUBJECTS" styles={styles} />
        <Metric value="18" label="CREDIT HRS" styles={styles} />
      </View>
      <View style={styles.checkinCard}>
        <View style={styles.checkinRule} />
        <View style={styles.checkinTopline}><PulsingView style={styles.statusDot} /><Text style={styles.statusText}>NEXT SESSION</Text><Text style={styles.timeText}>09:00 AM</Text></View>
        <Text style={styles.checkinTitle}>Ready to check in?</Text>
        <Text style={styles.checkinDescription}>Be in the room, scan the code, and verify your presence in under a minute.</Text>
        <AnimatedPressable accessibilityLabel="Start attendance check in" testID="start-attendance" onPress={beginAttendance} style={[styles.primaryButton, styles.heroButton]}>
          <Feather name="maximize" size={17} color={colors.primaryForeground} />
          <Text style={styles.primaryButtonText}>Start attendance</Text>
        </AnimatedPressable>
      </View>
      <View style={styles.sectionHeaderEditorial}>
        <Text style={styles.editorialSectionTitle}>this week</Text>
        <Text style={styles.sectionSubline}>May 26 — Jun 1, 2026</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRail}>
        {WEEK_DAYS.map((day, index) => <WeekDay key={day.day} day={day} index={index} styles={styles} colors={colors} />)}
      </ScrollView>
      <View style={styles.sectionHeaderEditorial}>
        <Text style={styles.editorialSectionTitle}>your subjects</Text>
        <Text style={styles.sectionSubline}>spring 2026 · 6 courses</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectRail}>
        {SUBJECTS.map((subject) => <SubjectCard key={subject.code} subject={subject} styles={styles} colors={colors} />)}
      </ScrollView>
      {isDemoMode ? (
        <View style={styles.demoContext}>
          <View style={styles.demoContextHeader}><Text style={styles.sectionTitle}>Student profiles</Text><View style={styles.demoPill}><Feather name="eye" size={12} color={colors.accentForeground} /><Text style={styles.demoPillText}>DEMO</Text></View></View>
          <Text style={styles.sectionSubline}>Preview classmates in your cohort</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileCards}>
            {MOCK_STUDENTS.map((student) => {
              const selected = student.id === selectedMockStudent;
              return <AnimatedPressable key={student.id} testID={`mock-student-${student.id}`} onPress={() => setSelectedMockStudent(student.id)} style={[styles.mockProfileCard, selected && styles.mockProfileCardSelected]}>
                <View style={[styles.mockAvatar, selected && styles.mockAvatarSelected]}><Text style={[styles.mockAvatarText, selected && styles.mockAvatarTextSelected]}>{student.initials}</Text></View>
                <Text style={styles.mockProfileName}>{student.name}</Text><Text style={styles.mockProfileProgram}>{student.program}</Text>
                <View style={styles.mockProfileFooter}><Text style={styles.mockProfileLabel}>ATTENDANCE</Text><Text style={styles.mockProfileRate}>{student.attendance}</Text></View>
              </AnimatedPressable>;
            })}
          </ScrollView>
          <Text style={styles.demoCaption}>Preview only · selecting a profile does not change your account</Text>
        </View>
      ) : null}
      <View style={styles.sectionHeaderEditorial}>
        <View style={styles.historyTitleRow}><Text style={styles.editorialSectionTitle}>attendance history</Text>{isDemoHistory && <View style={styles.sampleBadge}><Text style={styles.sampleBadgeText}>SAMPLE</Text></View>}</View>
        <Pressable accessibilityLabel={showHistory ? 'Hide attendance history' : 'Show attendance history'} testID="toggle-history" onPress={() => setShowHistory((value) => !value)} style={({ pressed }) => pressed && styles.pressed}><Text style={styles.sectionAction}>{showHistory ? 'Hide' : 'View all'}</Text></Pressable>
      </View>
      {showHistory && visibleHistory.length > 0 ? visibleHistory.map((item, index) => <AttendanceRow key={item.id} item={item} index={index} styles={styles} colors={colors} />) : (
        <View style={styles.emptyState}><View style={styles.emptyIcon}><Feather name="calendar" size={20} color={colors.mutedForeground} /></View><Text style={styles.emptyTitle}>No check-ins yet</Text><Text style={styles.emptyDescription}>Completed attendance sessions will appear here.</Text></View>
      )}
      <View style={styles.footerNote}><Feather name="lock" size={13} color={colors.mutedForeground} /><Text style={styles.footerText}>Your selfie is used only for this check-in</Text></View>
    </View>
  );
}

function Metric({ value, label, styles }: { value: string; label: string; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function WeekDay({ day, index, styles, colors }: { day: (typeof WEEK_DAYS)[number]; index: number; styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.weekDay, index === 0 && styles.weekDaySelected]}><View style={styles.weekDayHeader}><Text style={styles.weekDayName}>{day.day}</Text><Text style={styles.weekDayDate}>{day.date}</Text></View>{day.classes.length ? day.classes.map((item) => <View key={item.title} style={[styles.classChip, { backgroundColor: colors[item.color] }]}><Text style={styles.classTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.classMeta}>{item.code} · {item.time}</Text><Text style={styles.classRoom}>{item.room}</Text></View>) : <View style={styles.restDay}><Feather name="sun" size={14} color={colors.mutedForeground} /><Text style={styles.restDayText}>open day</Text></View>}</View>;
}

function SubjectCard({ subject, styles, colors }: { subject: (typeof SUBJECTS)[number]; styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.subjectCard}><View style={[styles.subjectCover, { backgroundColor: colors[subject.color] }]}><Feather name={subject.icon} size={25} color={colors.primaryForeground} /><Text style={styles.subjectCode}>{subject.code}</Text></View><View style={styles.subjectBody}><Text style={styles.subjectTitle} numberOfLines={1}>{subject.title}</Text><Text style={styles.subjectInstructor}>{subject.instructor}</Text><View style={styles.progressRow}><Text style={styles.progressMeta}>{subject.modules} modules</Text><Text style={styles.progressMeta}>{subject.progress}% done</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${subject.progress}%`, backgroundColor: colors.primary }]} /></View></View></View>;
}

function CalendarPage({ styles, colors }: { styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.innerPage}><Text style={styles.pageIntro}>A focused view of classes, deadlines, and the small spaces between them.</Text><View style={styles.calendarMonth}><View style={styles.calendarMonthHeader}><Text style={styles.calendarMonthTitle}>May 2026</Text><Feather name="chevron-down" size={17} color={colors.mutedForeground} /></View>{WEEK_DAYS.slice(0, 5).map((day) => <View key={day.day} style={styles.calendarListRow}><View style={styles.calendarDate}><Text style={styles.calendarDay}>{day.day}</Text><Text style={styles.calendarDateNumber}>{day.date}</Text></View><View style={styles.calendarEventCopy}><Text style={styles.calendarEventTitle}>{day.classes[0]?.title || 'Open study day'}</Text><Text style={styles.calendarEventMeta}>{day.classes[0] ? `${day.classes[0].time} · ${day.classes[0].room}` : 'No scheduled sessions'}</Text></View><View style={styles.calendarEventDot} /></View>)}</View></View>;
}

function GradesPage({ styles, colors }: { styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.innerPage}><Text style={styles.pageIntro}>Your academic pulse, without the spreadsheet feeling.</Text><View style={styles.gradeHero}><Text style={styles.gradeHeroLabel}>CURRENT CUMULATIVE GPA</Text><Text style={styles.gradeHeroValue}>3.71</Text><View style={styles.gradeBar}><View style={[styles.gradeBarFill, { width: '78%', backgroundColor: colors.primary }]} /></View><Text style={styles.gradeHeroMeta}>Strong term · 78% of the way to your target</Text></View>{SUBJECTS.map((subject, index) => <View key={subject.code} style={styles.gradeRow}><View style={[styles.gradeIcon, { backgroundColor: colors[subject.color] }]}><Feather name={subject.icon} size={16} color={colors.primaryForeground} /></View><View style={styles.gradeCopy}><Text style={styles.gradeTitle}>{subject.title}</Text><Text style={styles.gradeMeta}>{subject.code} · {subject.progress}% complete</Text></View><Text style={styles.gradeValue}>{['A-', 'B+', 'A'][index]}</Text></View>)}</View>;
}

function SettingsPage({ styles, colors, isDemoMode }: { styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof useColors>; isDemoMode: boolean }) {
  return <View style={styles.innerPage}><Text style={styles.pageIntro}>Make campus engine feel like yours.</Text><View style={styles.settingsCard}>{[['user', 'Profile', 'Student details and program'], ['bell', 'Notifications', 'Deadlines and class reminders'], ['shield', 'Privacy', 'Selfie verification controls'], ['help-circle', 'Help center', 'Find an answer quickly']].map(([icon, title, subtitle]) => <Pressable key={title} testID={`settings-${title.toLowerCase().replace(' ', '-')}`} onPress={() => Alert.alert(title, subtitle)} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}><View style={styles.settingsIcon}><Feather name={icon as keyof typeof Feather.glyphMap} size={17} color={colors.primary} /></View><View style={styles.settingsCopy}><Text style={styles.settingsTitle}>{title}</Text><Text style={styles.settingsSubtitle}>{subtitle}</Text></View><Feather name="chevron-right" size={17} color={colors.mutedForeground} /></Pressable>)}</View><View style={styles.accountNote}><Text style={styles.accountNoteLabel}>{isDemoMode ? 'DEMO ACCOUNT' : 'ACCOUNT STATUS'}</Text><Text style={styles.accountNoteText}>{isDemoMode ? 'Exploring with sample student data.' : 'Signed in and syncing securely.'}</Text></View></View>;
}

function BottomSwitcher({ active, onChange, styles, colors, bottomInset }: { active: HomePage; onChange: (page: HomePage) => void; styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof useColors>; bottomInset: number }) {
  const tabs: Array<{ key: HomePage; label: string; icon: keyof typeof Feather.glyphMap }> = [{ key: 'dashboard', label: 'Dashboard', icon: 'home' }, { key: 'calendar', label: 'Calendar', icon: 'calendar' }, { key: 'grades', label: 'Grades', icon: 'bar-chart-2' }, { key: 'settings', label: 'Settings', icon: 'settings' }];
  return <View style={[styles.bottomSwitcher, { paddingBottom: Math.max(bottomInset, 10) }]}>{tabs.map((tab) => <Pressable key={tab.key} testID={`tab-${tab.key}`} accessibilityRole="button" accessibilityState={{ selected: active === tab.key }} onPress={() => onChange(tab.key)} style={({ pressed }) => [styles.bottomTab, pressed && styles.pressed]}><View style={[styles.bottomIconWrap, active === tab.key && styles.bottomIconWrapActive]}><Feather name={tab.icon} size={18} color={active === tab.key ? colors.primaryForeground : colors.mutedForeground} /></View><Text style={[styles.bottomLabel, active === tab.key && styles.bottomLabelActive]}>{tab.label}</Text></Pressable>)}</View>;
}

const ValidationRow = React.memo(function ValidationRow({
  label,
  done,
  active = false,
  styles,
  colors,
}: {
  label: string;
  done: boolean;
  active?: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.validationRow}>
      <View style={[styles.validationCheck, done && styles.validationCheckDone]}>
        {active ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : done ? <Feather name="check" size={13} color={colors.primaryForeground} /> : null}
      </View>
      <Text style={[styles.validationRowText, done && styles.validationRowTextDone]}>{label}</Text>
    </View>
  );
});

const AttendanceRow = React.memo(function AttendanceRow({
  item,
  index,
  styles,
  colors,
}: {
  item: AttendanceRecord;
  index: number;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <AnimatedEntrance delay={Math.min(320 + index * 55, 650)} distance={10}>
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
    </AnimatedEntrance>
  );
});

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 18 },
    brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    brandSquare: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    brandSquareText: { color: colors.primaryForeground, fontSize: 15, fontFamily: 'Inter_700Bold' },
    brandName: { color: colors.foreground, fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
    brandMeta: { color: colors.mutedForeground, fontSize: 8, letterSpacing: 0.8, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
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
    editorialHeading: { paddingTop: 10, paddingBottom: 4 },
    editorialGreeting: { color: colors.foreground, fontSize: 34, lineHeight: 39, fontFamily: 'Inter_700Bold', letterSpacing: -1.2, marginTop: 7 },
    editorialSummary: { color: colors.secondaryForeground, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', marginTop: 9, maxWidth: 330 },
    editorialAccent: { color: colors.primary, fontFamily: 'Inter_700Bold' },
    metricStrip: { flexDirection: 'row', justifyContent: 'flex-end', gap: 22, paddingTop: 18, paddingBottom: 20 },
    metric: { alignItems: 'flex-end' },
    metricValue: { color: colors.foreground, fontSize: 22, fontFamily: 'Inter_400Regular', letterSpacing: -0.6 },
    metricLabel: { color: colors.mutedForeground, fontSize: 7, letterSpacing: 0.5, fontFamily: 'Inter_700Bold', marginTop: 3 },
    checkinCard: { overflow: 'hidden', borderRadius: 21, padding: 20, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, minHeight: 202 },
    checkinRule: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.primary },
    checkinTopline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkinTitle: { color: colors.foreground, fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, marginTop: 20 },
    checkinDescription: { color: colors.secondaryForeground, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', marginTop: 7, maxWidth: 290 },
    sectionHeaderEditorial: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 28, paddingBottom: 12 },
    editorialSectionTitle: { color: colors.foreground, fontSize: 21, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
    weekRail: { gap: 8, paddingBottom: 2 },
    weekDay: { width: 132, minHeight: 170, borderRadius: 12, padding: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    weekDaySelected: { borderColor: colors.primary, backgroundColor: colors.secondary },
    weekDayHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 9 },
    weekDayName: { color: colors.primary, fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.7 },
    weekDayDate: { color: colors.foreground, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
    classChip: { borderRadius: 8, padding: 8, marginBottom: 6, minHeight: 60 },
    classTitle: { color: colors.primaryForeground, fontSize: 10, fontFamily: 'Inter_700Bold' },
    classMeta: { color: colors.primaryForeground, opacity: 0.8, fontSize: 8, fontFamily: 'Inter_500Medium', marginTop: 4 },
    classRoom: { color: colors.primaryForeground, opacity: 0.72, fontSize: 8, fontFamily: 'Inter_400Regular', marginTop: 2 },
    restDay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
    restDayText: { color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_500Medium' },
    subjectRail: { gap: 12, paddingBottom: 4 },
    subjectCard: { width: 244, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    subjectCover: { height: 120, padding: 15, justifyContent: 'space-between' },
    subjectCode: { color: colors.primaryForeground, fontSize: 9, letterSpacing: 1.1, fontFamily: 'Inter_700Bold' },
    subjectBody: { padding: 14 },
    subjectTitle: { color: colors.foreground, fontSize: 16, fontFamily: 'Inter_600SemiBold' },
    subjectInstructor: { color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 5 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 17 },
    progressMeta: { color: colors.mutedForeground, fontSize: 9, fontFamily: 'Inter_500Medium' },
    progressTrack: { height: 4, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden', marginTop: 7 },
    progressFill: { height: 4, borderRadius: 3 },
    demoContext: { paddingTop: 25 },
    demoContextHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pagePanel: { flex: 1 },
    pageKicker: { color: colors.primary, fontSize: 10, letterSpacing: 1.2, fontFamily: 'Inter_700Bold', marginTop: 12 },
    pageHeadline: { color: colors.foreground, fontSize: 34, lineHeight: 40, fontFamily: 'Inter_700Bold', letterSpacing: -1.1, marginTop: 8, marginBottom: 10 },
    innerPage: { paddingTop: 8 },
    pageIntro: { color: colors.mutedForeground, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular', maxWidth: 330, marginBottom: 22 },
    calendarMonth: { borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15 },
    calendarMonthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    calendarMonthTitle: { color: colors.foreground, fontSize: 17, fontFamily: 'Inter_700Bold' },
    calendarListRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 13 },
    calendarDate: { width: 37, alignItems: 'center' },
    calendarDay: { color: colors.mutedForeground, fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.7 },
    calendarDateNumber: { color: colors.foreground, fontSize: 17, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
    calendarEventCopy: { flex: 1 },
    calendarEventTitle: { color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    calendarEventMeta: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
    calendarEventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    gradeHero: { borderRadius: 18, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, padding: 19, marginBottom: 15 },
    gradeHeroLabel: { color: colors.mutedForeground, fontSize: 9, letterSpacing: 1, fontFamily: 'Inter_700Bold' },
    gradeHeroValue: { color: colors.foreground, fontSize: 46, fontFamily: 'Inter_700Bold', letterSpacing: -1.5, marginTop: 7 },
    gradeBar: { height: 7, borderRadius: 5, backgroundColor: colors.muted, overflow: 'hidden', marginTop: 10 },
    gradeBarFill: { height: 7, borderRadius: 5 },
    gradeHeroMeta: { color: colors.secondaryForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 9 },
    gradeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 11 },
    gradeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    gradeCopy: { flex: 1 },
    gradeTitle: { color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    gradeMeta: { color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
    gradeValue: { color: colors.primary, fontSize: 16, fontFamily: 'Inter_700Bold' },
    settingsCard: { borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15 },
    settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
    settingsIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    settingsCopy: { flex: 1 },
    settingsTitle: { color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    settingsSubtitle: { color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
    accountNote: { borderRadius: 15, backgroundColor: colors.muted, padding: 15, marginTop: 18 },
    accountNoteLabel: { color: colors.primary, fontSize: 9, letterSpacing: 1, fontFamily: 'Inter_700Bold' },
    accountNoteText: { color: colors.secondaryForeground, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6 },
    bottomSwitcher: { position: 'absolute', left: 12, right: 12, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingTop: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
    bottomTab: { minWidth: 72, minHeight: 58, alignItems: 'center', justifyContent: 'flex-start', gap: 4 },
    bottomIconWrap: { width: 34, height: 28, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    bottomIconWrapActive: { backgroundColor: colors.primary },
    bottomLabel: { color: colors.mutedForeground, fontSize: 9, fontFamily: 'Inter_600SemiBold' },
    bottomLabelActive: { color: colors.primary, fontFamily: 'Inter_700Bold' },
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
    scannerBeam: { position: 'absolute', left: 10, right: 10, top: 0, height: 2, borderRadius: 2, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.8, shadowRadius: 7, elevation: 4 },
    selfieFrame: { borderRadius: 135, overflow: 'hidden', borderWidth: 1, borderColor: colors.cameraTextMuted, alignItems: 'center', justifyContent: 'center' },
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
