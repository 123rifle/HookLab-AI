import * as db from './db.js';
import { ai } from './ai.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => crypto.randomUUID();
const fdata = f => Object.fromEntries(new FormData(f));
const fmtDate = t => new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const O = {
  platform: ['General', 'YouTube', 'YouTube Shorts', 'Instagram Reels', 'TikTok', 'Facebook', 'Podcast'],
  format: ['Short-form video', 'Long-form video', 'Educational video', 'Storytelling', 'Documentary', 'Tutorial', 'Entertainment', 'Personal brand', 'Podcast', 'Other'],
  tone: ['Conversational', 'Bold', 'Curious', 'Educational', 'Emotional', 'Mysterious', 'Contrarian', 'Professional', 'Story-driven', 'Humorous'],
  psy: ['Let AI choose', 'Curiosity gap', 'Pattern interruption', 'Unexpected fact', 'Contrarian statement', 'Relatability', 'Fear of missing out', 'Emotional connection', 'Problem and solution', 'Open loop', 'Specific promise', 'Direct question', 'Story opening'],
  len: ['Under 8 words', 'Around 10-15 words', 'Around 20 words', 'Up to 2 sentences'],
  obj: ['More curiosity', 'More specificity', 'Shorter wording', 'More conversational', 'More emotional', 'More educational', 'More story-driven', 'More direct', 'Less generic', 'Better platform suitability']
};
const DIMS = { clarity: 'Clarity', curiosity: 'Curiosity', specificity: 'Specificity', relevance: 'Relevance', emotional: 'Emotional appeal', credibility: 'Credibility', conciseness: 'Conciseness', originality: 'Originality' };
const ROUTES = [['overview', 'Overview'], ['studio', 'Hook Studio'], ['analyzer', 'Hook Analyzer'], ['rewriter', 'Hook Rewriter'], ['battle', 'Hook Battle'], ['library', 'Hook Library'], ['performance', 'Performance Lab'], ['profile', 'Creator Profile'], ['settings', 'Settings']];

