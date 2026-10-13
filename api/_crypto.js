import crypto from 'crypto';

// AES-256-GCM for banking details at rest. BANK_KEY is 64 hex chars (32 bytes)
// and lives only in Vercel env vars. Stored format: base64(iv | authTag | ciphertext).

const key = () => {
  const k = Buffer.from(process.env.BANK_KEY || '', 'hex');
  if (k.length !== 32) throw new Error('BANK_KEY missing or malformed');
  return k;
};

export function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

export function decrypt(b64) {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString('utf8'));
}
