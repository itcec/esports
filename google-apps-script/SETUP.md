# CEC Esports Apps Script setup

This folder is the backend source of truth. Do not place service-account keys or
private Drive links in the frontend.

1. Create/open the tournament Google Sheet and open **Extensions → Apps Script**.
2. Replace `Code.gs` with the file in this folder and save.
3. Run `setupSheets` once. Approve the script permissions. Confirm the `TEAMS`
   and `PLAYERS` tabs exist.
4. In **Project Settings → Script properties**, add:

   - `FIREBASE_WEB_API_KEY`: the Firebase web API key from the project config.
   - `FIREBASE_DATABASE_URL`: the exact Realtime Database URL used by the site.
   - Do not add `ADMIN_KEY` for production. It is only a temporary migration escape hatch.

5. Deploy → New deployment → Web app:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the `/exec` URL into `assets/js/registration-api.js`.
7. After every code change, deploy a **new version** at the same Web App URL.

Public API calls are limited to registration creation and public team summaries.
Detailed registration reads and all status writes require a Firebase ID token;
the script verifies the token and approved staff record server-side.

The current UI is text-only verification. Google Drive upload support must be
added as a separate reviewed feature before collecting identity images: create
private folders, validate MIME type/size, write only file IDs to Sheets, and
never return public Drive URLs.
