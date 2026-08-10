import crypto from 'crypto';

// Session tokens: HMAC-signed expiry stamps, keyed off ADMIN_KEY.
// Stateless — nothing to store or clean up; tokens die at their expiry.

const secret = () => process.env.ADMIN_KEY || '';

export function issueToken(hours = 12) {
  const exp = Date.now() + hours * 3600 * 1000;
  const sig = crypto.createHmac('sha256', secret()).update(String(exp)).digest('hex');
  return `${exp}.${sig}`;
}

export function checkToken(t) {
  if (!t || !secret()) return false;
  const [exp, sig] = String(t).split('.');
  if (!exp || !sig || Date.now() > Number(exp)) return false;
  const good = crypto.createHmac('sha256', secret()).update(String(exp)).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
  } catch {
    return false;
  }
}

// Accepts: legacy ?key=ADMIN_KEY, Authorization: Bearer <token>, or ?token=
// (the query form exists so CSV download links can carry auth).
export function isAuthed(req) {
  const key = process.env.ADMIN_KEY;
  if (key && req.query.key === key) return true;
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (checkToken(bearer)) return true;
  if (checkToken(req.query.token)) return true;
  return false;
}

export function timingSafeEq(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
