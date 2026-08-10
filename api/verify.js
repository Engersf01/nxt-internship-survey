import { normalize, codeState } from './_codes.js';

// POST { code } → { valid: true|false }
// Pre-flight check so interns find out at the start, not after 7 minutes.
// The code is only consumed on actual submission.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const code = normalize(req.body?.code);
    if (!code || code.length < 8) return res.status(200).json({ valid: false });
    const state = await codeState(code);
    return res.status(200).json({ valid: state.issued && !state.used });
  } catch (e) {
    console.error('verify error', e);
    return res.status(500).json({ error: 'Verification failed' });
  }
}
