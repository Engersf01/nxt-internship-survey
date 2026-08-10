# 🎮 Mission Debrief — nxT Innovation Lab internship survey

A gamified post-internship survey for the **nxT Innovation Lab** 6-month program
(3 months learning phase → 3 months paid phase → part-time / full-time opportunity).

**Live:** https://survey.impactos.nxtlab.app

## What it does

Interns complete a 5-chapter "mission debrief" (~7 minutes) **after every month**
of the program. They pick which month they just finished (level-select style),
and the questions adapt to where they are in the journey:

| Chapter | What it captures |
|---|---|
| 🎬 Player setup | **Month just completed (1–6)**, name (optional / anonymous mode), email, avatar, cohort |
| 🗺️ Journey map | Areas worked in (Education first), favorite area, mission statement |
| ⚔️ Month check-in | Face ratings tuned per month — onboarding (m1), learning/mentorship (m1–3), unpaid-phase fairness + paid-readiness (m3), paid transition (m4), responsibility/feedback/growth (m4–6) — plus overall culture/tools/communication/balance |
| 🎤 Show & tell | Skills gained, project showcase with demo links, day-1-vs-today skill sliders |
| 💥 Impact report | Biggest contribution, metrics, beneficiaries, memorable moment |
| 🔮 What's next | Months 1–5: "more of next month" + next-month goal. Month 6: part-time/full-time interest, advice, testimonial + consent. NPS + keep/fix every month |

Each submission is stamped with `month` and `phase` (learning/paid), so you can
track how ratings evolve across the cohort month over month.

Gamification: XP per answer, 6 levels (Explorer → nxT Legend), 6 badges, an
"intern archetype" computed from their answers, confetti, autosave/resume via
localStorage, fully mobile-friendly.

## Architecture

- `index.html` — the whole survey app (vanilla JS, no build step)
- `api/submit.js` — Vercel serverless function; stores each response as JSON in Vercel Blob (`responses/`)
- `api/responses.js` — admin endpoint to review responses

## Access codes (anti-abuse, anonymity-preserving)

Submissions require a **single-use access code** so bots and outsiders can't
abuse the survey, while interns can still answer anonymously:

- Codes look like `NXT-XXXX-XXXX` and are handed out by the coordinator
  (one per intern per month).
- The code is verified when the intern starts, and consumed on submit.
- The code is **never stored with the response** — it proves "real intern"
  without linking answers to a person.

Manage codes (admin):

```
# generate a fresh batch (default 10, max 100)
https://survey.impactos.nxtlab.app/api/codes?key=YOUR_ADMIN_KEY&count=12

# see all codes and their used/unused status
https://survey.impactos.nxtlab.app/api/codes?key=YOUR_ADMIN_KEY&action=list
```

## Viewing responses (admin)

```
https://survey.impactos.nxtlab.app/api/responses?key=YOUR_ADMIN_KEY
https://survey.impactos.nxtlab.app/api/responses?key=YOUR_ADMIN_KEY&format=csv
```

`ADMIN_KEY` is set as a Vercel environment variable on the project.
Responses are stored in Vercel Blob with unguessable URLs; only the admin
endpoint can enumerate them.

## Deploy

Connected to Vercel (project `nxt-internship-survey`). Push to `main` to deploy,
or:

```
vercel --prod
```
