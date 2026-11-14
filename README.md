# SEMS: Secure Examination Management System

SEMS is a role-based web platform that runs an examination through its whole life cycle: question bank, exam creation and
scheduling, timed and randomised delivery, submission, automatic grading, faculty evaluation, result publication and
tamper-evidence checks. Security is enforced on the server at every stage. The server needs **no npm dependencies**: it uses only
the modules built into Node.js.

> **Project:** Special Project, Faculty of Science & Technology, The ICFAI Foundation for Higher Education (IFHE), Hyderabad
> **Guide:** Dr. Dileep Kumar M

---

## Contents
1. [Features](#1-features)
2. [Technology stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Project structure](#4-project-structure)
5. [Prerequisites](#5-prerequisites)
6. [Installation and running](#6-installation-and-running)
7. [Demo accounts and a first walkthrough](#7-demo-accounts-and-a-first-walkthrough)
8. [Using the system, by role](#8-using-the-system-by-role)
9. [Camera and face checks](#9-camera-and-face-checks)
10. [Configuration (environment variables)](#10-configuration-environment-variables)
11. [Production deployment](#11-production-deployment)
12. [Testing](#12-testing)
13. [API overview](#13-api-overview)
14. [Security summary](#14-security-summary)
15. [Troubleshooting](#15-troubleshooting)
16. [Project status and known limits](#16-project-status-and-known-limits)
17. [Documentation index](#17-documentation-index)
18. [Licences and third-party material](#18-licences-and-third-party-material)

---

## 1. Features

| Area | What it does |
|---|---|
| **Three portals** | Student, Faculty and Admin, each with its own pages. Roles are enforced on the server, not just hidden in the interface. |
| **Authentication** | scrypt password hashing, signed and revocable sessions, lockout after repeated failures, optional time-based two-factor login (TOTP), password re-entry for sensitive actions. |
| **Question bank and exams** | MCQ, multi-select, true/false, short and long answers; reusable bank; exam scheduling with a status life cycle (draft, scheduled, live, completed, evaluating, published). |
| **Secure delivery** | Server-side timer and deadline, auto-save, resume after interruption, auto-submit, per-student shuffle of questions and options, answer keys never sent to the browser. |
| **Monitoring** | Tab switch, fullscreen exit, copy/paste/cut, right-click and shortcut logging; heartbeat; optional camera check with face detection; explainable, advisory risk score; violation policy (warn, flag, auto-submit). |
| **Grading** | Automatic grading with optional negative marking; evaluation queue for short and long answers; per-question feedback; student result review. |
| **Integrity** | SHA-256 hash of every graded result anchored in a hash-chained ledger; every audit-log entry chained, with anchored chain heads; Admin verification pages. |
| **Communication** | Notices targeted by department and class, validated file uploads (resources), in-app notifications. |
| **Reports** | Exam report (participation, scores, pass rate, question performance, absentees), dashboards, security summary. |
| **Operations** | Versioned database migrations, online backup, Docker + Caddy with automatic HTTPS, optional three-replica profile, health and readiness probes. |

## 2. Technology stack

| Layer | Technology |
|---|---|
| Server | Node.js 22 (TypeScript run natively), built-in `http` module and a hand-written route table |
| Database | SQLite through the built-in `node:sqlite` (WAL mode), 22 tables, 6 versioned migrations |
| Client | Dependency-free JavaScript, HTML and CSS served by the same process |
| Security | scrypt, HMAC-SHA256 tokens, TOTP (RFC 6238), AES-256-GCM sealing of two-factor seeds, strict Content Security Policy |
| Integrity | SHA-256, canonical JSON, hash-chained local ledger (Solidity + Hardhat draft included) |
| Face check | Viola-Jones detector written in JavaScript, using OpenCV's frontal-face Haar cascade, run in the browser |
| Deployment | Docker, Docker Compose, Caddy 2 |
| Testing | `node:test` and Node's built-in coverage report |

## 3. Architecture

```
 Browser (Student / Faculty / Admin portals)
        │  HTTPS, JSON, Bearer token
        ▼
 Caddy reverse proxy  (HTTPS, least-connection balancing, health check /api/ready)
        ▼
 Node.js application (1 to 3 identical replicas)
   http.ts      routing, security headers, rate limit, role check
   service.ts   authentication, exams, attempts, grading, risk score, audit chain, integrity
   extras.ts    notices, resources, question bank, reports, catalog
   grading.ts   pure grading functions        security.ts  scrypt, tokens, TOTP, AES-GCM
   ledger.ts    ledger interface + local hash-chained ledger
        ▼
 SQLite (WAL) on a shared volume  +  uploads folder  +  backups
```

Principles: **the server decides** (marks, deadlines, roles); **closed by default** (every route lists its allowed roles; a
route-sweep test enforces it); **explainable automation** (risk scores list their reasons and never fail a student by themselves).
Details: `docs/ARCHITECTURE.md`.

## 4. Project structure

```
sems/
├── server/
│   ├── src/          main.ts  http.ts  service.ts  extras.ts  grading.ts  security.ts  ledger.ts  db.ts  seed.ts  backup.ts
│   ├── public/       index.html  app.css  app.js  facedetect.js  face-cascade.json      (browser client)
│   ├── test/         10 test files + fixtures/                                           (54 automated tests)
│   └── package.json  scripts: start, test, coverage, backup
├── database/         schema.sql                (current schema, SQLite dialect)
├── blockchain/       ExamIntegrity.sol + Hardhat project   (draft; not compiled or run)
├── deploy/           Caddyfile, Caddyfile.ha, backup.sh
├── docs/             ARCHITECTURE, API, SECURITY, DEPLOYMENT, TEST_MATRIX, MANUAL_QA, MIDTERM_ALIGNMENT, THIRD_PARTY_NOTICES
├── docker-compose.yml        single instance + HTTPS
├── docker-compose.ha.yml     three replicas + load balancer
└── .env.example
```

## 5. Prerequisites

| Need | Version | Notes |
|---|---|---|
| Node.js | **22.13 or later** | Required for the built-in `node:sqlite` module. Check with `node -v`. |
| Browser | Current Chrome, Edge, Firefox or Safari | Camera check needs `http://localhost` or HTTPS. |
| Docker + Compose | optional | Only for the production deployment. |
| Hardhat | optional | Only to compile the Solidity draft in `blockchain/`. |

There is **no `npm install` step** for the server.

## 6. Installation and running

```bash
# 1. get the code (unzip the project, or clone your repository)
cd sems/server

# 2. (optional) run the automated tests
npm test            # 54 tests, should all pass

# 3. start the server (loads demo data in development)
npm start           # http://localhost:4000
```

Open **http://localhost:4000** in your browser.

Useful commands (run in the `server` folder):

| Command | Purpose |
|---|---|
| `npm start` | Start the server on port 4000 (`PORT` changes it). |
| `npm test` | Run all 54 automated tests. |
| `npm run coverage` | Run the tests with Node's coverage report. |
| `npm run backup -- backup.db` | Online snapshot of the running database. |

The first start creates `sems.db` in the `server` folder (set another path with `SEMS_DB`). To reset everything, stop the server,
delete `sems.db` (and `sems.db-wal`, `sems.db-shm`), and start again.

> **Windows:** use Command Prompt or PowerShell; the same commands work. If `npm start` reports an unknown option, check that
> `node -v` shows 22.13 or later.

## 7. Demo accounts and a first walkthrough

On a new database in development the server creates these accounts. All use the password **`Demo@12345!`**. They are for
development only and are flagged to change their password at first use.

| Role | Email |
|---|---|
| Admin | `admin@example.com` |
| Faculty | `faculty@example.com` |
| Student | `student@example.com`, `student2@example.com` |

The seed also creates the exam **"Data Structures Midterm"** (4 questions, 10 marks, 60 minutes, passing marks 6). It starts one
minute before the server is first seeded and **closes 60 minutes later**; after that students see "Exam window has closed" (see
[Troubleshooting](#15-troubleshooting)).

**Five-minute tour**

1. Sign in as `student@example.com`, open **My Exams → Instructions → Start Examination**, answer the questions and submit.
2. Sign in as `faculty@example.com`, open **Evaluation Queue**, mark the short answer, then **Examinations → Submissions → Publish results** (password required).
3. Sign in again as the student and open **Results → Review**.
4. Sign in as `admin@example.com`, open the submission and choose **Verify Examination Integrity**, then **Audit Logs → Verify audit chain**.

## 8. Using the system, by role

### Student
1. **Sign in** and change the temporary password when prompted (Profile).
2. **My Exams**: open *Instructions* for an exam and read the security rules.
3. **Start Examination**: allow fullscreen (and the camera, if the exam needs it). Use *Save & Next*, the question navigator and the timer.
4. Stay in the exam window. Leaving fullscreen, switching tabs or using copy/paste is recorded.
5. **Submit exam** and confirm. The exam also closes by itself when the time is over.
6. After the faculty publish results: **Results** and **Review** show marks, grade and feedback.

### Faculty
1. **Question Bank**: add reusable questions (type, options, correct answer, marks, difficulty, topic).
2. **Examinations → Create exam**: title, subject, start time, duration, passing marks, negative marking, violation policy and limit, instructions, and the options *Randomise*, *Camera presence check* and *Show answers after publishing*.
3. Add questions (or import from the bank), then open **Manage** and press **Move to SCHEDULED**; students can start the exam inside its window (the next button, **Move to LIVE**, is optional).
4. **Evaluation Queue**: mark short and long answers, add feedback.
5. **Submissions**: check the risk score and violations, then **Publish results** (password required). **Report** shows participation and question performance.
6. Post **Notices** and upload **Resources**.

### Admin
1. **Users**: create users (temporary password), set department and class, suspend or deactivate accounts.
2. **Departments & Subjects**: maintain the catalog used for targeting.
3. **Audit Logs → Verify audit chain** and **Verify Integrity** on any submission.
4. **Security Monitoring**: violations by type, failed logins, suspicious sessions.
5. **Profile**: enable two-factor login (set `SEMS_REQUIRE_ADMIN_MFA=1` to make it compulsory).

## 9. Camera and face checks

The check is **optional per exam**. Tick **"Camera presence check"** when creating the exam; students then see the line
"Your camera must stay on…" on the instructions page and a small *Camera* preview on the exam screen.

What is checked, about every 4 seconds, entirely **inside the student's browser** (nothing is uploaded or stored):

| Event | Raised when |
|---|---|
| `CAMERA_UNAVAILABLE` | Permission denied, no camera, or the camera stopped or was muted |
| `CAMERA_COVERED` | Picture very dark or flat (black screen, lens covered) for 3 checks in a row (about 12 s) |
| `FACE_NOT_FOUND` | No face detected for 3 checks in a row (about 12 s) |
| `MULTIPLE_FACES` | More than one face detected for 2 checks in a row (about 8 s) |

These are **signals, not penalties**: they appear in the faculty's violations table and add points to the advisory risk score
(10, 8, 10 and 15), but they never count towards the violation limit and never auto-submit an attempt. A person decides.

How it works: `server/public/facedetect.js` is a JavaScript implementation of the Viola-Jones detector, and
`face-cascade.json` is OpenCV's frontal-face model converted to JSON. Against OpenCV's own detector (same settings) it agreed on 26 of 26 reference
frames, and on 336 further test frames it found the face in 113 of 120 rotated, resized and re-lit variants with no false second
face; on non-face images the false-alarm rate was about 1 in 70 single frames (three consecutive misses are required in the app).

Requirements and limits: use `http://localhost` or HTTPS (browsers block cameras on plain `http://` addresses); the detector finds
roughly frontal faces, so poor light, a turned head, a hat or a mask can cause false "face not found" signals; it does not identify
the person. It was verified in Chromium with Chromium's built-in fake camera; please also try it on your own webcam.

## 10. Configuration (environment variables)

| Variable | Purpose |
|---|---|
| `PORT` | Port to listen on (default 4000). |
| `SEMS_DB` | Database file path (default `./sems.db`). |
| `SEMS_UPLOADS` | Folder for uploaded resources. |
| `SEMS_SECRET` | Signs tokens and derives the key that encrypts two-factor seeds. **Required in production**, 32+ random characters. |
| `NODE_ENV=production` | Production guards: refuses a weak secret and refuses demo users. |
| `SEMS_SEED_DEMO=1` | Load demo data even in production mode (never do this for real use). |
| `SEMS_BOOTSTRAP_ADMIN_EMAIL`, `SEMS_BOOTSTRAP_ADMIN_PASSWORD` | Create the first Admin on an empty database. Remove after first start. |
| `SEMS_REQUIRE_ADMIN_MFA=1` | Admins cannot use the API until two-factor login is enabled. |
| `SEMS_TRUST_PROXY=1` | Trust `X-Forwarded-For` and send HSTS. Only when a trusted proxy is the sole entry point. |
| `SEMS_DOMAIN` | Domain name for Caddy's automatic HTTPS (Docker files). |

Copy `.env.example` to `.env` and edit it for Docker deployments.

## 11. Production deployment

```bash
cp .env.example .env          # set SEMS_DOMAIN, SEMS_SECRET (openssl rand -base64 48), bootstrap admin
docker compose up -d --build  # single instance + automatic HTTPS
# high-availability profile (three replicas behind Caddy):
docker compose -f docker-compose.ha.yml up -d --build
```

1. Sign in as the bootstrap Admin, change the password, enable two-factor login.
2. Remove the two bootstrap variables from `.env` and restart.
3. Create faculty and student accounts and the department/course/subject catalog.
4. Schedule `deploy/backup.sh` (or `npm run backup -- file.db`) and rehearse one restore.

Health probes: `GET /api/health` (liveness) and `GET /api/ready` (readiness). All replicas share one host and one local disk, so
this survives a replica crash but not the loss of the host; true multi-host failover needs the PostgreSQL port described in
`docs/DEPLOYMENT.md`. **The compose files were written but not run in the build environment**, so smoke-test them (start an
exam and stop a replica) before relying on them.

## 12. Testing

```bash
cd server
npm test            # 54 tests in 10 files
npm run coverage    # coverage report
```

* All 54 tests pass; **100% of the lines of every backend module** are covered (`service.ts`, `http.ts`, `extras.ts`, `grading.ts`, `security.ts`, `ledger.ts`, `db.ts`). The browser client script is covered about 50% by automated smoke tests; the rest is checked manually (`docs/MANUAL_QA.md`).
* Test levels: unit (grading, hashing, TOTP, tokens, face detector), service (exam life cycle, timers, violations, risk, ledger, audit chain, migrations), HTTP (routes, roles, validation, uploads, headers), end-to-end life cycle, client smoke tests, route sweep.
* The complete exam life cycle was also run in a real browser (headless Chromium) with screenshots, and the camera/face checks were verified with video feeds containing one face, no face, two faces and a black screen.
* Requirement-to-test mapping: `docs/TEST_MATRIX.md`.

## 13. API overview

JSON over HTTP, `Authorization: Bearer <token>`. Responses are `{ "success": true, "data": ... }` or
`{ "success": false, "message": "...", "errorCode": "..." }`. There are 56 routes; the full list is in `docs/API.md`.

| Group | Examples | Roles |
|---|---|---|
| Authentication | `POST /api/auth/login`, `/logout`, `/change-password`, `/mfa/setup`, `/mfa/enable`, `GET /api/me` | public / any user |
| Student | `GET /api/student/exams`, `POST …/exams/:id/start`, `PUT …/attempts/:id/answers/:qid`, `POST …/submit`, `…/violations`, `…/heartbeat`, `GET …/results/:id/review` | STUDENT |
| Faculty | `POST /api/faculty/exams`, `…/questions`, `…/status`, `GET /api/faculty/pending-evaluations`, `POST …/evaluate`, `…/publish-results`, `GET …/report`, question bank, notices, resources | FACULTY |
| Admin | `GET/POST /api/admin/users`, `GET /api/admin/audit`, `/audit/verify`, `/security/summary`, catalog | ADMIN |
| Integrity | `GET /api/integrity/:attemptId` | FACULTY, ADMIN |
| Probes | `GET /api/health`, `GET /api/ready` | none |

## 14. Security summary

* Passwords: scrypt with a per-user salt, a password policy, lockout after 5 failures in 15 minutes, a per-IP rate limit; unknown email and wrong password give the same message.
* Sessions: signed tokens bound to revocable server-side sessions; admin sessions last 15 minutes; logout, suspension and password change revoke immediately.
* Authorisation: role gate before every handler, ownership enforced in SQL (other users' records return 404), named-field copying against mass assignment, password re-entry for sensitive actions.
* Input and output: parameterised SQL only; the client builds the DOM with `textContent`; strict Content Security Policy; `nosniff`, no-store and frame-denial headers.
* Uploads: extension allow-list, content (magic-byte) check, executables rejected, 5 MB cap, generated file names, served as attachments.
* Integrity: result hashes anchored in a ledger; audit log hash-chained and anchored; both verifiable by the Admin.
* Privacy: no image or video is uploaded or stored; hashes contain no names or emails.
* Browser-based exam security is *prevention, detection and logging*, not absolute control: a second device or a virtual machine can bypass it, and risk scores are advisory. Full threat analysis: `docs/SECURITY.md`.

## 15. Troubleshooting

| Problem | Cause and fix |
|---|---|
| **"Exam window has closed."** | The demo exam started when the database was first seeded and lasts 60 minutes. Stop the server, delete `sems.db` (+ `-wal`, `-shm`) and restart for a fresh exam, or create your own exam with a start time of now or earlier, add a question, and press *Move to SCHEDULED* on its Manage page. |
| Camera preview never appears | The exam must have **Camera presence check** ticked. Use `http://localhost:4000` or HTTPS, click *Allow* for the camera, and make sure no other app is using it. |
| `FACE_NOT_FOUND` appears although you are in front of the camera | Improve the lighting, face the camera, and keep your face fully in view. The detector finds roughly frontal faces. The event is only a signal for the examiner. |
| `Cannot find module 'node:sqlite'` / SQLite errors | Node.js is older than 22.13. Upgrade (`node -v`). |
| Port 4000 already in use | Run with another port: `PORT=4010 npm start` (Windows PowerShell: `$env:PORT=4010; npm start`). |
| "Invalid email or password" after several tries | The account is locked for 15 minutes after 5 failures; wait, or have the Admin reactivate it. |
| Layout looks cramped on the exam screen | Known issue: the strict CSP blocks inline styles the client sets. The page works; moving those styles into CSS is listed as future work. |
| Forgot the production secret | Two-factor logins stop working (seeds are encrypted with it). Restore the old `SEMS_SECRET`, or have users re-enrol. |
| Everything is broken after experiments | Delete `sems.db*` and restart to get a clean demo database. |

## 16. Project status and known limits

| Area | State |
|---|---|
| API (56 routes), exam engine, grading, monitoring, audit, RBAC, MFA, uploads, reports, integrity | **Done**, 54 automated tests, 100% line coverage of the backend modules |
| Per-student randomisation, hash-chained audit log with verification, camera check with face detection | **Done** |
| Browser client (three portals, secure exam screen, grading UI) | **Done**; verified in headless Chromium; other browsers not yet verified (`docs/MANUAL_QA.md`) |
| Docker + HTTPS deployment, three-replica profile, backups, migrations | **Written**; backups and migrations tested, compose files **not run** |
| PostgreSQL / multi-host failover | **Not done**; runs on SQLite (port notes in `docs/DEPLOYMENT.md`) |
| Real blockchain | **Not done**; local hash-chained ledger; the Solidity/Hardhat draft in `blockchain/` is uncompiled and unrun |
| React/TypeScript client | **Not done**; plain JavaScript client |
| Email, password reset, malware scanning of uploads | **Not done** |
| Inline styles blocked by the strict CSP (some layout lost) | **Open** |
| Identity verification, gaze or object detection | **Not in scope**; the face check only counts faces |

`node:sqlite` is marked experimental in Node.js; the warning is suppressed in the npm scripts.

## 17. Documentation index

| File | Content |
|---|---|
| `docs/ARCHITECTURE.md` | Design, data flow, multi-instance operation |
| `docs/API.md` | All routes and payloads |
| `docs/SECURITY.md` | Controls, threats, camera and face checks, limits |
| `docs/DEPLOYMENT.md` | Docker, HTTPS, HA profile, backups, PostgreSQL port |
| `docs/TEST_MATRIX.md` | Requirements mapped to tests |
| `docs/MANUAL_QA.md` | Manual browser checklist |
| `docs/MIDTERM_ALIGNMENT.md` | Mid-term plan versus delivered work |
| `docs/THIRD_PARTY_NOTICES.md` | Licence of the face model and test images |
| `blockchain/README.md` | Solidity and Hardhat draft |

## 18. Licences and third-party material

The SEMS source code is the work of the project team for the academic Special Project named above. The only third-party material in
the repository is the OpenCV frontal-face Haar cascade (`server/public/face-cascade.json`, Intel License Agreement, text in
`docs/THIRD_PARTY_NOTICES.md`) and two public-domain sample images used as test fixtures. The server has no npm dependencies.
