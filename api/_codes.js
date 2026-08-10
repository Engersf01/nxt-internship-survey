import { list } from '@vercel/blob';

// Shared helpers for the access-code system.
//
// State is tracked by blob EXISTENCE, not blob content, because content
// reads go through a CDN that can serve stale data for up to a minute:
//   codes/<NORMALIZED>.json  → the code was issued
//   used/<NORMALIZED>.json   → the code was consumed
// A code is valid iff it exists in codes/ and not in used/. The list API
// is metadata-backed and reflects new blobs immediately.
//
// Codes are single-use and never stored alongside survey responses, so
// submissions stay anonymous.

export const normalize = (c) => (c || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

async function exists(pathname) {
  const { blobs } = await list({ prefix: pathname });
  return blobs.some((b) => b.pathname === pathname);
}

export async function codeState(code) {
  const [issued, used] = await Promise.all([
    exists(`codes/${code}.json`),
    exists(`used/${code}.json`),
  ]);
  return { issued, used };
}
