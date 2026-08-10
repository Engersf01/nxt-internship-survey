import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' });
    }
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
