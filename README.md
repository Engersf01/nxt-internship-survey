# 🎮 Mission Debrief — nxT Innovation Lab internship survey

A gamified post-internship survey for the **nxT Innovation Lab** 6-month program
(3 months learning phase → 3 months paid phase → part-time / full-time opportunity).

**Live:** https://survey.impactos.nxtlab.app

## What it does

Interns complete a 5-chapter "mission debrief" (~7 minutes):

| Chapter | What it captures |
|---|---|
| 🎬 Player setup | Name (optional / anonymous mode), email, avatar, cohort |
| 🗺️ Journey map | Areas rotated through (Education first), favorite area, mission statement |
| ⚔️ The two phases | Emoji ratings for Phase 1 (unpaid), Phase 2 (paid), and overall experience |
| 🎤 Show & tell | Skills gained, project showcase with demo links, day-1-vs-today skill sliders |
| 💥 Impact report | Biggest contribution, metrics, beneficiaries, memorable moment |
| 🔮 What's next | Part-time/full-time interest, NPS, keep/fix feedback, advice, testimonial + consent |

Gamification: XP per answer, 6 levels (Explorer → nxT Legend), 6 badges, an
"intern archetype" computed from their answers, confetti, autosave/resume via
localStorage, fully mobile-friendly.

## Architecture

- `index.html` — the whole survey app (vanilla JS, no build step)
- `api/submit.js` — Vercel serverless function; stores each response as JSON in Vercel Blob (`responses/`)
- `api/responses.js` — admin endpoint to review responses

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
