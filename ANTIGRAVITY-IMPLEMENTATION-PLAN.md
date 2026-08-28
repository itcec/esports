# CEC Esports 2026 implementation and deployment plan

This repository is now intentionally one static deployment at its root. Use
Antigravity for the remaining implementation work and use the checklist at the
end for the final recheck.

## Current baseline

- Hosting files: root HTML files plus `assets/`.
- Authentication: Firebase Google Auth and Realtime Database staff approvals.
- Registration data: Google Apps Script → Google Sheets.
- Private verification files: not implemented yet; do not collect them until the
  Drive phase below is complete.
- Backend source: `google-apps-script/Code.gs` and `google-apps-script/SETUP.md`.
- Firebase rules to paste: `firebase-database.rules.json`.
- Coordinator: `jlcabucos.cec@gmail.com`.

## Phase 1 — GitHub and Vercel

1. In GitHub, use the repository's `main` branch and upload/commit the root
   files from this project. Do not upload `docs/`, `_deploy-flat/`, or
   `github-frontend-upload/`; they were duplicate mirrors and have been removed
   from the working deployment.
2. In Vercel, select the GitHub repository, production branch `main`, Framework
   Preset `Other`, Root Directory `.` and leave Build Command and Output
   Directory empty. Deploy the static root.
3. Confirm Vercel serves `index.html` and that a deployment contains
   `assets/js/registration-api.js`, `assets/js/firebase-config.js`,
   `assets/js/auth-guard.js`, `assets/js/live-manager.js`, and `staff-login.html`.
4. Add a deployment protection rule or preview-only workflow if private admin
   screens must not be indexed before Firebase is configured. The page guard is
   still required because URLs are discoverable.

## Phase 2 — Firebase Auth and authorization

1. Firebase Console → Authentication → Sign-in providers: enable Google and use
   the coordinator account as support email.
2. Authentication → Settings → Authorized domains: add the Vercel domain,
   `localhost`, and the GitHub Pages domain only if GitHub Pages is used.
3. Realtime Database: create the database in the region matching
   `assets/js/firebase-config.js`, or copy the actual database URL into that
   file before deployment.
4. Paste `firebase-database.rules.json` into Realtime Database → Rules and
   Publish. In Rules Playground verify that anonymous reads of `staff` and
   anonymous writes to `liveMatches` are denied. Public reads of
   `liveMatches` are intentional.
5. Sign in once at `/staff-login.html` as the coordinator. Confirm a
   `/staff/{uid}` record with `role: super_admin` and `status: approved`.
6. Have each official sign in once, then approve them from `/admin.html`. Test
   pending, approved, revoked, and signed-out states in separate browser
   profiles.

The Firebase web config is not a secret. Never add a service-account JSON,
Firebase Admin credential, Apps Script owner credential, or Drive credential to
GitHub or an HTML file.

## Phase 3 — Apps Script and Sheets

1. Open the owner Sheet → Extensions → Apps Script. Paste
   `google-apps-script/Code.gs` and run `setupSheets` once.
2. Deploy as Web App, Execute as `Me`, Who has access `Anyone`. Copy the `/exec`
   URL into `assets/js/registration-api.js`.
3. Script Properties must contain `FIREBASE_WEB_API_KEY` and the exact
   `FIREBASE_DATABASE_URL`. Do not set `ADMIN_KEY` in production; it is only a
   migration escape hatch and must never be treated as authentication.
4. Deploy a new version after every Apps Script edit. Saving source alone does
   not update the Web App.
5. Test the public endpoint:

   `GET <web-app-url>?action=listRegistrations`

   It must return JSON, not a Google login redirect. Test that
   `getRegistration`, `updateTeamStatus`, and `updatePlayerVerification` fail
   without a valid Firebase token and succeed only for an approved staff user.

## Phase 4 — Google Drive private verification storage

Implement this in Antigravity before enabling identity uploads:

1. Create private Drive folders:
   `CEC ESPORTS/TOURNAMENTS/2026/MLBB/PLAYER_VERIFICATION`,
   `MATCH_EVIDENCE`, `DISPUTES`, and `EXPORTS`.
2. Add a Drive folder ID as an Apps Script Script Property. The browser sends a
   file only to Apps Script; Apps Script validates authenticated ownership,
   MIME type, and size, then creates the file in the private folder.
3. Store only `DriveFileId`, document type, player ID, upload timestamp, and
   verification status in Sheets. Never put image bytes, public Drive URLs, or
   folder permissions in Firebase.
4. Add `uploadVerificationFile` and `getPrivateVerificationFile` endpoints.
   Both require an approved staff token for reads; uploads may be allowed only
   for the registration owner workflow that you explicitly choose. Return a
   short-lived controlled download response or proxy the bytes through Apps
   Script; do not call `setSharing(ANYONE_WITH_LINK)`.
5. Add ID front/back and selfie inputs to `register-verification.html`, with
   previews, file-size/type validation, upload progress, retry/error states, and
   a privacy notice. Do not store base64 files in sessionStorage.
6. In `admin-verification.html`, show private-document status and an authorized
   view action only after the staff guard and Apps Script authorization pass.
   Redact all document IDs and private links from public team pages.

Optional public player profile images:

- Profile images are optional for both Student and Faculty rosters.
- Store them only in the separate `PUBLIC_PROFILE_IMAGES` Drive folder; never
  mix them with `PLAYER_VERIFICATION` documents.
- Show profile images only for approved teams and expose only public roster
  fields (display name, IGN, role, roster type, and profile image URL).
- Uploading a profile image opts the participant into its display in public
  live-match rosters. Student IDs, contact details, and verification records
  remain private.

## Phase 5 — Functional tournament work

Implement in this order:

1. Replace demo live matches with a controlled `liveSessions` schema or seed
   only approved production matches. Keep public stream display read-only.
2. Finish `admin-officiating.html`: assigned match, check-in, start/pause/end,
   stream validation, score, update feed, and result submission.
3. Persist results, bracket advancement, standings, disputes, assignments, and
   audit events in Sheets via Apps Script. Every write needs a server-side
   authorization check and an idempotent permanent ID.
4. Connect `admin-checkin.html`, `admin-match-report.html`,
   `admin-disputes.html`, and `admin-dispute-review.html` to real endpoints.
5. Build captain dashboard access only after a captain identity/session model
   is selected. Do not infer captain access from an untrusted team ID in a URL.

## Final recheck after Antigravity changes

Run these checks and attach the results when asking me to recheck:

- `rg --files -g '!node_modules'` contains only one deployable HTML/assets tree.
- Every HTML asset URL resolves relative to the root; no `docs/` or mirror path
  appears in a deployed page.
- Every admin HTML page loads Firebase/auth guard and denies signed-out access.
- Public `/teams.html` loads public summaries; private verification data never
  appears in its HTML or network response.
- Registration wizard survives refresh, submits one row, and shows its assigned
  `TEAM-000x` ID.
- Apps Script GET returns JSON with HTTP 200 and POST writes the expected Sheet
  rows.
- Firebase Rules Playground denies anonymous staff/live writes and permits only
  approved staff writes.
- Coordinator approve/revoke changes the visible access state without a cache
  refresh.
- Live arena is read-only for visitors; officials can publish only while
  approved, and invalid stream URLs fall back safely.
- Test `/nonsense` for the custom 404, mobile hamburger navigation, keyboard
  focus, and no horizontal overflow.
- Inspect GitHub history and repository secrets for accidental Firebase Admin,
  Apps Script, or Drive credentials before production deployment.
