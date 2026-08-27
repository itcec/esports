# CEC Esports Tournament Portal — Frontend

Production frontend web application for the CEC Esports Tournament Platform.

## 🚀 Live GitHub Pages Deployment

To host this on GitHub Pages:
1. Go to repository **Settings → Pages**.
2. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/ (root)`
3. Click **Save**.

Your site will be available at: `https://itcec.github.io/esports/`

---

## 📁 Repository Structure (Flat Architecture)

```
.
├── index.html                      # Homepage & Public Landing Page
├── .nojekyll                       # Bypass Jekyll processing on GitHub Pages
├── 404.html                        # Custom 404 Signal Lost Page
├── assets/
│   └── js/
│       └── registration-api.js     # Shared Google Apps Script backend integration
│
├── tournament.html                 # Tournament overview & upcoming matches
├── teams.html                      # Public team directory
├── bracket.html                    # Public bracket viewer
├── standings.html                  # Public leaderboard & standings
├── rules.html                      # Official tournament rulebook
├── dashboard.html                  # Team Captain Dashboard
│
├── register-team.html              # Step 1: Team details & game selection
├── register-roster.html            # Step 2: Player roster entry
├── register-verification.html      # Step 3: Student ID verification upload
├── register-review.html            # Step 4: Submission review & agreement
├── register-success.html           # Step 5: Confirmation & Captain PIN display
│
├── admin.html                      # Admin dashboard
├── admin-registrations.html        # Team registration management & verification
├── admin-verification.html         # Student ID validation & approval queue
├── admin-bracket-builder.html      # Tournament bracket generator
├── admin-officiating.html          # Live match scoring & official console
├── admin-checkin.html              # Team check-in console
├── admin-match-report.html         # Result reporting
├── admin-disputes.html             # Dispute resolution management
└── admin-dispute-review.html       # Single dispute investigation
```

---

## ⚡ Backend Integration
The frontend connects automatically to the Google Apps Script Web App configured in `assets/js/registration-api.js`.
