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
