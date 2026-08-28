# CEC Esports Apps Script & Private Google Drive Setup

This folder is the backend source of truth. Do not place service-account keys, Google Drive credentials, or private file links in the frontend.

## 1. Paste Backend Code
1. Open the tournament Google Sheet and go to **Extensions → Apps Script**.
2. Replace `Code.gs` with [`Code.gs`](Code.gs) in this directory and click **Save**.

## 2. Initialize Sheets and Private Folders
1. Run `setupSheets` once from the function toolbar.
2. Grant permissions when prompted.
3. Confirm that `TEAMS`, `PLAYERS`, and `VERIFICATION_DOCS` tabs exist in your Google Sheet. The `PLAYERS` tab will receive the optional `ProfileImageFileId`, `ProfileImageUrl`, and `ProfileImageVisible` columns.
4. `setupSheets` also creates these Drive folders in the Google Drive of the sheet owner:
   - Private verification: `CEC ESPORTS / TOURNAMENTS / 2026 / MLBB / PLAYER_VERIFICATION`
   - Public opt-in profile images: `CEC ESPORTS / TOURNAMENTS / 2026 / MLBB / PUBLIC_PROFILE_IMAGES`

## 3. Script Properties
In Apps Script **Project Settings → Script properties**, ensure:
- `FIREBASE_WEB_API_KEY`: `AIzaSyB73WKKAEc-YmVgWxsMvNWZyJBgHSGqYP8`
- `FIREBASE_DATABASE_URL`: `https://esports-7ec77-default-rtdb.firebaseio.com`
- *(Optional)* `DRIVE_VERIFICATION_FOLDER_ID`: (Only if you want to override the auto-created folder ID).

## 4. Deploy New Version
1. Click **Deploy → Manage deployments**.
2. Edit active deployment → select **Version: New version**.
3. Execute as: **Me** (`jlcabucos.cec@gmail.com`).
4. Who has access: **Anyone**.
5. Click **Deploy**.

## Security Model:
- **Public**: Can create registrations, list public summaries, and upload verification files during the registration wizard.
- **Public profile images**: Optional participant photos are stored separately in `PUBLIC_PROFILE_IMAGES`, marked viewable by link, and displayed only for approved teams. Do not place identity documents in this folder.
- **Private / Staff**: Detailed registration reads (`getRegistration`), status updates (`updateTeamStatus`, `updatePlayerVerification`), and document byte streaming (`getPrivateVerificationFile`) require a verified Firebase ID token and approved staff status.
- Files are kept private in Drive; Apps Script streams file bytes directly to authenticated staff sessions without ever generating public links.