// ---------- state (kept across navigation) ----------
const S = { forms: {}, studio: { results: [] }, analyzer: { res: null }, rewriter: { res: null }, battle: { res: null, hooks: [] } };
let cur = '';
const V = (n, d = '') => S.forms[cur]?.[n] ?? d;
const sel = (n, l, o, v) => `<label>${l}<select name="${n}">${o.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`;
const inp = (n, l, v = '', t = 'text', x = '') => `<label>${l}<input name="${n}" type="${t}" value="${esc(v)}" ${x}></label>`;
const txt = (n, l, v = '', r = 3, x = '') => `<label>${l}<textarea name="${n}" rows="${r}" ${x}>${esc(v)}</textarea></label>`;
const bar = (l, v) => `<div class="bar"><span>${l}</span><i><b style="width:${v}%"></b></i><em>${v}</em></div>`;
const bars = sc => Object.entries(DIMS).map(([k, l]) => bar(l, sc[k] ?? 0)).join('');
const li = a => a?.length ? `<ul class="l">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">None noted.</p>';
const head = (t, p) => `<div class="head"><h1>${t}</h1><p>${p}</p></div>`;
const empty = (t, p, a = '') => `<div class="empty"><h3>${t}</h3><p>${p}</p>${a}</div>`;
const NOTE = '<p class="muted">Scores are editorial assessments by AI, not predictions of views or retention.</p>';

function toast(m, bad) { const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = m; $('#toasts').append(t); setTimeout(() => t.remove(), 2600); }
function modal(title, body, onSubmit, ok = 'Save changes') {
  const d = $('#modal');
  d.innerHTML = `<form method="dialog"><h2>${title}</h2>${body}<div class="row sp"><button class="btn" value="x" formnovalidate>Cancel</button><button class="btn pri" value="ok">${ok}</button></div></form>`;
  d.querySelector('form').onsubmit = async e => { if (e.submitter?.value !== 'ok') return; try { await onSubmit(fdata(e.target)); } catch (er) { toast(er.message, 1); } };
  d.showModal();
}
async function run(btn, fn, out) {
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Working…';
  try { await fn(); } catch (e) { out.innerHTML = `<div class="err">${esc(e.message)} <button class="btn sm" data-a="retry">Retry</button></div>`; toast(e.message, 1); }
  finally { btn.disabled = false; btn.innerHTML = old; }
}
const go = r => { location.hash = '#/' + r; };
const profile = async () => (await db.getKV('profile').catch(() => null)) || {};

// ---------- hooks ----------
async function saveHook(text, meta = {}) {
  const t = Date.now(); const f = S.forms.studio || {};
  const h = { id: uid(), text, topic: meta.topic ?? f.topic ?? '', platform: meta.platform ?? f.platform ?? 'General', format: meta.format ?? f.format ?? '', category: meta.category || '', score: meta.score ?? null, created: t, updated: t, tags: [], notes: '', folder: '', fav: !!meta.fav, archived: false };
  await db.put('hooks', h); return h;
}

// ---------- views ----------
const views = {};
views.overview = async root => {
  const hs = (await db.all('hooks')).filter(h => !h.archived), ps = await db.all('perf');
  const rec = [...hs].sort((a, b) => b.updated - a.updated).slice(0, 5), an = hs.filter(h => h.score != null).sort((a, b) => b.updated - a.updated).slice(0, 3);
  const views_ = ps.reduce((a, p) => a + (+p.views || 0), 0);
  root.innerHTML = `${head('Welcome to HookLab', 'Turn attention into retention. Generate, analyze, improve and compare hooks, then track what you publish. Your workspace lives in this browser.')}
  <div class="row" style="margin-bottom:18px"><button class="btn pri" data-go="studio">Open Hook Studio</button><button class="btn" data-go="analyzer">Analyze a hook</button><button class="btn" data-go="battle">Start a battle</button><button class="btn" data-go="performance">Log performance</button></div>
  <div class="grid g3" style="margin-bottom:16px"><div class="panel"><div class="stat">${hs.length}</div>Saved hooks</div><div class="panel"><div class="stat">${hs.filter(h => h.fav).length}</div>Favorites</div><div class="panel"><div class="stat">${ps.length}</div>Tracked content${ps.length ? `<div class="muted">${views_.toLocaleString()} views logged manually</div>` : ''}</div></div>
  <div class="grid g2"><div class="panel"><h2>Recent hooks</h2>${rec.length ? rec.map(h => `<p>${esc(h.text)}<br><span class="muted">${esc(h.platform)} · ${fmtDate(h.updated)}</span></p>`).join('') : empty('No hooks yet', 'Generate your first hooks in Hook Studio.', '<button class="btn pri" data-go="studio">Go to Hook Studio</button>')}</div>
  <div class="panel"><h2>Recently analyzed</h2>${an.length ? an.map(h => `<p>${esc(h.text)}<br><span class="score">${h.score}</span> <span class="muted">editorial score</span></p>`).join('') : empty('Nothing analyzed yet', 'Scored hooks appear here.')}</div></div>`;
};

views.studio = async root => {
  const folders = await db.getKV('folders').catch(() => []) || [];
  root.innerHTML = `${head('Hook Studio', 'Describe your idea and get distinct hook approaches, each with the reasoning and a weakness to watch.')}
  <div class="split"><form class="panel" id="f" data-k>
    ${txt('topic', 'Topic or idea *', V('topic'), 3, 'required maxlength=800')}${txt('context', 'Script or context (optional)', V('context'), 3, 'maxlength=4000')}
    <div class="grid g2">${sel('platform', 'Platform', O.platform, V('platform'))}${sel('format', 'Format', O.format, V('format'))}</div>
    <div class="grid g2">${inp('niche', 'Niche', V('niche'), 'text', 'maxlength=100')}${sel('tone', 'Tone', O.tone, V('tone'))}</div>
    ${inp('audience', 'Target audience', V('audience'), 'text', 'maxlength=200')}${sel('psychology', 'Hook psychology', O.psy, V('psychology'))}
    <div class="grid g2">${sel('length', 'Hook length', O.len, V('length'))}${inp('count', 'Number of hooks (1-8)', V('count', 5), 'number', 'min=1 max=8')}</div>
    <button class="btn pri" id="go" style="width:100%">Generate hooks</button></form>
  <div class="panel" id="out"></div></div>`;
  const out = $('#out'); const show = () => { out.innerHTML = S.studio.results.length ? S.studio.results.map(hookCard).join('') + NOTE : empty('No hooks yet', 'Fill in your idea and generate. Nothing is shown until the AI responds.'); };
  show();
  const gen = async (extra = '', count) => {
    const f = $('#f'); if (!f.reportValidity()) return; S.forms.studio = fdata(f);
    const d = { ...S.forms.studio, instruction: extra }; if (count) d.count = count;
    await run($('#go'), async () => { const r = await ai('generate', d); S.studio.results = extra ? [...S.studio.results, ...r.hooks] : r.hooks; show(); }, out);
  };
  $('#go').onclick = e => { e.preventDefault(); gen(); };
  S.studio.gen = gen;
};
const hookCard = (h, i) => `<div class="hook"><div class="row sp"><span class="tag">${esc(h.category)}</span><span class="score">${h.score}/100</span></div><q>${esc(h.text)}</q>
  <dl class="meta"><dt>Mechanism</dt><dd>${esc(h.mechanism)}</dd><dt>Why it may work</dt><dd>${esc(h.why)}</dd><dt>Weakness</dt><dd>${esc(h.weakness)}</dd><dt>Opening visual</dt><dd>${esc(h.visual)}</dd><dt>Next line</dt><dd>${esc(h.nextLine)}</dd></dl>
  <div class="row">${['copy', 'save', 'fav', 'rewrite', 'analyze', 'compare', 'edit', 'similar', 'different'].map(a => `<button class="btn sm" data-a="${a}" data-i="${i}">${{ copy: 'Copy', save: 'Save', fav: 'Favorite', rewrite: 'Rewrite', analyze: 'Analyze', compare: 'Compare', edit: 'Edit', similar: 'More like this', different: 'Different approach' }[a]}</button>`).join('')}</div></div>`;

views.analyzer = async root => {
  root.innerHTML = `${head('Hook Analyzer', 'Paste a hook and get an honest editorial read across eight weighted dimensions.')}
  <div class="split"><form class="panel" id="f" data-k>${txt('hook', 'Hook *', V('hook'), 4, 'required maxlength=1000')}${sel('platform', 'Platform', O.platform, V('platform'))}${inp('audience', 'Target audience', V('audience'), 'text', 'maxlength=200')}<button class="btn pri" id="go" style="width:100%">Analyze hook</button></form><div class="panel" id="out"></div></div>`;
  const out = $('#out'), r = S.analyzer.res;
  out.innerHTML = r ? `<div class="row sp"><h2>Overall editorial score</h2><span class="stat">${r.overall}</span></div>${bars(r.scores)}<h3>What works</h3>${li(r.works)}<h3>What is weak</h3>${li(r.weak)}<h3>What is missing</h3>${li(r.missing)}<h3>Why it may lose attention</h3><p>${esc(r.attentionRisk)}</p><h3>Stronger alternative</h3><p><b>${esc(r.alternative)}</b></p><p>${esc(r.improvements)}</p>
    <div class="row">${['copy', 'save', 'rewrite', 'compare'].map(a => `<button class="btn sm" data-a="${a}" data-t="${esc(r.alternative)}">${a === 'copy' ? 'Copy alternative' : a === 'save' ? 'Save alternative' : a === 'rewrite' ? 'Rewrite alternative' : 'Compare alternative'}</button>`).join('')}</div>${NOTE}` : empty('No analysis yet', 'Paste a hook to see scores and feedback.');
  $('#go').onclick = e => { e.preventDefault(); const f = $('#f'); if (!f.reportValidity()) return; S.forms.analyzer = fdata(f); run($('#go'), async () => { S.analyzer.res = await ai('analyze', S.forms.analyzer); views.analyzer(root); }, out); };
};

views.rewriter = async root => {
  root.innerHTML = `${head('Hook Rewriter', 'Improve an existing hook without changing what it means.')}
  <div class="split"><form class="panel" id="f" data-k>${txt('hook', 'Original hook *', V('hook'), 4, 'required maxlength=1000')}${sel('objective', 'Objective', O.obj, V('objective'))}${sel('platform', 'Platform', O.platform, V('platform'))}${inp('instruction', 'Extra direction (optional)', V('instruction'), 'text', 'maxlength=400')}<button class="btn pri" id="go" style="width:100%">Rewrite hook</button></form><div class="panel" id="out"></div></div>`;
  const out = $('#out'), r = S.rewriter.res;
  out.innerHTML = r ? `<div class="grid g2"><div><h3>Original</h3><p>${esc(r.orig)}</p></div><div><h3>Rewritten</h3><p><b>${esc(r.rewritten)}</b></p></div></div><h3>What changed</h3>${li(r.changes)}<p>${esc(r.why)}</p>
    <div class="row">${[['copy', 'Copy'], ['save', 'Save'], ['compare', 'Compare'], ['again', 'Rewrite again'], ['analyze', 'Send to Analyzer']].map(([a, l]) => `<button class="btn sm" data-a="${a}" data-t="${esc(r.rewritten)}">${l}</button>`).join('')}</div>` : empty('No rewrite yet', 'Paste a hook and pick an objective.');
  const doit = () => { const f = $('#f'); if (!f.reportValidity()) return; S.forms.rewriter = fdata(f); return run($('#go'), async () => { const x = await ai('rewrite', S.forms.rewriter); S.rewriter.res = { ...x, orig: S.forms.rewriter.hook }; views.rewriter(root); }, out); };
  $('#go').onclick = e => { e.preventDefault(); doit(); }; S.rewriter.doit = doit;
};

views.battle = async root => {
  const lib = (await db.all('hooks')).filter(h => !h.archived);
  while (S.battle.hooks.length < 2) S.battle.hooks.push('');
  const hs = S.battle.hooks;
  root.innerHTML = `${head('Hook Battle', 'Compare two to five hooks. The recommendation weighs audience and format, not just the top score. It is an editorial comparison, not a real A/B test.')}
  <form class="panel" id="f" data-k>${hs.map((h, i) => txt('h' + i, `Hook ${i + 1}`, h, 2, 'maxlength=1000')).join('')}
  <div class="row"><button class="btn sm" data-a="addslot" type="button" ${hs.length >= 5 ? 'disabled' : ''}>Add hook</button>${hs.length > 2 ? '<button class="btn sm" data-a="rmslot" type="button">Remove last</button>' : ''}${lib.length ? `<select id="lib" style="width:auto"><option value="">Add from library…</option>${lib.map(h => `<option value="${h.id}">${esc(h.text.slice(0, 60))}</option>`).join('')}</select>` : ''}</div><br>
  <div class="grid g2">${sel('platform', 'Platform', O.platform, V('platform'))}${sel('format', 'Format', O.format, V('format'))}</div>${inp('audience', 'Target audience', V('audience'), 'text', 'maxlength=200')}<button class="btn pri" id="go">Compare hooks</button></form><div id="out"></div>`;
  const syncSlots = () => { const d = fdata($('#f')); S.battle.hooks = S.battle.hooks.map((_, i) => d['h' + i] ?? ''); S.forms.battle = d; };
  S.battle.sync = syncSlots;
  $('#lib')?.addEventListener('change', async e => { syncSlots(); const h = lib.find(x => x.id === e.target.value); if (!h) return; const k = S.battle.hooks.findIndex(x => !x.trim()); if (k < 0) return toast('All slots are filled.', 1); S.battle.hooks[k] = h.text; views.battle(root); });
  const out = $('#out'), r = S.battle.res;
  if (r) out.innerHTML = `<div class="cmp">${r.items.map((x, i) => `<div class="panel ${i === r.recommended ? 'rec' : ''}"><div class="row sp"><b>Hook ${i + 1}</b><span class="score">${x.overall}</span></div>${i === r.recommended ? '<span class="tag">Recommended</span>' : ''}<p><b>${esc(r.texts[i])}</b></p>${bars(x.scores)}<h3>Strengths</h3>${li(x.strengths)}<h3>Weaknesses</h3>${li(x.weaknesses)}<p><span class="muted">Approach:</span> ${esc(x.approach)}</p><p><span class="muted">Suits:</span> ${esc(x.audience)}</p></div>`).join('')}</div>
  <div class="panel" style="margin-top:16px"><h2>Recommendation: Hook ${r.recommended + 1}</h2><p>${esc(r.explanation)}</p><p>${esc(r.assessment)}</p>${NOTE}</div>`;
  $('#go').onclick = e => { e.preventDefault(); syncSlots(); const texts = S.battle.hooks.map(x => x.trim()).filter(Boolean); if (texts.length < 2) return toast('Enter at least two hooks.', 1); const f = S.forms.battle; run($('#go'), async () => { const x = await ai('compare', { hooks: texts, platform: f.platform, format: f.format, audience: f.audience }); S.battle.res = { ...x, texts }; views.battle(root); }, out); };
};

views.library = async root => {
  const folders = (await db.getKV('folders').catch(() => [])) || [];
  root.innerHTML = `${head('Hook Library', 'Everything you save, stored in this browser.')}
  <form class="panel" id="f" data-k><div class="grid g4"><label>Search<input name="q" type="search" value="${esc(V('q'))}"></label>${sel('platform', 'Platform', ['All', ...O.platform], V('platform'))}${sel('folder', 'Folder', ['All', 'No folder', ...folders], V('folder'))}${sel('sort', 'Sort', ['Newest', 'Oldest', 'Highest score'], V('sort'))}</div>
  <div class="row"><label style="flex-direction:row;align-items:center;gap:6px;margin:0"><input type="checkbox" name="fav" style="width:auto;min-height:0" ${V('fav') ? 'checked' : ''}>Favorites only</label><label style="flex-direction:row;align-items:center;gap:6px;margin:0"><input type="checkbox" name="arch" style="width:auto;min-height:0" ${V('arch') ? 'checked' : ''}>Show archived</label><button class="btn sm" type="button" data-a="newfolder">New folder</button><button class="btn sm" type="button" data-a="newhook">Add hook</button></div></form><div id="list"></div>`;
  let all = await db.all('hooks'); const list = $('#list');
  const draw = () => {
    const f = fdata($('#f')); S.forms.library = f; const q = (f.q || '').toLowerCase();
    let r = all.filter(h => !!f.arch === !!h.archived && (!f.fav || h.fav) && (f.platform === 'All' || h.platform === f.platform) && (f.folder === 'All' || (f.folder === 'No folder' ? !h.folder : h.folder === f.folder)) && (!q || [h.text, h.topic, h.notes, h.category, (h.tags || []).join(' ')].join(' ').toLowerCase().includes(q)));
    r.sort((a, b) => f.sort === 'Oldest' ? a.created - b.created : f.sort === 'Highest score' ? (b.score ?? -1) - (a.score ?? -1) : b.created - a.created);
    list.innerHTML = !all.length ? `<div class="panel">${empty('Your library is empty', 'Save hooks from Hook Studio or add one manually.', '<button class="btn pri" data-go="studio">Open Hook Studio</button>')}</div>` : !r.length ? `<div class="panel">${empty('No results', 'Try changing your search or filters.')}</div>` :
      `<div class="panel">${r.map(h => `<div class="hook"><div class="row sp"><span>${h.fav ? '<span class="tag">Favorite</span>' : ''}<span class="tag">${esc(h.platform)}</span>${h.category ? `<span class="tag">${esc(h.category)}</span>` : ''}${h.folder ? `<span class="tag">Folder: ${esc(h.folder)}</span>` : ''}${(h.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</span>${h.score != null ? `<span class="score">${h.score}/100</span>` : ''}</div><q>${esc(h.text)}</q>${h.topic ? `<p class="muted">Topic: ${esc(h.topic)}</p>` : ''}${h.notes ? `<p>${esc(h.notes)}</p>` : ''}<p class="muted">Created ${fmtDate(h.created)} · Updated ${fmtDate(h.updated)}</p>
      <div class="row">${[['copy', 'Copy'], ['togfav', h.fav ? 'Unfavorite' : 'Favorite'], ['libedit', 'Edit'], ['dup', 'Duplicate'], ['archive', h.archived ? 'Restore' : 'Archive'], ['analyze', 'Analyze'], ['rewrite', 'Rewrite'], ['perfadd', 'Log performance'], ['del', 'Delete']].map(([a, l]) => `<button class="btn sm ${a === 'del' ? 'danger' : ''}" data-a="${a}" data-id="${h.id}" data-t="${esc(h.text)}">${l}</button>`).join('')}</div></div>`).join('')}</div>`;
  };
  draw(); let tm; $('#f').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(draw, 200); }); $('#f').addEventListener('change', draw);
  S.lib = { refresh: async () => { all = await db.all('hooks'); draw(); }, find: id => all.find(h => h.id === id), folders };
};

const PF = [['title', 'Content title *', 'text'], ['url', 'Content URL', 'url'], ['publish', 'Publish date', 'date'], ['views', 'Views or impressions', 'number'], ['avgDur', 'Avg watch duration (sec)', 'number'], ['avgPct', 'Avg % viewed', 'number'], ['ret3', 'First 3-sec retention % (optional)', 'number'], ['likes', 'Likes', 'number'], ['comments', 'Comments', 'number'], ['shares', 'Shares', 'number'], ['saves', 'Saves', 'number']];
async function perfForm(rec = {}) {
  const hs = await db.all('hooks');
  modal(rec.id ? 'Edit record' : 'Add performance record', `${PF.slice(0, 1).map(([n, l, t]) => inp(n, l, rec[n], t, 'required')).join('')}${sel('platform', 'Platform', O.platform, rec.platform)}<label>Associated hook (optional)<select name="hookId"><option value="">None</option>${hs.map(h => `<option value="${h.id}" ${h.id === rec.hookId ? 'selected' : ''}>${esc(h.text.slice(0, 70))}</option>`).join('')}</select></label><div class="grid g2">${PF.slice(1).map(([n, l, t]) => inp(n, l, rec[n], t, t === 'number' ? 'min=0 step=any' : '')).join('')}</div>${txt('notes', 'Notes', rec.notes, 2)}`,
    async d => { const r = { ...rec, ...d, id: rec.id || uid(), created: rec.created || Date.now() }; await db.put('perf', r); toast('Changes saved'); if (cur === 'performance') render(); });
}
views.performance = async root => {
  const ps = await db.all('perf'), hs = Object.fromEntries((await db.all('hooks')).map(h => [h.id, h]));
  root.innerHTML = `${head('Performance Lab', 'Log results by hand and look for patterns. These are observations from your own records, not proof that a hook caused a result.')}
  <div class="row sp" style="margin-bottom:14px"><form id="f" data-k class="row"><input name="q" type="search" placeholder="Search records" value="${esc(V('q'))}" style="width:200px">${sel('platform', '', ['All', ...O.platform], V('platform'))}<input name="from" type="date" value="${esc(V('from'))}" style="width:auto" aria-label="From date"></form><button class="btn pri" data-a="perfnew">Add record</button></div><div id="list"></div>`;
  const draw = () => {
    const f = fdata($('#f')); S.forms.performance = f; const q = (f.q || '').toLowerCase();
    const r = ps.filter(p => (f.platform === 'All' || p.platform === f.platform) && (!f.from || (p.publish || '') >= f.from) && (!q || (p.title + p.notes).toLowerCase().includes(q))).sort((a, b) => (b.publish || '').localeCompare(a.publish || ''));
    if (!ps.length) return $('#list').innerHTML = `<div class="panel">${empty('No performance records', 'Add a record after you publish. Charts appear once you have data.')}</div>`;
    if (!r.length) return $('#list').innerHTML = `<div class="panel">${empty('No results', 'Try different filters.')}</div>`;
    const tot = r.reduce((a, p) => a + (+p.views || 0), 0), withPct = r.filter(p => p.avgPct !== '' && p.avgPct != null), avgPct = withPct.length ? (withPct.reduce((a, p) => a + +p.avgPct, 0) / withPct.length).toFixed(1) : null;
    const grp = (keyf) => { const m = {}; r.forEach(p => { const k = keyf(p); if (!k) return; (m[k] ||= []).push(+p.views || 0); }); return Object.entries(m).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length), v.length]); };
    const chart = (rows, t) => { const mx = Math.max(...rows.map(x => x[1]), 1); return rows.length ? `<div class="panel"><h3>${t}</h3>${rows.map(([k, v, c]) => `<div class="bar"><span>${esc(k)}</span><i><b style="width:${v / mx * 100}%"></b></i><em>${v}</em></div><div class="muted" style="margin:-4px 0 4px 120px">${c} record${c > 1 ? 's' : ''}</div>`).join('')}${rows.some(x => x[2] < 3) ? '<p class="muted">Some groups have fewer than 3 records. Treat as anecdotal.</p>' : ''}</div>` : ''; };
    const top = [...r].sort((a, b) => (+b.views || 0) - (+a.views || 0)).slice(0, 3);
    $('#list').innerHTML = `<div class="grid g3" style="margin-bottom:14px"><div class="panel"><div class="stat">${r.length}</div>Tracked content</div><div class="panel"><div class="stat">${tot.toLocaleString()}</div>Views/impressions (as entered; platforms count differently)</div><div class="panel"><div class="stat">${avgPct ?? 'n/a'}${avgPct ? '%' : ''}</div>Average % viewed${withPct.length ? ` (${withPct.length} records)` : ''}</div></div>
    ${r.length < 3 ? '<div class="warn">Add more records to see meaningful comparisons.</div>' : `<div class="grid g2">${chart(grp(p => p.platform), 'Average views by platform')}${chart(grp(p => hs[p.hookId]?.category), 'Average views by linked hook category')}</div><div class="panel"><h3>Top by views</h3>${top.map(p => `<p>${esc(p.title)} <span class="muted">· ${(+p.views || 0).toLocaleString()} views</span></p>`).join('')}</div>`}
    <div class="panel tbl"><table><thead><tr><th>Title</th><th>Platform</th><th>Published</th><th>Views</th><th>Avg %</th><th>Hook</th><th></th></tr></thead><tbody>${r.map(p => `<tr><td>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a>` : esc(p.title)}</td><td>${esc(p.platform)}</td><td>${esc(p.publish || '')}</td><td>${esc(p.views || '')}</td><td>${esc(p.avgPct || '')}</td><td>${esc(hs[p.hookId]?.text.slice(0, 40) || '')}</td><td><button class="btn sm" data-a="perfedit" data-id="${p.id}">Edit</button> <button class="btn sm danger" data-a="perfdel" data-id="${p.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>`;
  };
  draw(); $('#f').addEventListener('input', draw); S.perf = { find: id => ps.find(p => p.id === id) };
};

