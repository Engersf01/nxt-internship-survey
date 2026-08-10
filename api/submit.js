import { put } from '@vercel/blob';
import { normalize, codeState } from './_codes.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // --- access-code gate: proves "real intern", stays anonymous ---
    const code = normalize(data.accessCode);
    if (!code) {
      return res.status(403).json({ error: 'Access code required' });
    }
    const state = await codeState(code);
    if (!state.issued) {
      return res.status(403).json({ error: 'Invalid access code' });
    }
    if (state.used) {
      return res.status(403).json({ error: 'This access code was already used' });
    }

    // Consume first (fail-closed), by existence marker — see api/_codes.js.
    await put(`used/${code}.json`, JSON.stringify({ usedAt: new Date().toISOString() }), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // The code is intentionally NOT stored with the response — codes prove
    // eligibility without linking a submission back to a person.
    delete data.accessCode;

    const raw = JSON.stringify({ ...data, submittedAt: new Date().toISOString() }, null, 2);
    if (raw.length > 200_000) {
      return res.status(413).json({ error: 'Payload too large' });
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await put(`responses/${id}.json`, raw, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: true,
    });

    return res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error('submit error', e);
    return res.status(500).json({ error: 'Storage error' });
  }
}
