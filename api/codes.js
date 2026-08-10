import { put, list } from '@vercel/blob';

// Admin endpoint to manage access codes.
//   GET /api/codes?key=ADMIN_KEY&count=10   → generate 10 fresh codes
//   GET /api/codes?key=ADMIN_KEY&action=list → list all codes + used status
const CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/I lookalikes

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let s = '';
  for (const b of bytes) s += CHARS[b % CHARS.length];
  return `NXT-${s.slice(0, 4)}-${s.slice(4)}`;
}

export default async function handler(req, res) {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    if (req.query.action === 'list') {
      const all = [];
      let cursor;
      do {
        const page = await list({ prefix: 'codes/', cursor, limit: 100 });
        all.push(...page.blobs);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      const codes = await Promise.all(
        all.map(async (b) => {
          try {
            return await (await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' })).json();
          } catch {
            return { code: b.pathname, error: 'unreadable' };
          }
        })
      );
      codes.sort((a, b) => (a.created || '').localeCompare(b.created || ''));
      return res.status(200).json({
        total: codes.length,
        unused: codes.filter((c) => !c.used).length,
        codes,
      });
    }

    const count = Math.min(parseInt(req.query.count, 10) || 10, 100);
    const created = new Date().toISOString();
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = generateCode();
      const norm = code.replace(/-/g, '');
      await put(`codes/${norm}.json`, JSON.stringify({ code, used: false, created }), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 60,
      });
      codes.push(code);
    }
    return res.status(200).json({ generated: codes.length, codes });
  } catch (e) {
    console.error('codes error', e);
    return res.status(500).json({ error: 'Code management failed' });
  }
}
