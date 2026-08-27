# CEC Esports Intramurals 2026 — website

Deployment-ready static site for the **CEC Esports Intramurals 2026** (Mobile Legends: Bang Bang), organized by CEC Blue Dragon Esports at Cebu Eastern College, Incorporated. Flat file structure — every page is a `.html` file at this folder's root.

## Structure

```
docs/
├── index.html                      # Home
├── tournament.html                 # Tournament overview + full schedule
├── teams.html                      # Team directory (division switcher, live from the API)
├── bracket.html                    # Bracket structure (division switcher)
├── standings.html                  # Standings (division switcher)
├── rules.html                      # Rules & Guidelines
├── dashboard.html                  # Registered captain's view
├── register-team.html              # Registration step 1 — team info (Division + Department)
├── register-roster.html            # Registration step 2 — roster
├── register-verification.html      # Registration step 3 — player ID verification
├── register-review.html            # Registration step 4 — review & submit
├── register-success.html           # Registration confirmation
├── admin.html                      # Admin overview (live registration stats)
├── admin-registrations.html        # Registration management (list / filter / approve)
├── admin-verification.html         # Per-team roster verification (?teamId=TEAM-0001)
├── admin-bracket-builder.html      # Bracket configuration
├── admin-officiating.html          # Officiating console
├── admin-checkin.html              # Match check-in
├── admin-match-report.html         # Official match result submission
├── admin-disputes.html             # Dispute queue
├── admin-dispute-review.html       # Single dispute resolution
├── assets/js/registration-api.js   # Shared Apps Script API client (set the Web App URL here)
├── .nojekyll
├── 404.html
└── README.md
```

## The three divisions

- **Student Division — Men's (College only):** IT (8), HTM (8), CTE (4), CRIM (4) — 24 teams.
- **Student Division — Women's (College only):** IT, HTM, CTE, CRIM — 4 teams each, 16 total.
- **Faculty Exhibition Game (non-competitive):** IT, CTE-A, CTE-B, HM, TM, CRIM, SHS, JHS — 8 teams.

Each department runs its own single-elimination bracket (Best-of-1) on its match day; the four
department champions meet on Grand Finals Day, October 2, 2026. Semifinals are Best-of-3, finals
and grand finals are Best-of-5. All matches are online.

## Registration data

`register-team.html` collects a **Division** and a **Department**; they are stored together in the
existing `Course` field of the Google Sheet as `"<Division> — <Department>"` (e.g. `Men's — IT`).
The team directory, admin list and verification pages read that field back. No Apps Script change
was needed for this.

## Deploying

- **Vercel:** set the project root / output directory to `docs`, or deploy this folder directly.
  `404.html` is served automatically as the not-found page.
- **GitHub Pages:** Settings → Pages → Deploy from a branch → folder `/docs`.
