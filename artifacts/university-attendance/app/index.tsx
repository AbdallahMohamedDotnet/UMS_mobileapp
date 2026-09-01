import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Redirect, type Href, useLocalSearchParams } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { DashboardHeader } from '@/components/attendance/DashboardHeader';
import { BottomSwitcher } from '@/components/attendance/BottomSwitcher';
import { CalendarPage, GradesPage, SettingsPage } from '@/components/attendance/InnerPages';
import { HistoryRow } from '@/components/attendance/HistoryRow';
import { CameraFlow } from '@/components/attendance/CameraFlow';
import { ValidationScreen } from '@/components/attendance/ValidationScreen';
import { SuccessScreen } from '@/components/attendance/SuccessScreen';
import {
  DEFAULT_SESSION,
  HISTORY_ROW_HEIGHT,
  MAX_HISTORY_RECORDS,
  MOCK_ATTENDANCE,
  MOCK_STUDENTS,
  STORAGE_KEY,
  formatDate,
  formatTime,
  isLikelyAttendanceCode,
  makeId,
  pageTitle,
  type AttendanceRecord,
  type FlowStep,
  type HomePage,
} from '@/constants/attendance';

/** Milestones for the validate step, so the copy and the progress bar agree. */
const QR_STAGES = [
  { at: 0, message: 'Checking QR code', progress: 0.18 },
  { at: 600, message: 'Confirming today’s class', progress: 0.55 },
  { at: 1250, message: 'QR code accepted', progress: 0.9 },
] as const;

const SUBMIT_STAGES = [
  { at: 0, message: 'Sending secure check-in', progress: 0.25 },
  { at: 800, message: 'Matching selfie to student profile', progress: 0.65 },
  { at: 1800, message: 'Attendance confirmed', progress: 1 },
] as const;

const QR_COMPLETE_AT = 1700;
const SUBMIT_COMPLETE_AT = 2500;

/** Clearance for the absolutely-positioned bottom switcher. */
const SWITCHER_CLEARANCE = 92;

