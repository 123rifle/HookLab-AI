import { getKV } from './db.js';
const KEYS = ['name', 'niche', 'audience', 'platform', 'language', 'tone', 'hookLength', 'avoid', 'style', 'samples', 'instructions'];
let busy = false;
// Sends only the creator-profile fields the server prompt uses.
export async function ai(op, payload) {
  if (busy) throw new Error('A request is already in progress.');
  busy = true;
  try {
    let profile = null; try { profile = await getKV('profile'); } catch {}
    if (profile) profile = Object.fromEntries(KEYS.filter(k => profile[k]).map(k => [k, String(profile[k]).slice(0, 600)]));
    let r;
    try { r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, ...payload, profile }), signal: AbortSignal.timeout(35000) }); }
    catch { throw new Error('Unable to connect to the AI service. Check your connection and retry.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'AI request failed.');
    return j;
  } finally { busy = false; }
}
