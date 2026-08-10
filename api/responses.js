import { list } from '@vercel/blob';

// Admin endpoint: GET /api/responses?key=ADMIN_KEY[&format=csv]
export default async function handler(req, res) {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) {
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

    if (req.query.format === 'csv') {
      const cols = ['submittedAt','name','email','cohort','areas','favoriteArea','mission','skills','unlocked','contribution','metric','beneficiary','moment','continueInterest','nps','keep','fix','advice','testimonial','testimonialOk','archetype','xp'];
      const ratingKeys = [...new Set(responses.flatMap((r) => Object.keys(r.ratings || {})))];
      const esc = (v) => {
        if (v == null) return '';
        const s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = [...cols, ...ratingKeys.map((k) => 'rating_' + k), 'projects'].join(',');
      const rows = responses.map((r) =>
        [
          ...cols.map((c) => esc(r[c])),
          ...ratingKeys.map((k) => esc((r.ratings || {})[k])),
          esc((r.projects || []).map((p) => `${p.title || ''} (${p.link || 'no link'})`).join(' | ')),
        ].join(',')
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="nxt-internship-responses.csv"');
      return res.status(200).send([header, ...rows].join('\n'));
    }

    return res.status(200).json({ count: responses.length, responses });
  } catch (e) {
    console.error('responses error', e);
    return res.status(500).json({ error: 'Failed to load responses' });
  }
}
