import { Router, type IRouter } from "express";
import healthRouter from "./health";

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
    authentication: "Bearer Clerk session token",
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
        status: "planned",
      },
      {
        method: "POST",
        path: "/api/attendance/check-ins",
        purpose: "Create a verified attendance check-in",
        status: "planned",
      },
      {
        method: "GET",
        path: "/api/attendance/me",
        purpose: "Return the signed-in student's attendance history",
        status: "planned",
      },
    ],
    documentationFile: "docs/API.md",
  });
});

router.use(healthRouter);

export default router;
