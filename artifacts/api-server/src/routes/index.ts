import { Router, type IRouter } from "express";
import healthRouter from "./health";
import attendanceRouter from "./attendance";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  res.json({
    name: "Campus Engine API",
    version: "0.1.0",
    health: "/api/healthz",
    documentation: "/api/docs",
  });
});

router.get("/docs", (_req, res) => {
  res.json({
    openapi: "3.1.0",
    title: "Campus Engine API",
    version: "0.1.0",
    basePath: "/api",
    authentication: "Bearer token (mock: use 'youssef', 'mariam', or 'karim')",
    note: "All attendance endpoints are currently mock implementations with in-memory storage.",
    endpoints: [
      {
        method: "GET",
        path: "/api/healthz",
        purpose: "Check that the API is running",
      },
      {
        method: "GET",
        path: "/api/attendance/sessions/current",
        purpose: "Return the active attendance session for the student",
        status: "mock",
      },
      {
        method: "POST",
        path: "/api/attendance/sessions/:sessionId/qr/validate",
        purpose: "Validate a QR payload against the session",
        status: "mock",
      },
      {
        method: "POST",
        path: "/api/attendance/check-ins",
        purpose: "Create a verified attendance check-in",
        status: "mock",
      },
      {
        method: "GET",
        path: "/api/attendance/me",
        purpose: "Return the signed-in student's attendance history",
        status: "mock",
      },
    ],
    documentationFile: "docs/API.md",
  });
});

router.use(healthRouter);
router.use("/attendance", attendanceRouter);

export default router;
