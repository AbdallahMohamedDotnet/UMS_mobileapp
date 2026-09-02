import { Router, type IRouter } from "express";
import { mockAuth, type AuthenticatedRequest } from "../middleware/mockAuth";
import { sendError, makeRequestId } from "../lib/errors";

const router: IRouter = Router();

// All attendance routes require authentication
router.use(mockAuth);

// ---------------------------------------------------------------------------
// In-memory mock data store (resets when server restarts)
// ---------------------------------------------------------------------------

interface MockSession {
  id: string;
  course: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: "active" | "expired" | "upcoming";
}

interface MockCheckIn {
  id: string;
  studentId: string;
  sessionId: string;
  status: "present";
  verifiedAt: string;
  course: string;
  location: string;
}

/**
 * Generates a session that is always "active" relative to the current time.
 * The session window is the current hour so the mock always works.
 */
function buildActiveSession(): MockSession {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    id: `session_${now.toISOString().slice(0, 10).replace(/-/g, "_")}_se_204`,
    course: "Software Engineering",
    location: "Innovation Hall · Room 204",
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    status: "active",
  };
}

/** In-memory check-ins — survives across requests but not server restarts. */
const checkIns: MockCheckIn[] = [
  // Seed some history so GET /me isn't empty
  {
    id: "checkin_seed_1",
    studentId: "student_youssef",
    sessionId: "session_2026_08_29_se_204",
    status: "present",
    verifiedAt: "2026-08-29T09:04:12Z",
    course: "Software Engineering",
    location: "Innovation Hall · Room 204",
  },
  {
    id: "checkin_seed_2",
    studentId: "student_youssef",
    sessionId: "session_2026_08_27_db_110",
    status: "present",
    verifiedAt: "2026-08-27T11:02:33Z",
    course: "Database Systems",
    location: "Science Block · Room 110",
  },
  {
    id: "checkin_seed_3",
    studentId: "student_youssef",
    sessionId: "session_2026_08_25_hci_12",
    status: "present",
    verifiedAt: "2026-08-25T13:01:45Z",
    course: "Human Computer Interaction",
    location: "Design Lab · Room 12",
  },
  {
    id: "checkin_seed_4",
    studentId: "student_mariam",
    sessionId: "session_2026_08_29_se_204",
    status: "present",
    verifiedAt: "2026-08-29T09:06:22Z",
    course: "Software Engineering",
    location: "Innovation Hall · Room 204",
  },
];

let checkInCounter = checkIns.length;

// ---------------------------------------------------------------------------
// GET /attendance/sessions/current
// ---------------------------------------------------------------------------

router.get("/sessions/current", (req, res) => {
  const session = buildActiveSession();

  // Simulate: randomly return 404 ~10% of the time to test error handling
  // (Remove this in production — here for mobile dev to test the no-session state)
  if (req.query["simulate_no_session"] === "1") {
    sendError(res, 404, "SESSION_NOT_FOUND", "There is no active class session right now.");
    return;
  }

  res.json(session);
});

// ---------------------------------------------------------------------------
// POST /attendance/sessions/:sessionId/qr/validate
// ---------------------------------------------------------------------------

router.post("/sessions/:sessionId/qr/validate", (req, res) => {
  const { sessionId } = req.params;
  const { payload } = req.body as { payload?: string };

  if (!payload || typeof payload !== "string" || payload.trim().length === 0) {
    sendError(res, 400, "QR_INVALID", "QR payload is missing or empty.");
    return;
  }

  // Simulate invalid QR — if payload is literally "invalid" or too short
  if (payload === "invalid" || payload.trim().length < 8) {
    sendError(res, 422, "QR_INVALID", "QR payload signature or contents are invalid.");
    return;
  }

  // Simulate expired QR
  if (payload === "expired") {
    sendError(res, 410, "SESSION_EXPIRED", "This attendance session is no longer active.");
    return;
  }

  // Check if the session ID looks valid
  const activeSession = buildActiveSession();
  const effectiveSessionId = sessionId === "current" ? activeSession.id : sessionId;

  // QR accepted — return validation result
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);

  res.json({
    valid: true,
    sessionId: effectiveSessionId,
    expiresAt: expiresAt.toISOString(),
  });
});

// ---------------------------------------------------------------------------
// POST /attendance/check-ins
// ---------------------------------------------------------------------------

router.post("/check-ins", (req, res) => {
  const student = (req as AuthenticatedRequest).student;
  const { sessionId, qrPayload, selfieAssetId } = req.body as {
    sessionId?: string;
    qrPayload?: string;
    selfieAssetId?: string;
  };

  // Validate required fields
  if (!sessionId) {
    sendError(res, 400, "VALIDATION_FAILED", "sessionId is required.");
    return;
  }

  if (!qrPayload) {
    sendError(res, 400, "QR_INVALID", "qrPayload is required.");
    return;
  }

  if (!selfieAssetId) {
    sendError(res, 400, "SELFIE_REQUIRED", "selfieAssetId is required. Upload the selfie first.");
    return;
  }

  // Check for duplicate check-in
  const alreadyCheckedIn = checkIns.some(
    (c) => c.studentId === student.id && c.sessionId === sessionId,
  );

  if (alreadyCheckedIn) {
    sendError(
      res,
      409,
      "ALREADY_CHECKED_IN",
      "You have already checked in to this session.",
    );
    return;
  }

  // Look up session info for the response
  const activeSession = buildActiveSession();
  const course = sessionId === activeSession.id ? activeSession.course : "Software Engineering";
  const location =
    sessionId === activeSession.id ? activeSession.location : "Innovation Hall · Room 204";

  // Create the check-in
  checkInCounter++;
  const newCheckIn: MockCheckIn = {
    id: `checkin_${checkInCounter}`,
    studentId: student.id,
    sessionId,
    status: "present",
    verifiedAt: new Date().toISOString(),
    course,
    location,
  };

  checkIns.unshift(newCheckIn);

  // Return the created check-in (without studentId — the client knows who they are)
  res.status(201).json({
    id: newCheckIn.id,
    status: newCheckIn.status,
    verifiedAt: newCheckIn.verifiedAt,
    course: newCheckIn.course,
    location: newCheckIn.location,
  });
});

// ---------------------------------------------------------------------------
// GET /attendance/me
// ---------------------------------------------------------------------------

router.get("/me", (req, res) => {
  const student = (req as AuthenticatedRequest).student;
  const cursor = req.query["cursor"] as string | undefined;
  const limit = Math.min(Number(req.query["limit"]) || 20, 50);

  // Filter check-ins for this student
  const studentCheckIns = checkIns.filter((c) => c.studentId === student.id);

  // Simple cursor-based pagination (cursor = check-in ID)
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = studentCheckIns.findIndex((c) => c.id === cursor);
    if (cursorIndex >= 0) {
      startIndex = cursorIndex + 1;
    }
  }

  const page = studentCheckIns.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < studentCheckIns.length;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  res.json({
    items: page.map((c) => ({
      id: c.id,
      course: c.course,
      location: c.location,
      verifiedAt: c.verifiedAt,
      status: c.status,
    })),
    nextCursor,
  });
});

export default router;