const PRO = [['name', 'Creator or brand name'], ['niche', 'Niche'], ['audience', 'Target audience'], ['primaryPlatform', 'Primary platform'], ['formats', 'Content formats'], ['language', 'Preferred language'], ['tone', 'Preferred tone'], ['hookLength', 'Typical hook length']];
views.profile = async root => {
  const p = await profile();
  root.innerHTML = `${head('Creator Profile', 'Saved on this device. When you use AI features, only the profile fields relevant to the request are sent with it.')}
  <form class="panel" id="f"><div class="grid g2">${PRO.map(([k, l]) => inp(k, l, p[k], 'text', 'maxlength=200')).join('')}</div>${txt('avoid', 'Words or phrases to avoid', p.avoid, 2, 'maxlength=500')}${txt('style', 'Preferred writing style', p.style, 2, 'maxlength=500')}${txt('samples', 'Example writing samples', p.samples, 4, 'maxlength=600')}${txt('instructions', 'Additional instructions', p.instructions, 2, 'maxlength=500')}<div class="row"><button class="btn pri">Save profile</button><button class="btn danger" type="button" data-a="resetprofile">Reset profile</button></div></form>`;
  $('#f').onsubmit = async e => { e.preventDefault(); const d = fdata(e.target); d.platform = d.primaryPlatform; await db.setKV('profile', d); toast('Changes saved'); };
};

