# Campus Engine API

This document describes the API boundary for the Campus Engine attendance app.
The API server is mounted at `/api` and listens on the workspace `PORT`.

## Current status

The API server currently exposes health and discovery endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | API service status for preview and deployment checks |
| `GET` | `/api/` | API metadata and links |
| `GET` | `/api/healthz` | Lightweight health check |
| `GET` | `/api/docs` | Machine-readable endpoint summary |

The QR validation, selfie capture, and attendance history are currently handled
by the mobile prototype. The attendance endpoints below are the contract to use
when moving those responsibilities to the server.

## Authentication

Attendance endpoints must require a Clerk session token:

```http
Authorization: Bearer <clerk-session-token>
```

The API must derive the student identity from the verified token. The client
must never send a user ID to select whose attendance is being read or changed.

## Planned attendance endpoints

### Get the active session

```http
GET /api/attendance/sessions/current
Authorization: Bearer <token>
```

Example response:

```json
{
  "id": "session_2026_08_31_se_204",
  "course": "Software Engineering",
  "location": "Innovation Hall · Room 204",
  "startsAt": "2026-08-31T09:00:00Z",
  "endsAt": "2026-08-31T10:00:00Z",
  "status": "active"
}
```

When there is no open class session, return `404` with the standard error
shape below.

### Validate a QR payload

```http
POST /api/attendance/sessions/{sessionId}/qr/validate
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "payload": "signed-qr-payload-from-camera"
}
```

Response:

```json
{
  "valid": true,
  "sessionId": "session_2026_08_31_se_204",
  "expiresAt": "2026-08-31T09:45:00Z"
}
```

The server must validate the signature, session, expiry, and course before the
mobile app opens the selfie step. Do not trust a client-only `valid` flag.

### Create a check-in

```http
POST /api/attendance/check-ins
Authorization: Bearer <token>
Content-Type: application/json
```

Request:

```json
{
  "sessionId": "session_2026_08_31_se_204",
  "qrPayload": "signed-qr-payload-from-camera",
  "selfieAssetId": "asset_123"
}
```

Response:

```json
{
  "id": "checkin_123",
  "status": "present",
  "verifiedAt": "2026-08-31T09:04:12Z",
  "course": "Software Engineering",
  "location": "Innovation Hall · Room 204"
}
```

The selfie should be uploaded through a separate short-lived asset upload
flow. The check-in endpoint should receive an asset reference, not a permanent
public image URL or a raw image embedded in JSON.

### Get the signed-in student's history

```http
GET /api/attendance/me
Authorization: Bearer <token>
```

Example response:

```json
{
  "items": [
    {
      "id": "checkin_123",
      "course": "Software Engineering",
      "location": "Innovation Hall · Room 204",
      "verifiedAt": "2026-08-31T09:04:12Z",
      "status": "present"
    }
  ],
  "nextCursor": null
}
```

## Error format

All non-2xx responses should use the same shape:

```json
{
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "This attendance session is no longer active.",
    "requestId": "req_123"
  }
}
```

Recommended codes:

- `UNAUTHENTICATED` — missing or invalid Clerk token
- `FORBIDDEN` — authenticated student is not allowed to use the session
- `SESSION_NOT_FOUND` — no matching session exists
- `SESSION_EXPIRED` — QR or session has expired
- `QR_INVALID` — QR payload signature or contents are invalid
- `ALREADY_CHECKED_IN` — student already has a check-in for the session
- `SELFIE_REQUIRED` — check-in is missing the identity asset
- `VALIDATION_FAILED` — selfie or session verification failed

## Mobile integration rules

1. Use `process.env.EXPO_PUBLIC_DOMAIN` through the shared API client setup.
2. Attach the current Clerk token with the shared auth token getter.
3. Keep the camera and selfie flow native in Expo.
4. Replace local history with the server history only after the API endpoints
   are implemented and authenticated.
5. Treat server responses as authoritative; the UI may show progress but must
   not mark attendance as verified until the server confirms it.