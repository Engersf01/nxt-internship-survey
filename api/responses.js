import { list } from '@vercel/blob';
import { isAuthed } from './_auth.js';

// Admin endpoint: GET /api/responses  (auth: Bearer token, ?token=, or ?key=ADMIN_KEY)
// Optional: &format=csv
export default async function handler(req, res) {
  if (!isAuthed(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const all = [];
    let cursor;
    do {
      const page = await list({ prefix: 'responses/', cursor, limit: 100 });
      all.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    const responses = await Promise.all(
      all.map(async (b) => {
        try {
          const r = await fetch(b.url);
          return await r.json();
        } catch {
          return { _error: 'unreadable', url: b.url };
        }
      })
    );
    responses.sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || ''));

    // ?type=intern|leader filters; CSV defaults to intern, JSON defaults to all
    const type = req.query.type;
    const ofType = (t) => responses.filter((r) => (r.formType || 'intern') === t);

    if (req.query.format === 'csv') {
      const isLeader = type === 'leader';
      const rows0 = ofType(isLeader ? 'leader' : 'intern');
      const cols = isLeader
        ? ['submittedAt','month','phase','leaderName','internName','area','hat','areas','mission','stepForward','standout','impressed','skillsGrown','growthFocus','growthNotes','keep','fix','paidRecommendation','finalRecommendation','anotherIntern','nextFocus','supportNeeded','nps','xp']
        : ['submittedAt','month','phase','name','email','cohort','areas','favoriteArea','mission','surprise','skills','unlocked','contribution','metric','beneficiary','moment','continueInterest','nps','keep','fix','wantMore','nextGoal','transitionNotes','remoteHard','remoteImprove','advice','testimonial','testimonialOk','archetype','xp'];
      const ratingKeys = [...new Set(rows0.flatMap((r) => Object.keys(r.ratings || {})))];
      const progKeys = isLeader ? [...new Set(rows0.flatMap((r) => Object.keys(r.programRatings || {})))] : [];
      const esc = (v) => {
        if (v == null) return '';
        const s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = [...cols, ...ratingKeys.map((k) => 'rating_' + k), ...progKeys.map((k) => 'prog_' + k), ...(isLeader ? [] : ['projects'])].join(',');
      const rows = rows0.map((r) =>
        [
          ...cols.map((c) => esc(r[c])),
          ...ratingKeys.map((k) => esc((r.ratings || {})[k])),
          ...progKeys.map((k) => esc((r.programRatings || {})[k])),
          ...(isLeader ? [] : [esc((r.projects || []).map((p) => `${p.title || ''} (${p.link || 'no link'})`).join(' | '))]),
        ].join(',')
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="nxt-${isLeader ? 'leader' : 'internship'}-responses.csv"`);
      return res.status(200).send([header, ...rows].join('\n'));
    }

    const out = type ? ofType(type) : responses;
    return res.status(200).json({ count: out.length, responses: out });
  } catch (e) {
    console.error('responses error', e);
    return res.status(500).json({ error: 'Failed to load responses' });
  }
}
