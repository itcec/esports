# Deployment instructions

The canonical site is the repository root. Deploy the root to Vercel with no
build command and no output directory. GitHub Pages is optional and should use
the root of `main`.

Complete setup is in
[ANTIGRAVITY-IMPLEMENTATION-PLAN.md](ANTIGRAVITY-IMPLEMENTATION-PLAN.md).

Backend source and Apps Script deployment notes are in
[google-apps-script/SETUP.md](google-apps-script/SETUP.md). Firebase Realtime
Database rules are in `firebase-database.rules.json`.

Important: the public frontend must never contain Google Drive credentials,
service-account keys, or a production admin key. Identity-file uploads are not
enabled until the private Google Drive phase in the implementation plan is
implemented and tested.
