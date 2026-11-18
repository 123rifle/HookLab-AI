// IndexedDB wrapper: hooks, perf records, key-value (profile, folders). Nothing leaves the browser.
let _db;
const open = () => (_db ??= new Promise((res, rej) => {
  if (!window.indexedDB) return rej(new Error('Browser storage unavailable'));
  const r = indexedDB.open('hooklab', 1);
  r.onupgradeneeded = () => ['hooks', 'perf', 'kv'].forEach(s => r.result.createObjectStore(s, { keyPath: s === 'kv' ? 'k' : 'id' }));
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const tx = async (s, m, f) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(s, m); const q = f(t.objectStore(s)); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
export const all = s => tx(s, 'readonly', o => o.getAll());
export const put = async (s, v) => { const r = await tx(s, 'readwrite', o => o.put(v)); window.dispatchEvent(new CustomEvent('hl-saved')); return r; };
export const del = (s, k) => tx(s, 'readwrite', o => o.delete(k));
export const clear = s => tx(s, 'readwrite', o => o.clear());
export const getKV = async k => (await tx('kv', 'readonly', o => o.get(k)))?.v;
export const setKV = (k, v) => put('kv', { k, v });
export async function exportAll() {
  return { app: 'hooklab', version: 1, exported: new Date().toISOString(), hooks: await all('hooks'), perf: await all('perf'), profile: (await getKV('profile')) || null, folders: (await getKV('folders')) || [] };
}
export function validateBackup(o) {
  const ok = o && o.app === 'hooklab' && o.version === 1 && Array.isArray(o.hooks) && Array.isArray(o.perf) &&
    o.hooks.every(h => h && typeof h.id === 'string' && typeof h.text === 'string') &&
    o.perf.every(p => p && typeof p.id === 'string') && (o.folders === undefined || Array.isArray(o.folders));
  if (!ok) throw new Error('Backup file is invalid or from an unsupported version.');
}
export async function importAll(o) {
  validateBackup(o);
  await clear('hooks'); await clear('perf');
  for (const h of o.hooks) await put('hooks', h);
  for (const p of o.perf) await put('perf', p);
  await setKV('profile', o.profile || null); await setKV('folders', o.folders || []);
}
export const wipe = async () => { await clear('hooks'); await clear('perf'); await clear('kv'); };
