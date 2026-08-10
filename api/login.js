import { issueToken, timingSafeEq } from './_auth.js';

// POST { email, password } → { token }
// Credentials live ONLY in Vercel env vars (ADMIN_EMAIL / ADMIN_PASSWORD) —
// never in this repo or in client code.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const E = process.env.ADMIN_EMAIL;
  const P = process.env.ADMIN_PASSWORD;
  if (!E || !P) {
    return res.status(500).json({ error: 'Admin login is not configured' });
  }
  // flat delay: slows brute force, and keeps success/failure timing identical
  await new Promise((r) => setTimeout(r, 500));
  const { email, password } = req.body || {};
  const okEmail = timingSafeEq((email || '').trim().toLowerCase(), E.trim().toLowerCase());
  const okPass = timingSafeEq(password || '', P);
  if (!okEmail || !okPass) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  return res.status(200).json({ token: issueToken(12), expiresInHours: 12 });
}
