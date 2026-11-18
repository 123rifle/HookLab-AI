// HookLab AI gateway: Browser -> /api/ai -> Gemini. Stores nothing, logs no creative content.
const OPS = ['generate', 'analyze', 'rewrite', 'compare'];
const DIMS = ['clarity', 'curiosity', 'specificity', 'relevance', 'emotional', 'credibility', 'conciseness', 'originality'];
const W = { clarity: .15, curiosity: .2, specificity: .15, relevance: .15, emotional: .1, credibility: .1, conciseness: .1, originality: .05 };
const hits = new Map(); // best-effort only: per-instance memory, NOT a reliable global limiter
const E = (status, msg) => Object.assign(new Error(msg), { status });
const s = (v, max, req) => {
  if (v == null || v === '') { if (req) throw E(400, 'Missing required field.'); return ''; }
  if (typeof v !== 'string' || v.length > max) throw E(400, 'Invalid or too long input.');
  return v.trim();
};
const n = v => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const list = (v, m = 6) => (Array.isArray(v) ? v : []).filter(x => typeof x === 'string').slice(0, m);
const profileOf = p => {
  if (!p || typeof p !== 'object') return '';
  const k = ['name', 'niche', 'audience', 'platform', 'language', 'tone', 'hookLength', 'avoid', 'style', 'samples', 'instructions'];
  const o = {}; k.forEach(x => { const v = s(p[x], 600); if (v) o[x] = v; });
  return Object.keys(o).length ? 'Creator profile (respect it): ' + JSON.stringify(o) : '';
};
const BASE = `You are HookLab, an expert editor of the first seconds of creator content. Write natural, specific, human-sounding language. Never invent facts, statistics or claims about the creator's content. Avoid clickbait, exaggeration and generic AI phrases ("unlock", "game-changer", "in today's world"). Be platform and audience aware. Scores are editorial judgments (0-100), not predictions. Reply with JSON only.`;
const DIM_TXT = `Score each of these 0-100: ${DIMS.join(', ')}.`;
const SC = `{${DIMS.map(x => `"${x}":0`).join(',')}}`;

function build(op, b) {
  const prof = profileOf(b.profile);
  if (op === 'generate') {
    const count = Math.max(1, Math.min(8, parseInt(b.count, 10) || 5));
    const d = { topic: s(b.topic, 800, true), context: s(b.context, 4000), platform: s(b.platform, 40), format: s(b.format, 40), niche: s(b.niche, 100), audience: s(b.audience, 200), tone: s(b.tone, 40), psychology: s(b.psychology, 40), length: s(b.length, 40), instruction: s(b.instruction, 500) };
    return { count, sys: BASE, user: `Generate exactly ${count} genuinely different hooks (different structures, angles and mechanisms, not rewordings).\n${prof}\nBrief: ${JSON.stringify(d)}\nIf psychology is empty or "Let AI choose", pick the best fit per hook.\nJSON: {"hooks":[{"text":"","category":"","mechanism":"","why":"","weakness":"","visual":"","nextLine":"","score":0}]}` };
  }
  if (op === 'analyze') {
    const d = { hook: s(b.hook, 1000, true), platform: s(b.platform, 40), audience: s(b.audience, 200) };
    return { sys: BASE, user: `Critically analyze this hook. ${DIM_TXT} Be honest, not flattering.\n${prof}\nInput: ${JSON.stringify(d)}\nJSON: {"scores":${SC},"works":[""],"weak":[""],"missing":[""],"attentionRisk":"","alternative":"","improvements":""}` };
  }
  if (op === 'rewrite') {
    const d = { hook: s(b.hook, 1000, true), objective: s(b.objective, 80, true), platform: s(b.platform, 40), instruction: s(b.instruction, 400) };
    return { sys: BASE, user: `Rewrite the hook for the objective. Preserve the original meaning and facts; add no new facts.\n${prof}\nInput: ${JSON.stringify(d)}\nJSON: {"rewritten":"","changes":[""],"why":""}` };
  }
  const hooks = (Array.isArray(b.hooks) ? b.hooks : []).map(h => s(h, 1000, true));
  if (hooks.length < 2 || hooks.length > 5) throw E(400, 'Compare between 2 and 5 hooks.');
  const d = { hooks, platform: s(b.platform, 40), audience: s(b.audience, 200), format: s(b.format, 40) };
  return { sys: BASE, user: `Compare these hooks as an editor (not a real A/B test). ${DIM_TXT} The recommendation must weigh audience, format and intent, not just the top number. "index" is the 0-based position of the hook.\n${prof}\nInput: ${JSON.stringify(d)}\nJSON: {"items":[{"index":0,"scores":${SC},"strengths":[""],"weaknesses":[""],"approach":"","audience":""}],"recommended":0,"explanation":"","assessment":""}` };
}
const scoresOf = sc => Object.fromEntries(DIMS.map(k => [k, n(sc?.[k])]));
const weighted = sc => n(DIMS.reduce((a, k) => a + sc[k] * W[k], 0));
const str = v => (typeof v === 'string' ? v.trim() : '');

