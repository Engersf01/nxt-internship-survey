import { put, list } from '@vercel/blob';
import crypto from 'crypto';
import { isAuthed } from './_auth.js';

// Internship payment agreements.
//   GET  ?id=<id>            → agreement JSON (the unguessable id is the access key)
//   GET  ?list=1             → admin: list all agreements (summary)
//   POST {action:'create', fields, nxt}          → admin: create + nxT signature
//   POST {action:'sign_participant', id, participant} → participant signs via their link
// Stored in Blob at agreements/<id>.json. Signatures are PNG data URLs.

const PATH = (id) => `agreements/${id}.json`;
const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;

async function loadAgreement(id) {
  if (!/^[a-f0-9]{24,64}$/.test(id)) return null;
  const { blobs } = await list({ prefix: PATH(id) });
  const b = blobs.find((x) => x.pathname === PATH(id));
  if (!b) return null;
  const r = await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return r.json();
}
async function saveAgreement(id, data) {
  await put(PATH(id), JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (req.query.list !== undefined) {
        if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
        const all = [];
        let cursor;
        do {
          const page = await list({ prefix: 'agreements/', cursor, limit: 100 });
          all.push(...page.blobs);
          cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
        const items = await Promise.all(
          all.map(async (b) => {
            try {
              const d = await (await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' })).json();
              return {
                id: d.id,
                participantName: d.fields?.participantName || d.participant?.fullName || null,
                status: d.status,
                createdAt: d.createdAt,
                completedAt: d.completedAt || null,
              };
            } catch {
              return null;
            }
          })
        );
        return res.status(200).json({
          agreements: items.filter(Boolean).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
        });
      }
      const data = await loadAgreement(String(req.query.id || ''));
      if (!data) return res.status(404).json({ error: 'Agreement not found' });
      return res.status(200).json(data);
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = req.body || {};

    if (body.action === 'create') {
      if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
      const n = body.nxt || {};
      if (!n.name || !n.signature) return res.status(400).json({ error: 'nxT representative name and signature are required' });
      if (String(n.signature).length > 300_000) return res.status(413).json({ error: 'Signature image too large' });
      const id = crypto.randomBytes(16).toString('hex');
      const now = new Date().toISOString();
      const data = {
        id,
        createdAt: now,
        status: 'awaiting_participant',
        fields: body.fields || {},
        nxt: { name: n.name, title: n.title || null, signature: n.signature, signedAt: now },
        participant: { fullName: null, address: null, email: null, signature: null, signedAt: null },
        audit: [{ type: 'created_and_signed_by_nxt', at: now, ip: clientIp(req) }],
      };
      await saveAgreement(id, data);
      return res.status(200).json({ ok: true, id });
    }

    if (body.action === 'sign_participant') {
      const data = await loadAgreement(String(body.id || ''));
      if (!data) return res.status(404).json({ error: 'Agreement not found' });
      if (data.participant?.signedAt) return res.status(409).json({ error: 'This agreement has already been signed by the participant' });
      const p = body.participant || {};
      if (!p.fullName || !p.signature) return res.status(400).json({ error: 'Full legal name and signature are required' });
      if (String(p.signature).length > 300_000) return res.status(413).json({ error: 'Signature image too large' });
      const now = new Date().toISOString();
      data.participant = {
        fullName: p.fullName,
        address: p.address || null,
        email: p.email || null,
        signature: p.signature,
        signedAt: now,
      };
      data.audit = [...(data.audit || []), { type: 'participant_signed', at: now, ip: clientIp(req) }];
      data.status = data.nxt?.signedAt ? 'completed' : 'awaiting_nxt';
      if (data.status === 'completed') data.completedAt = now;
      await saveAgreement(data.id, data);
      return res.status(200).json({ ok: true, status: data.status, agreement: data });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('agreement error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
