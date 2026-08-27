# CEC Esports Intramurals 2026 — deployment & backend instructions

_Written 2026-08-27, after the whole site was rewritten from sample data to the real
CEC Esports Intramurals 2026 event._

There are **two separate things** to do. The site (HTML) and the backend (Google Sheet API)
are independent — you can ship the site now and fix the backend after.

1. **Publish the updated site** so it shows on `cec-esports.vercel.app` → Part 1
2. **Fix the registration backend** so live data (team list, admin counts) actually loads → Part 2

---

## What changed in this update

- Every page now uses the **real event**: 3 divisions (Student Men's 24 teams, Student
  Women's 16, Faculty Exhibition 8), the real 6-session schedule (Sep 5 → Grand Finals
  Day **Oct 2**), registration closes **Sep 1**, all matches online.
- **Teams / Bracket / Standings** each got a **Men's / Women's / Faculty switcher**.
- **Rules** page rebuilt from the *Rules & Guidelines (Update)* document (sections I–V).
- **Registration** now asks for **Division + Department** (stored together in the existing
  `Course` column of the sheet — no backend change needed).
- Removed all glassmorphism (cards are opaque so the moving background can't show through),
  removed dead icons/filters, added a mobile menu, fixed a bug that rendered some page
  titles at ~11px.
- All the old placeholder images and US-college data are gone.

**One thing to confirm:** the *Schedule* doc and the *Rules (Update)* doc disagree on the
**Women's** Grand Finals Day pairings. The site uses the *Rules (Update)* version
(SF1 **HTM vs CRIM**, SF2 **IT vs CTE**). If the *Schedule* is right (SF1 IT vs HTM,
SF2 CTE vs CRIM — same as Men's), tell me and I'll flip it in `bracket.html` + `rules.html`.

---

## Part 1 — Publish the site to Vercel

### The situation

- Vercel serves the **root** of `github.com/itcec/esports` (branch `main`).
- On GitHub, `main` currently has all the site's `.html` files **at the repo root**
  (someone uploaded them there and deleted the rest — `docs/`, `google-apps-script/`,
  `assets/`, the Architecture docs).
- **`assets/js/registration-api.js` is missing** from that upload, so the registration
  wizard is already broken on the live site (its `<script src="assets/js/registration-api.js">`
  returns 404). This has to be re-added.
- My updated files are in **`docs/`** in the dev repo — a place Vercel doesn't serve.

So: the updated files have to reach the **repo root** (without the `docs/` prefix), and
`assets/js/registration-api.js` has to come back.

### A ready-to-upload copy is already prepared

```
C:\Users\Hi\Documents\EsportsWebsite\_deploy-flat\
```

That folder = exactly what the repo root should contain: 24 files + the `assets\js\`
sub-folder. Every link inside is a plain relative path, so it works at the root.

Contents:

```
_deploy-flat\
├── index.html          tournament.html     teams.html
├── bracket.html         standings.html      rules.html        dashboard.html
├── register-team.html   register-roster.html
├── register-verification.html   register-review.html   register-success.html
├── admin.html           admin-registrations.html   admin-verification.html
├── admin-bracket-builder.html   admin-officiating.html   admin-checkin.html
├── admin-match-report.html      admin-disputes.html      admin-dispute-review.html
├── 404.html             README.md           .nojekyll
└── assets\js\registration-api.js
```

### Option A — quickest (keeps Vercel as-is, uploads flat files)

1. Go to `https://github.com/itcec/esports` and make sure the branch selector says **`main`**.
2. Click **Add file → Upload files**.
3. In File Explorer, open `C:\Users\Hi\Documents\EsportsWebsite\_deploy-flat`.
   Select **everything inside** it (all the files **and** the `assets` folder) and drag
   it into the GitHub drop zone. GitHub keeps the `assets/js/` sub-folder structure.
4. Commit message: `Update site to CEC Esports Intramurals 2026`. Commit directly to `main`.
5. Vercel picks it up automatically. Watch the deploy at `vercel.com` → your project →
   Deployments. ~1 minute. Then hard-refresh `cec-esports.vercel.app`.

> `.nojekyll` may not show in the drag (Explorer hides dotfiles). It doesn't matter on
> Vercel — it's only needed for GitHub Pages. Skip it if it's a hassle.

### Option B — recommended (so future updates are one step, not this dance)

Point Vercel at the `docs/` folder instead of the root. Then you never flatten files again.

1. **Vercel** → your project → **Settings → Build and Deployment → Root Directory** →
   set it to `docs` → Save.
2. On GitHub `itcec/esports` `main`: **Add file → Upload files**, and this time drag the
   **whole `docs` folder** from `C:\Users\Hi\Documents\EsportsWebsite\.claude\worktrees\cec-esports-intramurals-data-ebf171\docs`
   (or from the main checkout once it's updated). GitHub will create `docs/…` in the repo.
   Commit to `main`.
3. Vercel now builds from `docs/` and serves the new site.
4. (Optional tidy-up, later) The stale `.html` files still sitting at the repo root are
   now ignored — you can delete them from GitHub (select → delete → commit) whenever.

After Option B, updating the site = edit files in `docs/`, `git add . && git commit && git push`
(or upload to `docs/` on GitHub). Vercel deploys.

### Option C — for whoever handles git

The dev repo (`C:\Users\Hi\Documents\EsportsWebsite`) and `origin/main` have diverged
(local still has the nested layout; `origin/main` is flattened). Cleanest fix: on a branch
off `origin/main`, restore `docs/` + `assets/` + `google-apps-script/`, remove the root
`.html` files, set Vercel Root Directory = `docs`, and fast-forward `main`. The changes for
this pass are on branch **`claude/cec-esports-intramurals-data-ebf171`** (23 files under
`docs/`, not yet committed). Ask me to prepare the commits if you want this route.

---

## Part 2 — Fix the registration backend (Google Apps Script)

Right now the live team list (Teams page) and the admin registration counts show empty
"placeholder" states. That's **not a code bug** — the Google Apps Script Web App is
deployed with restricted access, so every request gets redirected to a Google login page
instead of returning data.

Test it yourself:

```bash
curl -i "https://script.google.com/macros/s/AKfycbzmCnFku4qJ08eF6dK0AfHYK8zrVT7Zob1FCa5HzEEHcN7CLkaP_uJ5rOKHQuRairY4/exec?action=listRegistrations"
```

Today it returns `302 Found → https://accounts.google.com/ServiceLogin`. You want
`{"success":true,"data":[...]}`.

### Fix (about 10 minutes, no coding)

You need the Google account that owns the tournament Sheet.

1. Open the Sheet → **Extensions → Apps Script**.
2. Confirm the code matches this repo's `google-apps-script/Code.gs`. If you paste a new
   version in, run the `setupSheets` function once (function dropdown → Run) to (re)create
   the `TEAMS` / `PLAYERS` tabs.
3. **Deploy → Manage deployments** → click the pencil (✏️) on the active deployment.
4. Set:
   - **Execute as:** `Me`
   - **Who has access:** **`Anyone`**  ← this is the actual fix
5. Change **Version** to **New version** → **Deploy** → approve the auth prompt.
6. Copy the Web App URL (`https://script.google.com/macros/s/…/exec`). If it's different
   from the one above, paste it into `assets/js/registration-api.js` →
   `REGISTRATION_API_URL`, and re-upload that file (Part 1).
7. Re-run the `curl` above — you should now get JSON, not a login redirect.

### Before real teams register — set an admin key

`Who has access: Anyone` also means anyone with the URL can call the approve/reject
endpoints. Add a stopgap key:

1. Apps Script editor → **Project Settings → Script Properties → Add script property**.
2. Key: `ADMIN_KEY`  ·  Value: a long random string (make one up).
3. In `assets/js/registration-api.js`, set the `ADMIN_KEY` constant to the **same** string,
   and re-upload it.

This is a stopgap, not real security (it's documented as such in `Code.gs`). A proper login
system is a separate, bigger job.

---

## Part 3 — Check the live site

After Parts 1 and 2:

- [ ] `cec-esports.vercel.app` — home page shows "CEC Esports Intramurals 2026", real dates.
- [ ] Tournament page — full 6-session schedule, Grand Finals Day pairings for both divisions.
- [ ] Teams / Bracket / Standings — the Men's / Women's / Faculty switcher changes content.
- [ ] Rules — sections I–V, matches the *Rules & Guidelines (Update)* document.
- [ ] `register-team.html` — Division dropdown → Department dropdown fills in. Fill it out,
      step through to "Review Registration". If Part 2 is done, "Submit" writes a row to
      the Sheet and you land on the success page with a `TEAM-000x` ID.
- [ ] `admin.html` — "Teams registered / Pending / Approved" counts show numbers (Part 2),
      or a clear "API not reachable" note if not.
- [ ] On a phone — hamburger menu opens, nothing scrolls sideways.
- [ ] `cec-esports.vercel.app/nonsense` — shows the custom 404 page.

---

## Reference — the data the site now uses

**Event:** CEC Esports Intramurals 2026 · Mobile Legends: Bang Bang only · organized by
CEC Blue Dragon Esports · Cebu Eastern College, Incorporated · **all matches online**,
streamed from the Computer Laboratory Annex Building · **registration closes September 1,
2026** · roster = 5 starters + up to 2 subs · coordinator **Mr. Jade Louis S. Cabucos**.

**Divisions**

| Division | Departments (teams) | Total |
|---|---|---|
| Student — Men's (College only) | IT (8), HTM (8), CTE (4), CRIM (4) | 24 |
| Student — Women's (College only) | IT, HTM, CTE, CRIM — 4 each | 16 |
| Faculty Exhibition (not in standings) | IT, CTE-A, CTE-B, HM, TM, CRIM, SHS, JHS | 8 |

**Schedule** — all sessions 2:00–5:00 PM

| Date | Division | Session |
|---|---|---|
| Sep 5 (Sat) | Student M + W | IT department brackets → IT champion |
| Sep 11 (Fri) | Faculty | Quarterfinals (BO1, 4 matches) |
| Sep 12 (Sat) | Student M + W | HTM department brackets → HTM champion |
| Sep 18 (Fri) | Faculty | Semifinals (BO3) + 3rd/4th (BO3) + Final (BO5) |
| Sep 19 (Sat) | Student M + W | CTE + CRIM department brackets → CTE & CRIM champions |
| **Oct 2 (Fri)** | Student M + W | **Grand Finals Day** — SF1, SF2, 3rd/4th, Grand Final |

**Format:** department brackets = single-elimination, Best-of-1. Semifinals & 3rd/4th =
Best-of-3. Finals & Grand Final = Best-of-5. Draft Pick, custom lobby.

**Grand Finals Day pairings**

| | Semifinal 1 | Semifinal 2 |
|---|---|---|
| Men's | IT vs HTM | CTE vs CRIM |
| Women's | HTM vs CRIM | IT vs CTE _(← from the Rules Update; the Schedule doc says IT vs HTM / CTE vs CRIM)_ |

---

## File map — dev repo `docs/` ↔ live site root

Same filename in both places; the live site just drops the `docs/` prefix.

```
docs/index.html                  →  index.html          (cec-esports.vercel.app/)
docs/tournament.html             →  tournament.html
docs/teams.html                  →  teams.html
docs/bracket.html                →  bracket.html
docs/standings.html              →  standings.html
docs/rules.html                  →  rules.html
docs/dashboard.html              →  dashboard.html
docs/register-team.html          →  register-team.html
docs/register-roster.html        →  register-roster.html
docs/register-verification.html  →  register-verification.html
docs/register-review.html        →  register-review.html
docs/register-success.html       →  register-success.html
docs/admin.html                  →  admin.html
docs/admin-registrations.html    →  admin-registrations.html
docs/admin-verification.html     →  admin-verification.html
docs/admin-bracket-builder.html  →  admin-bracket-builder.html
docs/admin-officiating.html      →  admin-officiating.html
docs/admin-checkin.html          →  admin-checkin.html
docs/admin-match-report.html     →  admin-match-report.html
docs/admin-disputes.html         →  admin-disputes.html
docs/admin-dispute-review.html   →  admin-dispute-review.html
docs/404.html                    →  404.html
docs/README.md                   →  README.md
docs/assets/js/registration-api.js  →  assets/js/registration-api.js   ← missing on live, re-add
```
