// 已过时（保留作历史记录）：一局的编排还是旧版（旧名场面标题、已停用的“深度思考模式”开场），和现在的游戏对不上。看人格/参数量分布请用 qa/sim.cjs（加载真实的 app.js）
// 统计随机作答时各标签/各家 AI 味的均值和标准差，作为“普通人”的基准
const fs = require('fs');
eval(['bank.js', 'chats.js'].map(f => fs.readFileSync(__dirname + '/../' + f, 'utf8')).join('\n').replace(/^const /gm, 'var '));
const pickOne = a => a[Math.random() * a.length | 0];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]] } return a };
const HEAD = ["AI 小卖部", "就改这一处", "奶奶漏洞", "代码冻结", "转人工", "1 美元买车"];
const FL = { "Claude": "claude", "GPT-4o": "gpt4o", "Codex": "gpt5", "GPT-5 系": "gpt5", "ChatGPT": "gpt5", "DeepSeek": "deepseek", "Gemini": "gemini", "豆包": "doubao", "Kimi": "kimi", "Grok": "grok" };
function play() {
  const tr = {}, fl = {};
  const take = o => { (o.tr || []).forEach(t => tr[t] = (tr[t] || 0) + 1); const id = o.id || (o.end && o.end.id); if (FL[id]) fl[FL[id]] = (fl[FL[id]] || 0) + 1; };
  const walk = (tree, opts) => { const o = pickOne(opts); take(o); if (o.go) walk(tree, tree.nodes[o.go]); };
  const axes = shuffle(PERSONA_AXES.map(a => a.id)); const uc = new Set(), uv = new Set(), us = new Set(); let ci = 0;
  RUN_PLAN.forEach(slot => {
    if (slot === 'persona') { const q = pickOne(PERSONA_Q[axes.shift()]); walk(q, q.opts); }
    else if (slot === 'chat') { const idx = t => CHATS.findIndex(c => c.title === t), head = HEAD.map(idx).filter(i => i >= 0 && !uc.has(i)); const pool = ci === 0 ? [idx('深度思考模式')] : ci < 3 ? head : CHATS.map((c, i) => i).filter(i => !uc.has(i)); const k = pickOne(pool); uc.add(k); ci++; walk(CHATS[k], CHATS[k].opts); }
    else if (slot === 'vibe') { const k = pickOne(VIBES.map((v, i) => i).filter(i => !uv.has(i))); uv.add(k); take(pickOne(VIBES[k].opts)); }
    else if (slot === 'slopid') { const k = pickOne(SLOP_VIBES.map((v, i) => i).filter(i => !us.has(i))); us.add(k); take(pickOne(SLOP_VIBES[k].opts)); }
  });
  return { tr, fl };
}
const N = 20000, acc = {};
for (let i = 0; i < N; i++) { const r = play(); for (const [g, o] of [['tr', r.tr], ['fl', r.fl]]) { const keys = g === 'tr' ? Object.keys(TRAITS) : [...new Set(Object.values(FL))]; keys.forEach(k => { const v = o[k] || 0; const a = acc[g + ':' + k] = acc[g + ':' + k] || [0, 0]; a[0] += v; a[1] += v * v; }); } }
const base = { tr: {}, fl: {} };
Object.entries(acc).forEach(([key, [s, s2]]) => { const [g, k] = key.split(':'); const m = s / N, sd = Math.sqrt(Math.max(s2 / N - m * m, .25)); base[g][k] = [+m.toFixed(2), +sd.toFixed(2)]; });
console.log(JSON.stringify(base));
fs.writeFileSync(__dirname + '/persona_base.json', JSON.stringify(base));