function normalize(op, j, ctx) {
  if (!j || typeof j !== 'object') throw E(502, 'Response could not be processed.');
  if (op === 'generate') {
    const hooks = (Array.isArray(j.hooks) ? j.hooks : []).map(h => ({ text: str(h?.text), category: str(h?.category), mechanism: str(h?.mechanism), why: str(h?.why), weakness: str(h?.weakness), visual: str(h?.visual), nextLine: str(h?.nextLine), score: n(h?.score) })).filter(h => h.text).slice(0, ctx.count);
    if (!hooks.length) throw E(502, 'Response could not be processed.');
    return { hooks };
  }
  if (op === 'analyze') {
    const scores = scoresOf(j.scores);
    return { scores, overall: weighted(scores), works: list(j.works), weak: list(j.weak), missing: list(j.missing), attentionRisk: str(j.attentionRisk), alternative: str(j.alternative), improvements: str(j.improvements) };
  }
  if (op === 'rewrite') {
    if (!str(j.rewritten)) throw E(502, 'Response could not be processed.');
    return { rewritten: str(j.rewritten), changes: list(j.changes), why: str(j.why) };
  }
  const items = (Array.isArray(j.items) ? j.items : []).slice(0, 5).map((x, i) => { const scores = scoresOf(x?.scores); return { index: i, scores, overall: weighted(scores), strengths: list(x?.strengths), weaknesses: list(x?.weaknesses), approach: str(x?.approach), audience: str(x?.audience) }; });
  if (items.length < 2) throw E(502, 'Response could not be processed.');
  const rec = Number.isInteger(j.recommended) && j.recommended >= 0 && j.recommended < items.length ? j.recommended : 0;
  return { items, recommended: rec, explanation: str(j.explanation), assessment: str(j.assessment) };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = req.headers.origin;
  if (origin && process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'POST') throw E(405, 'Method not allowed.');
    if (process.env.AI_ENABLED === 'false') throw E(503, 'AI features are temporarily disabled by the site owner.');
    if (!process.env.GEMINI_API_KEY) throw E(503, 'AI service is not configured.');
    if (Number(req.headers['content-length'] || 0) > 40000) throw E(413, 'Request too large.');
    const b = req.body;
    if (!b || typeof b !== 'object' || JSON.stringify(b).length > 40000) throw E(400, 'Invalid request.');
    if (!OPS.includes(b.op)) throw E(400, 'Unsupported operation.');
    const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
    const now = Date.now(); const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
    if (arr.length >= 8) throw E(429, 'Too many requests. Please wait a minute.');
    arr.push(now); hits.set(ip, arr);
    if (hits.size > 2000) hits.clear();

    const p = build(b.op, b);
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 50000);
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-2.5-flash')}:generateContent`, {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: p.sys }] }, contents: [{ role: 'user', parts: [{ text: p.user }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: 4096 } })
      });
    } catch (e) { if (e.name === 'AbortError') console.error('[HookLab] Gemini request timed out after 50 seconds.'); throw E(e.name === 'AbortError' ? 504 : 502, e.name === 'AbortError' ? 'The AI service timed out. Try again.' : 'Unable to reach the AI service.'); }
    finally { clearTimeout(timer); }
    if (r.status === 429) throw E(429, 'Gemini quota is temporarily exhausted. Try again later.');
    if (!r.ok) { console.error(`[HookLab] Gemini API returned HTTP ${r.status}.`); throw E(502, 'The AI service returned an error.'); }
    const data = await r.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('').replace(/^```json|^```|```$/gm, '').trim();
    if (!text) throw E(502, 'The AI returned an empty or blocked response. Try rephrasing.');
    let j; try { j = JSON.parse(text); } catch { throw E(502, 'Response could not be processed.'); }
    return res.status(200).json(normalize(b.op, j, p));
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Unexpected error.' });
  }
};