export default function AttendanceHome() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const isDemoMode = demo === '1';

  const [flow, setFlow] = useState<FlowStep>('home');
  const [homePage, setHomePage] = useState<HomePage>('dashboard');
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState('');
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [selectedMockStudent, setSelectedMockStudent] = useState('youssef');
  const [scanError, setScanError] = useState<string | null>(null);
  const [stage, setStage] = useState({ message: 'Checking QR code', progress: 0 });
  const [checkedInAt, setCheckedInAt] = useState('');

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  /**
   * Barcode callbacks fire many times per second. Guarding with a ref keeps
   * `handleBarcodeScanned` referentially stable, so CameraView is never
   * reconfigured mid-scan and duplicate reads are dropped without a render.
   */
  const scanLock = useRef(false);

  /** Rows already animated once; recycled rows render without an entrance. */
  const seenRows = useRef(new Set<string>());

  const userStorageKey = user?.id ? `${STORAGE_KEY}:${user.id}` : null;
  const activeMockStudent =
    MOCK_STUDENTS.find((student) => student.id === selectedMockStudent) ?? MOCK_STUDENTS[0];
  const displayName = isDemoMode
    ? activeMockStudent.name.split(' ')[0]
    : user?.firstName || 'Student';
  const initials = isDemoMode
    ? activeMockStudent.initials
    : (user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || 'S').toUpperCase();
  const isDemoHistory = history.length === 0;
  const visibleHistory = isDemoHistory ? MOCK_ATTENDANCE : history;
  const listData = showHistory ? visibleHistory : EMPTY_HISTORY;

  useEffect(() => {
    if (!userStorageKey) return;
    let isActive = true;
    AsyncStorage.getItem(userStorageKey)
      .then((stored) => {
        if (!stored || !isActive) return;
        const parsed = JSON.parse(stored) as unknown;
        setHistory(Array.isArray(parsed) ? (parsed as AttendanceRecord[]).slice(0, MAX_HISTORY_RECORDS) : []);
      })
      .catch(() => {
        if (isActive) setHistory([]);
      });
    return () => {
      isActive = false;
    };
  }, [userStorageKey]);

  const notify = useCallback((kind: 'success' | 'warning' | 'error') => {
    // Never awaited on the interaction path — a haptic round trip is a frame
    // of latency the user reads as lag.
    void Haptics.notificationAsync(
      kind === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : kind === 'warning'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error,
    ).catch(() => {});
  }, []);

  const beginAttendance = useCallback(async () => {
    setScanError(null);
    setSelfieUri(null);
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        setScanError('Camera access is needed to scan the attendance code and capture your selfie.');
        notify('warning');
        return;
      }
    }
    scanLock.current = false;
    setFlow('scan');
  }, [cameraPermission?.granted, notify, requestCameraPermission]);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanLock.current) return;
      const payload = result.data.trim();
      if (!payload) {
        setScanError('That code is empty. Try scanning the attendance QR code again.');
        return;
      }
      scanLock.current = true;
      setScannedData(payload);
      setScanError(null);
      setFlow('qr-validating');
      notify('success');
    },
    [notify],
  );

  // Drive the QR validation copy + progress from one timer table so the two
  // can never disagree, and so a single cleanup cancels everything.
  useEffect(() => {
    if (flow !== 'qr-validating') return;
    setStage({ message: QR_STAGES[0].message, progress: QR_STAGES[0].progress });
    const timers = QR_STAGES.slice(1).map((s) =>
      setTimeout(() => setStage({ message: s.message, progress: s.progress }), s.at),
    );
    timers.push(
      setTimeout(() => {
        if (isLikelyAttendanceCode(scannedData)) {
          setFlow('selfie');
        } else {
          setScanError('This does not look like an active university attendance code.');
          scanLock.current = false;
          setFlow('scan');
          notify('error');
        }
      }, QR_COMPLETE_AT),
    );
    return () => timers.forEach(clearTimeout);
  }, [flow, notify, scannedData]);

  useEffect(() => {
    if (flow !== 'submitting') return;
    setStage({ message: SUBMIT_STAGES[0].message, progress: SUBMIT_STAGES[0].progress });
    const timers = SUBMIT_STAGES.slice(1).map((s) =>
      setTimeout(() => setStage({ message: s.message, progress: s.progress }), s.at),
    );
    timers.push(
      setTimeout(() => {
        const now = new Date();
        const record: AttendanceRecord = {
          id: makeId(),
          course: DEFAULT_SESSION.course,
          location: DEFAULT_SESSION.location,
          dateLabel: formatDate(now),
          timeLabel: formatTime(now),
          status: 'Present',
        };
        setCheckedInAt(record.timeLabel);
        setHistory((current) => {
          const next = [record, ...current].slice(0, MAX_HISTORY_RECORDS);
          // Persist off the critical path: the success screen should not wait
          // on a disk write to appear.
          void AsyncStorage.setItem(userStorageKey || STORAGE_KEY, JSON.stringify(next)).catch(
            () => {},
          );
          return next;
        });
        setFlow('success');
        notify('success');
      }, SUBMIT_COMPLETE_AT),
    );
    return () => timers.forEach(clearTimeout);
  }, [flow, notify, userStorageKey]);

  const handleCaptured = useCallback((uri: string) => setSelfieUri(uri), []);

  const handleCaptureFailed = useCallback(() => {
    setScanError('We could not capture the selfie. Please try again.');
    notify('error');
  }, [notify]);

  const handleRetake = useCallback(() => {
    setSelfieUri(null);
    setScanError(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selfieUri) return;
    setFlow('submitting');
  }, [selfieUri]);

  const resetFlow = useCallback(() => {
    scanLock.current = false;
    setFlow('home');
    setScannedData('');
    setSelfieUri(null);
    setScanError(null);
  }, []);

  const toggleHistory = useCallback(() => {
    setShowHistory((value) => {
      // Forget what has been seen while collapsed, so expanding the section
      // replays the staggered entrance instead of snapping the rows back in.
      if (value) seenRows.current.clear();
      return !value;
    });
  }, []);

  const markRowSeen = useCallback((id: string) => {
    seenRows.current.add(id);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: AttendanceRecord; index: number }) => (
      <HistoryRow
        item={item}
        index={index}
        animate={!seenRows.current.has(item.id)}
        onSeen={markRowSeen}
      />
    ),
    [markRowSeen],
  );

  const keyExtractor = useCallback((item: AttendanceRecord) => item.id, []);

  // Rows are a fixed height, so the list can skip measurement entirely.
  const getItemLayout = useCallback(
    (_data: ArrayLike<AttendanceRecord> | null | undefined, index: number) => ({
      length: HISTORY_ROW_HEIGHT,
      offset: HISTORY_ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  const contentTop = Platform.OS === 'web' ? 67 : insets.top;
  const contentBottom = Platform.OS === 'web' ? 34 : insets.bottom;

  if (!isSignedIn && !isDemoMode) {
    return <Redirect href={'/sign-in' as Href} />;
  }

  if (flow === 'scan' || flow === 'selfie') {
    return (
      <CameraFlow
        mode={flow === 'selfie' ? 'selfie' : 'scan'}
        selfieUri={selfieUri}
        scanError={scanError}
        onClose={resetFlow}
        onBarcodeScanned={handleBarcodeScanned}
        onCaptured={handleCaptured}
        onCaptureFailed={handleCaptureFailed}
        onRetake={handleRetake}
        onConfirm={handleConfirm}
        contentTop={contentTop}
        contentBottom={contentBottom}
      />
    );
  }

  if (flow === 'qr-validating' || flow === 'submitting') {
    const isSubmitting = flow === 'submitting';
    return (
      <ValidationScreen
        progress={stage.progress}
        message={stage.message}
        isSubmitting={isSubmitting}
        steps={[
          { label: 'QR code captured', done: true, active: false },
          {
            label: 'Session is active',
            done: isSubmitting || stage.progress >= QR_STAGES[1].progress,
            active: !isSubmitting && stage.progress < QR_STAGES[1].progress,
          },
          {
            label: 'Identity confirmation',
            done: isSubmitting && stage.progress >= 1,
            active: isSubmitting && stage.progress < 1,
          },
        ]}
        contentTop={contentTop}
        contentBottom={contentBottom}
      />
    );
  }

  if (flow === 'success') {
    return (
      <SuccessScreen
        timeLabel={checkedInAt}
        onDone={resetFlow}
        contentTop={contentTop}
        contentBottom={contentBottom}
      />
    );
  }

  // The dashboard keeps history in a windowed list rather than a mapped
  // ScrollView, so a long attendance record stays cheap to scroll.
  if (homePage === 'dashboard') {
    return (
      <View style={[styles.root, { paddingTop: contentTop }]}>
        <Animated.FlatList<AttendanceRecord>
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: contentBottom + SWITCHER_CLEARANCE },
          ]}
          itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(180)}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={40}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListHeaderComponent={
            <DashboardHeader
              scrollY={scrollY}
              displayName={displayName}
              initials={initials}
              isDemoMode={isDemoMode}
              isDemoHistory={isDemoHistory}
              showHistory={showHistory}
              selectedStudentId={selectedMockStudent}
              onSelectStudent={setSelectedMockStudent}
              onToggleHistory={toggleHistory}
              onStart={beginAttendance}
              onNavigate={setHomePage}
            />
          }
          ListEmptyComponent={
            <Animated.View
              entering={FadeIn.duration(260)}
              exiting={FadeOut.duration(160)}
              style={styles.emptyState}
            >
              <View style={styles.emptyIcon}>
                <Feather name="calendar" size={20} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>
                {showHistory ? 'No check-ins yet' : 'History hidden'}
              </Text>
              <Text style={styles.emptyDescription}>
                {showHistory
                  ? 'Completed attendance sessions will appear here.'
                  : 'Tap “View all” to bring your attendance record back.'}
              </Text>
            </Animated.View>
          }
          ListFooterComponent={
            <AnimatedEntrance delay={440} distance={10} style={styles.footerNote}>
              <Feather name="lock" size={13} color={colors.mutedForeground} />
              <Text style={styles.footerText}>Your selfie is used only for this check-in</Text>
            </AnimatedEntrance>
          }
        />

        {scanError && (
          <Animated.View
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(160)}
            style={[styles.homeError, { bottom: contentBottom + SWITCHER_CLEARANCE + 12 }]}
          >
            <Feather name="alert-circle" size={16} color={colors.destructiveForeground} />
            <Text style={styles.homeErrorText}>{scanError}</Text>
          </Animated.View>
        )}

        <BottomSwitcher active={homePage} onChange={setHomePage} bottomInset={contentBottom} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: contentTop }]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: contentBottom + SWITCHER_CLEARANCE },
        ]}
      >
        {/* Keying on the page cross-fades section switches instead of snapping. */}
        <Animated.View
          key={homePage}
          entering={FadeIn.duration(240)}
          exiting={FadeOut.duration(120)}
          style={styles.pagePanel}
        >
          <AnimatedEntrance distance={12}>
            <Text style={styles.pageKicker}>{isDemoMode ? 'DEMO PREVIEW' : 'SPRING 2026'}</Text>
            <Text style={styles.pageHeadline}>{pageTitle(homePage)}</Text>
          </AnimatedEntrance>
          {homePage === 'calendar' && <CalendarPage />}
          {homePage === 'grades' && <GradesPage />}
          {homePage === 'settings' && <SettingsPage isDemoMode={isDemoMode} />}
        </Animated.View>
      </Animated.ScrollView>
      <BottomSwitcher active={homePage} onChange={setHomePage} bottomInset={contentBottom} />
    </View>
  );
}

/** Stable identity keeps the list from treating "hidden" as fresh data. */
const EMPTY_HISTORY: AttendanceRecord[] = [];

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 20 },
    pagePanel: { paddingTop: 12 },
    pageKicker: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 1.4, fontFamily: 'Inter_600SemiBold' },
    pageHeadline: { color: colors.foreground, fontSize: 32, lineHeight: 38, fontFamily: 'Inter_700Bold', marginTop: 10, marginBottom: 20 },
    emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 23, paddingBottom: 19 },
    emptyIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted, marginBottom: 12 },
    emptyTitle: { color: colors.secondaryForeground, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
    emptyDescription: { color: colors.mutedForeground, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 6, maxWidth: 255 },
    footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 26 },
    footerText: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular' },
    homeError: {
      position: 'absolute',
      left: 20,
      right: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.destructive,
    },
    homeErrorText: { flex: 1, color: colors.destructiveForeground, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium' },
  });
}
