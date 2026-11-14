# Security notes

## Implemented (all covered by automated tests unless marked)
- Passwords: scrypt + per-user salt, policy (10+, mixed), never returned by any API. Account lockout 5 fails/15 min; per-IP login throttle; no user enumeration.
- Sessions: HMAC-signed tokens bound to revocable server sessions (logout, suspension, password/email change revoke). Admin sessions 15 min.
- Authorization: role gate on every route before handlers; ownership enforced in SQL (`... AND student_id=?`) so other students' attempts/results return 404 (no IDOR); faculty limited to own exams; explicit field picking (no mass assignment).
- Re-authentication (password) for: changing user status, email change, publishing results.
- Optional TOTP 2FA (seeds AES-256-GCM encrypted); `SEMS_REQUIRE_ADMIN_MFA=1` enforces it per request.
- Injection: parameterised SQL only; LIKE wildcards escaped. XSS: client builds DOM with textContent only; CSP `script-src 'self'`, no inline; API sends `nosniff`, `no-store`, frame denial.
- Uploads: extension allow-list + magic-byte check, executables rejected, 5 MB cap, sanitised names, server-generated storage names (0600), authorised download as attachment with sandbox CSP.
- Errors: uniform JSON, no stack traces; unexpected errors logged server-side only.
- Production guards: refuses to start with a weak/missing `SEMS_SECRET`; no demo users in production.
- Tamper-evident audit log: SHA-256 hash chain + ledger-anchored head (edit / delete / truncate detection), covering logins, failures, exam lifecycle, violations, publishing, user changes, integrity checks, denied access.
- Anti-cheating analytics are explainable and advisory: every risk point maps to a listed signal; nothing fails a student automatically unless the exam's AUTO_SUBMIT policy says so.
- Camera check privacy: frames are analysed in the browser on a 16x12 downscale; no image/video is transmitted or stored. Students are told on the instructions page.
- Oversized request bodies are discarded without buffering (hard cap), then answered with a clean 413.

## Honest limits
- **Browser exam security is best-effort.** Fullscreen/tab/copy detection can be bypassed (second device, VM, OS tools, disabled JS). It is prevention where possible + detection + logging + policy, as designed. Flagged attempts are for human review.
- Bearer token is in sessionStorage (XSS-exposure trade-off, mitigated by CSP/no innerHTML). HttpOnly cookie + CSRF token is stronger and is a recommended hardening.
- No CSRF tokens needed with header-based tokens today; add them if you move to cookies.
- No virus scanning of uploads; no email delivery (notifications are in-app only); no password-reset flow (admin-assisted only).
- LocalLedger is not a real blockchain: whoever controls the server and DB could rewrite both. A real EVM chain (see `blockchain/`) removes that trust.
- Rate limiting is stored in the shared database (consistent across replicas) but is simple fixed-window per IP; add a WAF for real DoS protection.
- The audit chain proves tampering *after the fact*; someone with full control of both the database and the ledger table (LocalLedger) could rebuild both. Use the EVM adapter for independent anchoring.
- Risk scores can produce false positives (flaky networks, accessibility tools, shared-screen setups): a human must review before any academic penalty.
- SQLite is single-writer and `node:sqlite` is marked experimental by Node: fine for a department/college on one host; move to PostgreSQL for large concurrent exam loads or multi-host HA.

## Camera and face checks (optional, per exam)
- Enabled per exam with "Camera presence check". Frames are read from the student's own camera, drawn to a small canvas and analysed **in the browser**; no image or video is uploaded or stored. Only an event name is sent.
- Every 4 s the client checks that the camera track is live and the picture is not black or flat (`CAMERA_UNAVAILABLE`, `CAMERA_COVERED`), then runs the bundled face detector (`public/facedetect.js` + `public/face-cascade.json`, OpenCV frontal-face cascade). Three consecutive checks with no face raise `FACE_NOT_FOUND`; two consecutive checks with more than one face raise `MULTIPLE_FACES`.
- All four are *signal-only*: they appear in the violations table and add to the explainable risk score (10, 8, 10 and 15 points) but never count toward the violation limit and never auto-submit. A person decides.
- Limits: the detector finds roughly frontal faces; poor light, a turned head, a hat or a mask can cause false "no face" signals, and it does not identify who the person is. See `docs/THIRD_PARTY_NOTICES.md` for the model licence.
