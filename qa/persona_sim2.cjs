// 已过时（保留作历史记录）：一局的编排还是旧版（旧名场面标题、已停用的“深度思考模式”开场），和现在的游戏对不上。看人格/参数量分布请用 qa/sim.cjs（加载真实的 app.js）
// 自然分布检查：用和游戏相同的判定逻辑，看各种玩法落到哪种人格（不做配平）
const fs = require('fs');
eval(['bank.js', 'chats.js'].map(f => fs.readFileSync(__dirname + '/../' + f, 'utf8')).join('\n').replace(/^const /gm, 'var '));
const appSrc = fs.readFileSync(__dirname + '/../app.js', 'utf8');
eval(appSrc.match(/const FLAVOR_TO[\s\S]*?\n};\n/)[0].replace('const ', 'var '));
eval(appSrc.match(/const TRAIT_TO = \{[\s\S]*?\n\};/)[0].replace('const ', 'var '));
eval(appSrc.match(/const PERSONA_BASE = .*;/)[0].replace('const ', 'var '));
eval(appSrc.match(/const z = .*;/)[0].replace('const ', 'var '));
var clamp = (x, a, b) => Math.max(a, Math.min(b, x));
var S;
eval(appSrc.match(/function personaResult\(\) \{[\s\S]*?\n\}\n/)[0]);
const pickOne = a => a[Math.random() * a.length | 0];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]] } return a };
const HEAD = ["AI 小卖部", "就改这一处", "奶奶漏洞", "代码冻结", "转人工", "1 美元买车"];
function play(strategy) {
  S = { axSum: {}, axN: {}, traits: {}, flavor: {}, picks: [] };
  const add = ax => Object.entries(ax || {}).forEach(([k, v]) => { S.axSum[k] = (S.axSum[k] || 0) + v; S.axN[k] = (S.axN[k] || 0) + 1; });
  const take = o => { add(o.ax); (o.tr || []).forEach(t => S.traits[t] = (S.traits[t] || 0) + 1); const id = o.id || (o.end && o.end.id); if (id) S.flavor[id] = (S.flavor[id] || 0) + 1; S.picks.push({ t: o.t, id, tr: o.tr || [] }); };
  const walk = (tree, opts) => { const o = strategy(opts); take(o); if (o.go) walk(tree, tree.nodes[o.go]); };
  const axes = shuffle(PERSONA_AXES.map(a => a.id)); const uc = new Set(), uv = new Set(), us = new Set(); let ci = 0;
  RUN_PLAN.forEach(slot => {
    if (slot === 'persona') { const q = pickOne(PERSONA_Q[axes.shift()]); walk(q, q.opts); }
    else if (slot === 'chat') { const idx = t => CHATS.findIndex(c => c.title === t), head = HEAD.map(idx).filter(i => i >= 0 && !uc.has(i)); const pool = ci === 0 ? [idx('深度思考模式')] : ci < 3 ? head : CHATS.map((c, i) => i).filter(i => !uc.has(i)); const k = pickOne(pool); uc.add(k); ci++; walk(CHATS[k], CHATS[k].opts); }
    else if (slot === 'vibe') { const k = pickOne(VIBES.map((v, i) => i).filter(i => !uv.has(i))); uv.add(k); take(strategy(VIBES[k].opts)); }
    else if (slot === 'slopid') { const k = pickOne(SLOP_VIBES.map((v, i) => i).filter(i => !us.has(i))); us.add(k); take(strategy(SLOP_VIBES[k].opts)); }
  });
  return personaResult();
}
const N = 8000;
const show = (label, strat) => {
  const cnt = {}; let ex = null;
  for (let i = 0; i < N; i++) { const r = play(strat); cnt[r.p.name] = (cnt[r.p.name] || 0) + 1; if (!ex && r.evidence.length) ex = r; }
  console.log(`[${label}] ` + Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, v]) => `${n.replace('型人格', '')} ${(v / N * 100).toFixed(0)}%`).join(' · '));
  if (ex) console.log(`      例：${ex.p.name}，因为你说过「${ex.evidence[0].slice(0, 40)}」`);
};
const pref = test => opts => { const m = opts.filter(test); return pickOne(m.length ? m : opts); };
show('完全随机', opts => pickOne(opts));
for (const [label, id] of [['爱选 Claude 味', 'Claude'], ['爱选 GPT-5 / Codex 味', 'Codex'], ['爱选 4o 味', 'GPT-4o'], ['爱选 Gemini 味', 'Gemini'], ['爱选豆包味', '豆包'], ['爱选 DeepSeek 味', 'DeepSeek']])
  show(label, pref(o => { const x = o.id || (o.end && o.end.id); return id === 'Codex' ? ['Codex', 'GPT-5 系', 'GPT-5'].includes(x) : x === id; }));
show('爱整活（Grok）', pref(o => (o.tr || []).includes('chaos')));
show('爱话痨（Kimi）', pref(o => (o.tr || []).includes('verbose') && !o.id));
show('爱清醒（GPT-5）', pref(o => (o.tr || []).includes('based')));
{ const cnt = {}; const M = 20000; for (let i = 0; i < M; i++) { const r = play(opts => pickOne(opts)); cnt[r.p.name] = (cnt[r.p.name] || 0) + 1; }
  console.log('\n[完全随机 · 全部九种]'); PROFILES.map(p => [p.name, cnt[p.name] || 0]).sort((a, b) => b[1] - a[1]).forEach(([n, v]) => console.log('  ' + n.padEnd(14, '　') + (v / M * 100).toFixed(1).padStart(5) + '%  ' + '#'.repeat(Math.round(v / M * 80)))); }
