# CEC Esports 2026 deployment checklist

The repository is the source of truth. Vercel hosts the static site, Firebase handles staff authentication and realtime staff state, and Apps Script/Sheets stores registrations, teams, matches, brackets, standings, and Drive-backed files.

## 1. GitHub

1. Review the changed files in Antigravity.
2. Commit the website and Apps Script changes to the branch connected to Vercel.
3. Push the commit to GitHub.
4. Confirm the Vercel deployment is using the intended repository, branch, and project root.

Do not commit Firebase service-account keys, Apps Script secrets, identity documents, or `.env` files.

## 2. Apps Script and Sheets

1. Open the Apps Script project bound to the tournament spreadsheet.
2. Replace its `Code.gs` with this repository’s `google-apps-script/Code.gs`.
3. Confirm Script Properties still contain `FIREBASE_WEB_API_KEY`, `FIREBASE_DATABASE_URL`, and the Drive folder IDs used by the security setup.
4. Run `setupSheets()` once. It creates missing sheets and adds the new `LogoUrl` and `TeamPhotoUrl` columns to `TEAMS`.
5. Deploy a new Web App version: execute as the owner and allow the deployed web app’s intended users to access it.
6. Copy the new `/exec` URL into `assets/js/registration-api.js` if the deployment URL changed.
7. Test these public actions in the deployed Apps Script URL: `listPublicTeams`, `listMatches`, `listStandings`, and `getBracketData`.

Team logos and team photos can be entered in the `TEAMS` sheet’s `LogoUrl` and `TeamPhotoUrl` columns. Only rows with `Status = Approved` appear publicly. Player profile images remain opt-in and are shown only when `ProfileImageVisible = Yes`.

## 3. Firebase

1. Add `cec-esports.vercel.app` to Firebase Authentication’s authorized domains.
2. Keep the Google provider enabled.
3. Deploy the reviewed Realtime Database rules from `firebase-database.rules.json`.
4. Sign in once with the coordinator account configured in `Code.gs` and confirm it is the super-admin account.
5. Test a second Google account: it must appear as pending, and it must not open `/control-center` until approved.

## 4. Vercel

No manual dashboard rewrite is required. The root `vercel.json` enables clean URLs and maps `/schedule`, `/staff`, and `/control-center` to the existing HTML entry files. After GitHub receives the commit:

1. Wait for the deployment to finish.
2. Verify `/`, `/schedule`, `/bracket`, `/teams`, `/rules`, `/staff`, and `/control-center`.
3. Verify old `.html` links redirect or resolve without exposing `.html` in the normal public navigation.
4. If the project is not connected to GitHub, trigger a deployment from the Vercel project or import the repository with the root directory set to this folder.

## 5. Twitch publishing test

An approved official enters a channel URL such as `https://www.twitch.tv/your-channel` in the staff match controls and sets the match status to `LIVE`. The public schedule shows `WATCH LIVE` only when both the status and a valid Twitch URL are published. The Twitch embed receives `cec-esports.vercel.app` as its `parent` domain.

## 6. Final acceptance test

- Home has only the registration and schedule calls to action; the header has Home, Schedule, Bracket, Teams, and Rules.
- Staff Login appears in the footer, not the public header.
- Signed-out `/control-center` redirects to `/staff`.
- Approved staff sign-in redirects to `/control-center`.
- Public schedule, bracket, standings, and teams show managed-data loading/empty states rather than demo records.
- Approved team cards show the team photo/logo, captain, description, and any opted-in player avatars.
- A non-live match does not show a Watch Live button.
- A live match without a published Twitch URL does not show a player or broadcast feed.
- Mobile navigation and the registration flow work at a narrow viewport.
