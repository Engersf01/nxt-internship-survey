import { list } from '@vercel/blob';

// Shared helpers for the access-code system.
// Codes live in Blob as codes/<NORMALIZED>.json → { code, used, created, usedAt }
// They are single-use and are never stored alongside survey responses,
// so submissions stay anonymous.

export const normalize = (c) => (c || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

export async function findCode(code) {
  const pathname = `codes/${code}.json`;
  const { blobs } = await list({ prefix: pathname });
  const blob = blobs.find((b) => b.pathname === pathname);
  if (!blob) return null;
  // cache-busting query param: blob CDN caches reads, and we overwrite on consume
  const r = await fetch(`${blob.url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return await r.json();
}
