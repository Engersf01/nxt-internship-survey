import { put, list } from '@vercel/blob';

// Admin endpoint to manage access codes.
//   GET /api/codes?key=ADMIN_KEY&count=10    → generate 10 fresh codes
//   GET /api/codes?key=ADMIN_KEY&action=list → list all codes + used status
const CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/I lookalikes

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let s = '';
  for (const b of bytes) s += CHARS[b % CHARS.length];
  return `NXT-${s.slice(0, 4)}-${s.slice(4)}`;
}

// codes/NXTABCD2345.json → NXT-ABCD-2345
const pretty = (pathname) => {
  const s = pathname.replace(/^(codes|used)\//, '').replace(/\.json$/, '');
  return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
};

async function listAll(prefix) {
  const all = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 100 });
    all.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return all;
}

export default async function handler(req, res) {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    if (req.query.action === 'list') {
      const [issued, used] = await Promise.all([listAll('codes/'), listAll('used/')]);
      const usedAt = new Map(used.map((b) => [pretty(b.pathname), b.uploadedAt]));
      const codes = issued
        .map((b) => {
          const code = pretty(b.pathname);
          return { code, created: b.uploadedAt, used: usedAt.has(code), usedAt: usedAt.get(code) || null };
        })
        .sort((a, b) => String(a.created).localeCompare(String(b.created)));
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
      await put(`codes/${norm}.json`, JSON.stringify({ code, created }), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      codes.push(code);
    }
    return res.status(200).json({ generated: codes.length, codes });
  } catch (e) {
    console.error('codes error', e);
    return res.status(500).json({ error: 'Code management failed' });
  }
}
