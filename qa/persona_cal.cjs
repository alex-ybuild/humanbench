// 已过时（保留作历史记录）：一局的编排还是旧版（旧名场面标题、已停用的“深度思考模式”开场），和现在的游戏对不上。看人格/参数量分布请用 qa/sim.cjs（加载真实的 app.js）
const fs = require('fs');
eval(['bank.js', 'chats.js'].map(f => fs.readFileSync(__dirname + '/../' + f, 'utf8')).join('\n').replace(/^const /gm, 'var '));
const pickOne = a => a[Math.random() * a.length | 0];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]] } return a };
const HEAD = ["AI 小卖部", "就改这一处", "奶奶漏洞", "代码冻结", "转人工", "1 美元买车"];
const FLAVOR_TO = { "Claude": "claude", "GPT-4o": "gpt4o", "Codex": "codex", "GPT-5 系": "chatgpt", "ChatGPT": "chatgpt", "DeepSeek": "deepseek", "Gemini": "gemini", "豆包": "doubao", "Kimi": "kimi", "Grok": "grok" };
const W_FLAVOR = 14;
function play(strategy) {
  const sum = {}, n = {}, flavor = {};
  const add = ax => Object.entries(ax || {}).forEach(([k, v]) => { sum[k] = (sum[k] || 0) + v; n[k] = (n[k] || 0) + 1; });
  const fl = id => { if (id) flavor[id] = (flavor[id] || 0) + 1; };
  const walk = (tree, opts, keep) => { const o = strategy(opts); add(o.ax); fl(o.id); if (o.go) walk(tree, tree.nodes[o.go], keep); else if (keep && o.end) fl(o.end.id); };
  const axes = shuffle(PERSONA_AXES.map(a => a.id)); const usedChat = new Set(), usedV = new Set(), usedS = new Set(); let ci = 0;
  RUN_PLAN.forEach(slot => {
    if (slot === 'persona') { const q = pickOne(PERSONA_Q[axes.shift()]); walk(q, q.opts, false); }
    else if (slot === 'chat') {
      const idx = t => CHATS.findIndex(c => c.title === t), head = HEAD.map(idx).filter(i => i >= 0 && !usedChat.has(i));
      const pool = ci === 0 ? [idx('深度思考模式')] : ci < 3 ? head : CHATS.map((c, i) => i).filter(i => !usedChat.has(i));
      const k = pickOne(pool); usedChat.add(k); ci++; walk(CHATS[k], CHATS[k].opts, true);
    } else if (slot === 'vibe') { const k = pickOne(VIBES.map((v, i) => i).filter(i => !usedV.has(i))); usedV.add(k); fl(strategy(VIBES[k].opts).id); }
    else if (slot === 'slopid') { const k = pickOne(SLOP_VIBES.map((v, i) => i).filter(i => !usedS.has(i))); usedS.add(k); fl(strategy(SLOP_VIBES[k].opts).id); }
  });
  return { vec: PERSONA_AXES.map(a => n[a.id] ? sum[a.id] / n[a.id] : 50), flavor };
}
function classify(r, bias) {
  let best = null, bs = 1e9;
  PROFILES.forEach(p => {
    const d = Math.sqrt(p.v.reduce((a, x, i) => a + (x - r.vec[i]) ** 2, 0));
    const f = Object.entries(r.flavor).reduce((a, [k, v]) => a + (FLAVOR_TO[k] === p.id ? v : 0), 0);
    const s = d - W_FLAVOR * f - (bias[p.id] || 0);
    if (s < bs) { bs = s; best = p; }
  });
  return best.id;
}
const random = opts => pickOne(opts);
const samples = Array.from({ length: 12000 }, () => play(random));
const bias = {}; PROFILES.forEach(p => bias[p.id] = 0);
for (let it = 0; it < 60; it++) {
  const cnt = {}; samples.forEach(r => { const id = classify(r, bias); cnt[id] = (cnt[id] || 0) + 1; });
  PROFILES.forEach(p => { const share = (cnt[p.id] || 0) / samples.length; bias[p.id] += 25 * (1 / PROFILES.length - share); });
}
Object.keys(bias).forEach(k => bias[k] = Math.round(bias[k] * 10) / 10);
const show = (label, strat, N = 12000) => {
  const cnt = {}; for (let i = 0; i < N; i++) { const id = classify(play(strat), bias); cnt[id] = (cnt[id] || 0) + 1; }
  console.log(`[${label}] ` + PROFILES.map(p => [p.name.replace('型人格', ''), (cnt[p.id] || 0) / N]).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n} ${(v * 100).toFixed(0)}%`).join(' · '));
};
console.log('bias', JSON.stringify(bias));
show('完全随机', random);
const pref = test => opts => { const m = opts.filter(test); return pickOne(m.length ? m : opts); };
show('爱选暖心', pref(o => (o.tr || []).includes('warm')));
show('爱选清醒', pref(o => (o.tr || []).includes('based')));
show('爱选整活', pref(o => (o.tr || []).includes('chaos')));
show('爱选话痨', pref(o => (o.tr || []).includes('verbose')));
show('爱选谄媚', pref(o => (o.tr || []).includes('syc')));
show('爱选 Codex 味', pref(o => o.id === 'Codex' || (o.tr || []).includes('verbose')));
show('爱选 4o 味', pref(o => o.id === 'GPT-4o' || (o.tr || []).includes('warm')));
fs.writeFileSync(__dirname + '/persona_bias.json', JSON.stringify(bias));
