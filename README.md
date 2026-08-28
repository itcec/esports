# CEC Esports Intramurals 2026

Static Mobile Legends: Bang Bang tournament portal for Cebu Eastern College.
The repository root is the single canonical GitHub/Vercel deployment.

The root contains the public pages, staff/admin pages, `assets/`, and `staff-login.html`.
Backend source is kept in `google-apps-script/`; Firebase rules are in
`firebase-database.rules.json`.

Deploy as a static site with no build command and no output directory. Vercel
serves the root directly. GitHub Pages may use branch `main` and folder `/`.

See [ANTIGRAVITY-IMPLEMENTATION-PLAN.md](ANTIGRAVITY-IMPLEMENTATION-PLAN.md) for the
complete Firebase, Apps Script, Google Drive, GitHub, Vercel, and verification runbook.
