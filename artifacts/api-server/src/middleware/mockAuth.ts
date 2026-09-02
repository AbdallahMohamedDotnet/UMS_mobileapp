import type { Request, Response, NextFunction } from "express";
import { sendError } from "../lib/errors";

/**
 * Fake student profiles keyed by simple token strings.
 * Send `Authorization: Bearer youssef` to act as Youssef, etc.
 * Any other non-empty token defaults to the first student.
 */
const MOCK_STUDENTS: Record<string, { id: string; name: string; email: string }> = {
  youssef: { id: "student_youssef", name: "Youssef Magdy", email: "youssef@university.edu" },
  mariam:  { id: "student_mariam",  name: "Mariam Adel",   email: "mariam@university.edu" },
  karim:   { id: "student_karim",   name: "Karim Nabil",   email: "karim@university.edu" },
};

const DEFAULT_STUDENT = MOCK_STUDENTS["youssef"];

export type AuthenticatedRequest = Request & {
  student: { id: string; name: string; email: string };
};

/**
 * Mock authentication middleware.
 *
 * - Requires a `Bearer <token>` header.
 * - Maps known tokens to mock students; unknown tokens get the default student.
 * - Replace this with real Clerk verification when ready.
 */
export function mockAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, 401, "UNAUTHENTICATED", "Missing or invalid authorization token.");
    return;
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    sendError(res, 401, "UNAUTHENTICATED", "Missing or invalid authorization token.");
    return;
  }

  // Map the token to a mock student (or use the default)
  const student = MOCK_STUDENTS[token.toLowerCase()] ?? DEFAULT_STUDENT;

  (req as AuthenticatedRequest).student = student;
  next();
}
