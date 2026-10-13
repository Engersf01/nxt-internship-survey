import { put, list } from '@vercel/blob';
import crypto from 'crypto';
import { isAuthed } from './_auth.js';
import { encrypt, decrypt } from './_crypto.js';

// Direct-deposit detail requests.
//   POST {action:'create', participantName}      → admin: new request + private link id
//   GET  ?id=<id>                                → safe summary only (never account numbers)
//   POST {action:'submit', id, details}          → participant: one-time submission; numbers
//                                                  are AES-256-GCM encrypted before storage
//   GET  ?list=1                                 → admin: list summaries
//   GET  ?id=<id>&reveal=1                       → admin: decrypted details (for payment setup)

const PATH = (id) => `bank-requests/${id}.json`;
const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;

// ABA routing checksum: 3(d1+d4+d7) + 7(d2+d5+d8) + (d3+d6+d9) ≡ 0 (mod 10)
function validRouting(r) {
  if (!/^\d{9}$/.test(r)) return false;
  const d = r.split('').map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}

async function loadReq(id) {
  if (!/^[a-f0-9]{24,64}$/.test(id)) return null;
  const { blobs } = await list({ prefix: PATH(id) });
  const b = blobs.find((x) => x.pathname === PATH(id));
  if (!b) return null;
  const r = await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return r.json();
}
async function saveReq(id, data) {
  await put(PATH(id), JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}
const summary = (d) => ({
  id: d.id,
  participantName: d.participantName,
  status: d.status,
  createdAt: d.createdAt,
  submittedAt: d.submittedAt || null,
  bankName: d.public?.bankName || null,
  accountType: d.public?.accountType || null,
  accountHolder: d.public?.accountHolder || null,
  last4: d.public?.last4 || null,
});

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (req.query.list !== undefined) {
        if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
        const all = [];
        let cursor;
        do {
          const page = await list({ prefix: 'bank-requests/', cursor, limit: 100 });
          all.push(...page.blobs);
          cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
        const items = await Promise.all(
          all.map(async (b) => {
            try {
              return summary(await (await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' })).json());
            } catch {
              return null;
            }
          })
        );
        return res.status(200).json({
          requests: items.filter(Boolean).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
        });
      }
      const data = await loadReq(String(req.query.id || ''));
      if (!data) return res.status(404).json({ error: 'Request not found' });
      if (req.query.reveal !== undefined) {
        if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
        if (data.status !== 'submitted') return res.status(409).json({ error: 'Not submitted yet' });
        const sensitive = decrypt(data.enc);
        data.audit = [...(data.audit || []), { type: 'revealed', at: new Date().toISOString(), ip: clientIp(req) }];
        await saveReq(data.id, data);
        return res.status(200).json({ ...summary(data), ...sensitive });
      }
      return res.status(200).json(summary(data));
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = req.body || {};

    if (body.action === 'create') {
      if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
      if (!body.participantName) return res.status(400).json({ error: 'Participant name required' });
      const id = crypto.randomBytes(16).toString('hex');
      const now = new Date().toISOString();
      const data = {
        id,
        participantName: String(body.participantName).slice(0, 120),
        status: 'pending',
        createdAt: now,
        audit: [{ type: 'created', at: now, ip: clientIp(req) }],
      };
      await saveReq(id, data);
      return res.status(200).json({ ok: true, id });
    }

    if (body.action === 'submit') {
      const data = await loadReq(String(body.id || ''));
      if (!data) return res.status(404).json({ error: 'Request not found' });
      if (data.status === 'submitted') {
        return res.status(409).json({ error: 'Bank details were already submitted for this request. Contact nxT if you need to update them.' });
      }
      const d = body.details || {};
      const accountHolder = String(d.accountHolder || '').trim();
      const bankName = String(d.bankName || '').trim();
      const accountType = d.accountType === 'savings' ? 'savings' : d.accountType === 'checking' ? 'checking' : null;
      const routing = String(d.routing || '').replace(/\D/g, '');
      const account = String(d.account || '').replace(/\D/g, '');
      if (!accountHolder || !bankName || !accountType) return res.status(400).json({ error: 'Account holder, bank name, and account type are required' });
      if (!validRouting(routing)) return res.status(400).json({ error: 'Routing number failed validation — it must be the 9-digit ABA number' });
      if (!/^\d{4,17}$/.test(account)) return res.status(400).json({ error: 'Account number must be 4–17 digits' });
      const now = new Date().toISOString();
      data.enc = encrypt({ routing, account });
      data.public = { accountHolder, bankName, accountType, last4: account.slice(-4) };
      data.status = 'submitted';
      data.submittedAt = now;
      data.achConsent = { agreed: true, at: now };
      data.audit = [...(data.audit || []), { type: 'submitted', at: now, ip: clientIp(req) }];
      await saveReq(data.id, data);
      return res.status(200).json({ ok: true, ...summary(data) });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('bank error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