const THEME = () => localStorage.getItem('hl-theme') || 'system';
views.settings = async root => {
  root.innerHTML = `${head('Settings', 'Appearance, local data and privacy.')}
  <div class="panel"><h2>Appearance</h2><label style="max-width:240px">Theme<select id="theme">${['system', 'light', 'dark'].map(t => `<option ${t === THEME() ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
  <div class="panel"><h2>Your data</h2><div class="warn">Your workspace is tied to this browser and device. Clearing site data, private browsing or switching devices can make it unavailable. Nothing syncs automatically, so export a backup regularly.</div><div class="row"><button class="btn pri" data-a="export">Export workspace</button><label class="btn" style="margin:0;cursor:pointer">Import workspace<input id="imp" type="file" accept="application/json" hidden></label><button class="btn danger" data-a="wipe">Clear workspace</button></div></div>
  <div class="panel"><h2>Privacy</h2><p>Your creative workspace is stored locally in your browser. HookLab does not maintain a hosted database of your saved hooks, scripts, notes, or creator profile. When you use an AI feature, the relevant information is sent through HookLab's server-side API to Google Gemini to process your request. HookLab does not intentionally retain your creative content on its backend.</p><p>Google's own handling of submitted data is governed by the Gemini API terms and privacy documentation; please review them.</p></div>
  <div class="panel"><h2>About</h2><p>HookLab 1.0. AI features run through a shared service that can be paused or hit quota limits at any time. If that happens you will see a clear message. Scores are editorial heuristics, not performance predictions.</p></div>`;
  $('#theme').onchange = e => { localStorage.setItem('hl-theme', e.target.value); document.documentElement.dataset.theme = e.target.value; };
  $('#imp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { if (f.size > 20e6) throw new Error('File too large.'); const o = JSON.parse(await f.text()); db.validateBackup(o); if (!confirm('Importing replaces your current workspace. Continue?')) return; await db.importAll(o); toast('Data imported'); } catch (er) { toast(er instanceof SyntaxError ? 'Backup file is invalid.' : er.message, 1); } e.target.value = ''; };
};

// ---------- actions ----------
const textOf = b => b.dataset.t ?? S.studio.results[b.dataset.i]?.text;
const A = {
  retry: () => { const m = { studio: () => S.studio.gen(), rewriter: () => S.rewriter.doit(), analyzer: () => $('#go').click(), battle: () => $('#go').click() }[cur]; m?.(); },
  copy: async b => { try { await navigator.clipboard.writeText(textOf(b)); toast('Hook copied'); } catch { toast('Copy failed. Select the text manually.', 1); } },
  save: async b => { const r = S.studio.results[b.dataset.i]; await saveHook(textOf(b), r ? { category: r.category, score: r.score } : {}); toast('Hook saved'); },
  fav: async b => { const r = S.studio.results[b.dataset.i]; await saveHook(r.text, { category: r.category, score: r.score, fav: true }); toast('Hook saved to favorites'); },
  rewrite: b => { S.forms.rewriter = { ...S.forms.rewriter, hook: textOf(b) }; S.rewriter.res = null; go('rewriter'); },
  again: b => { S.forms.rewriter = { ...S.forms.rewriter, hook: textOf(b) }; S.rewriter.res = null; render(); },
  analyze: b => { S.forms.analyzer = { ...S.forms.analyzer, hook: textOf(b) }; S.analyzer.res = null; go('analyzer'); },
  compare: b => { const t = textOf(b), h = S.battle.hooks; const k = h.findIndex(x => !x.trim()); if (k >= 0) h[k] = t; else if (h.length < 5) h.push(t); else return toast('Battle already has 5 hooks.', 1); S.battle.res = null; toast('Added to Hook Battle'); },
  edit: b => { const r = S.studio.results[b.dataset.i], t = prompt('Edit hook', r.text); if (t?.trim()) { r.text = t.trim().slice(0, 1000); render(); } },
  similar: b => S.studio.gen(`Generate hooks similar in approach to: "${S.studio.results[b.dataset.i].text}"`, 3),
  different: b => S.studio.gen(`Generate hooks with a different psychological approach than: "${S.studio.results[b.dataset.i].text}"`, 3),
  addslot: () => { S.battle.sync(); S.battle.hooks.push(''); render(); }, rmslot: () => { S.battle.sync(); S.battle.hooks.pop(); render(); },
  newfolder: () => modal('New folder', inp('n', 'Folder name', '', 'text', 'required maxlength=40'), async d => { const f = [...new Set([...(S.lib.folders), d.n.trim()])]; await db.setKV('folders', f); toast('Folder created'); render(); }, 'Create folder'),
  newhook: () => modal('Add hook', txt('text', 'Hook *', '', 3, 'required maxlength=1000'), async d => { await saveHook(d.text.trim(), { platform: 'General', topic: '' }); toast('Hook saved'); S.lib.refresh(); }, 'Save hook'),
  togfav: async b => { const h = S.lib.find(b.dataset.id); await db.put('hooks', { ...h, fav: !h.fav, updated: Date.now() }); S.lib.refresh(); },
  archive: async b => { const h = S.lib.find(b.dataset.id); await db.put('hooks', { ...h, archived: !h.archived, updated: Date.now() }); toast('Changes saved'); S.lib.refresh(); },
  dup: async b => { const h = S.lib.find(b.dataset.id), t = Date.now(); await db.put('hooks', { ...h, id: uid(), created: t, updated: t }); toast('Hook duplicated'); S.lib.refresh(); },
  del: async b => { if (!confirm('Delete this hook permanently?')) return; await db.del('hooks', b.dataset.id); toast('Hook deleted'); S.lib.refresh(); },
  libedit: b => { const h = S.lib.find(b.dataset.id); modal('Edit hook', `${txt('text', 'Hook *', h.text, 3, 'required maxlength=1000')}${inp('topic', 'Original topic', h.topic)}${sel('platform', 'Platform', O.platform, h.platform)}${inp('category', 'Category', h.category)}${inp('tags', 'Tags (comma separated)', (h.tags || []).join(', '))}${sel('folder', 'Folder', ['', ...S.lib.folders], h.folder)}${txt('notes', 'Notes', h.notes, 3)}`, async d => { await db.put('hooks', { ...h, ...d, tags: d.tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 12), updated: Date.now() }); toast('Changes saved'); S.lib.refresh(); }); },
  perfadd: async b => { const h = S.lib.find(b.dataset.id); perfForm({ hookId: h.id, platform: h.platform }); },
  perfnew: () => perfForm(), perfedit: b => perfForm(S.perf.find(b.dataset.id)),
  perfdel: async b => { if (!confirm('Delete this record permanently?')) return; await db.del('perf', b.dataset.id); toast('Record deleted'); render(); },
  resetprofile: async () => { if (!confirm('Reset your creator profile?')) return; await db.setKV('profile', null); toast('Profile reset'); render(); },
  export: async () => { const j = JSON.stringify(await db.exportAll(), null, 2); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'hooklab-backup-v1.json'; a.click(); URL.revokeObjectURL(a.href); toast('Data exported'); },
  wipe: async () => { if (!confirm('Permanently delete ALL hooks, folders, records and your profile from this browser?')) return; if (prompt('Type DELETE to confirm') !== 'DELETE') return; await db.wipe(); toast('Workspace cleared'); }
};
document.addEventListener('click', async e => {
  const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
  const b = e.target.closest('[data-a]'); if (!b) return;
  try { await A[b.dataset.a]?.(b); } catch (er) { toast(er.message || 'Something went wrong.', 1); }
});

// ---------- router ----------
function captureForm() { const f = $('#view form[data-k]'); if (f && cur) S.forms[cur] = fdata(f); }
async function render() {
  const r = location.hash.replace('#/', '') || 'overview'; const route = views[r] ? r : 'overview';
  if (route !== cur || !$('#view').firstElementChild) captureForm();
  cur = route;
  document.querySelectorAll('#nav a').forEach(a => a.dataset.r === route ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  const root = $('#view');
  try { await views[route](root); } catch (e) { root.innerHTML = `<div class="err">Browser storage or rendering failed: ${esc(e.message)}. Try reloading or checking that your browser allows site data.</div>`; }
}
window.addEventListener('hashchange', () => { captureForm(); render(); });
window.addEventListener('hl-saved', () => { const s = $('#save-status'); s.textContent = 'Saved locally'; clearTimeout(s._t); s._t = setTimeout(() => s.textContent = '', 2000); });
document.documentElement.dataset.theme = THEME();
$('#nav').innerHTML = ROUTES.map(([r, l]) => `<a href="#/${r}" data-r="${r}">${l}</a>`).join('');
render();
