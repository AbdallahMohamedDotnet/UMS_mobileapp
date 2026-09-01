import type { BarcodeSettings } from 'expo-camera';

export type AttendanceRecord = {
  id: string;
  course: string;
  location: string;
  dateLabel: string;
  timeLabel: string;
  status: 'Present' | 'Pending';
};

export type MockStudent = {
  id: string;
  name: string;
  initials: string;
  program: string;
  attendance: string;
};

export type FlowStep =
  | 'home'
  | 'scan'
  | 'qr-validating'
  | 'selfie'
  | 'review'
  | 'submitting'
  | 'success';

export const STORAGE_KEY = '@university-attendance/history';
export const MAX_HISTORY_RECORDS = 100;

/** Frozen so the prop identity never changes and CameraView never re-configures. */
export const QR_SCANNER_SETTINGS: BarcodeSettings = { barcodeTypes: ['qr'] };

/** Row geometry is fixed so the history list can use getItemLayout. */
export const HISTORY_ROW_HEIGHT = 77;

export const DEFAULT_SESSION = {
  course: 'Software Engineering',
  location: 'Innovation Hall · Room 204',
  startsAt: '09:00 AM',
};

export const MOCK_STUDENTS: MockStudent[] = [
  { id: 'youssef', name: 'Youssef Magdy', initials: 'YM', program: 'Computer Science', attendance: '96%' },
  { id: 'mariam', name: 'Mariam Adel', initials: 'MA', program: 'Software Engineering', attendance: '91%' },
  { id: 'karim', name: 'Karim Nabil', initials: 'KN', program: 'Information Systems', attendance: '88%' },
];

export const MOCK_ATTENDANCE: AttendanceRecord[] = [
  { id: 'mock-1', course: 'Software Engineering', location: 'Innovation Hall · Room 204', dateLabel: 'Aug 29, 2026', timeLabel: '9:04 AM', status: 'Present' },
  { id: 'mock-2', course: 'Database Systems', location: 'Science Block · Room 110', dateLabel: 'Aug 27, 2026', timeLabel: '11:02 AM', status: 'Present' },
  { id: 'mock-3', course: 'Human Computer Interaction', location: 'Design Lab · Room 12', dateLabel: 'Aug 25, 2026', timeLabel: '1:01 PM', status: 'Present' },
];

export function isLikelyAttendanceCode(payload: string) {
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    return Boolean(parsed.sessionId || parsed.session || parsed.attendanceToken || parsed.course);
  } catch {
    // University systems often use opaque signed tokens rather than JSON.
    return payload.length >= 8;
  }
}

export function makeId() {
  return `${Date.now().toString()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Top-level sections reachable from the bottom switcher. */
export type HomePage = 'dashboard' | 'calendar' | 'grades' | 'settings';

/** Editorial accent keys that map onto tokens in constants/colors.ts. */
export type AccentKey = 'terracotta' | 'ink' | 'olive' | 'sky' | 'lavender';

export type ScheduledClass = {
  title: string;
  code: string;
  time: string;
  room: string;
  color: AccentKey;
};

export type WeekDayEntry = {
  day: string;
  date: string;
  classes: ScheduledClass[];
};

export const WEEK_DAYS: WeekDayEntry[] = [
  { day: 'MON', date: '26', classes: [
    { title: 'Software Engineering', code: 'SE 301', time: '10:00', room: 'B-204', color: 'terracotta' },
    { title: 'AI: Search agents', code: 'CS 420', time: '1:30', room: 'Hall 3', color: 'olive' },
  ] },
  { day: 'TUE', date: '27', classes: [
    { title: 'Data Structures', code: 'CS 220', time: '9:00', room: 'C-310', color: 'ink' },
    { title: 'Operating Systems', code: 'CS 318', time: '11:00', room: 'A-110', color: 'sky' },
  ] },
  { day: 'WED', date: '28', classes: [
    { title: 'Design doc sprint', code: 'SE 301', time: '11:59', room: 'Online', color: 'lavender' },
    { title: 'Networks', code: 'CS 340', time: '2:00', room: 'C-310', color: 'olive' },
  ] },
  { day: 'THU', date: '29', classes: [
    { title: 'Networks: Transport', code: 'CS 340', time: '10:00', room: 'C-310', color: 'sky' },
  ] },
  { day: 'FRI', date: '30', classes: [
    { title: 'Lab 03 — Search agents', code: 'CS 420', time: '5:00', room: 'Lab 2', color: 'terracotta' },
  ] },
  { day: 'SAT', date: '31', classes: [
    { title: 'Quiz 05 — Scheduling', code: 'CS 318', time: '11:00', room: 'A-110', color: 'ink' },
  ] },
  { day: 'SUN', date: '1', classes: [] },
];

export type Subject = {
  code: string;
  title: string;
  instructor: string;
  progress: number;
  modules: string;
  color: AccentKey;
  icon: 'layers' | 'git-branch' | 'database';
};

export const SUBJECTS: Subject[] = [
  { code: 'SE 301', title: 'Software engineering', instructor: 'Dr. Hala Ramadan', progress: 64, modules: '8 of 12', color: 'terracotta', icon: 'layers' },
  { code: 'CS 220', title: 'Data structures & algorithms', instructor: 'Prof. Omar Khaled', progress: 78, modules: '11 of 14', color: 'ink', icon: 'git-branch' },
  { code: 'CS 330', title: 'Database systems', instructor: 'Dr. Marwan Naquib', progress: 42, modules: '5 of 12', color: 'olive', icon: 'database' },
];

export function pageTitle(page: HomePage) {
  return page === 'calendar' ? 'your calendar.' : page === 'grades' ? 'your grades.' : 'your settings.';
}
