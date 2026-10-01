// 已过时（保留作历史记录）：一局的编排还是旧版（旧名场面标题、已停用的“深度思考模式”开场），和现在的游戏对不上。看人格/参数量分布请用 qa/sim.cjs（加载真实的 app.js）
const fs = require('fs');
const src = ['bank.js', 'chats.js'].map(f => fs.readFileSync(__dirname + '/../' + f, 'utf8')).join('\n');
eval(src.replace(/^const /gm, 'var '));
const pickOne = a => a[Math.random() * a.length | 0];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]] } return a };
const HEAD = ["AI 小卖部", "就改这一处", "奶奶漏洞", "代码冻结", "转人工", "1 美元买车"];
function run(strategy) {
  const sum = {}, n = {};
  const add = ax => Object.entries(ax || {}).forEach(([k, v]) => { sum[k] = (sum[k] || 0) + v; n[k] = (n[k] || 0) + 1; });
  const walk = (tree, opts) => { const o = strategy(opts); add(o.ax); if (o.go) walk(tree, tree.nodes[o.go]); };
  const axes = shuffle(PERSONA_AXES.map(a => a.id));
  const usedChat = new Set();
  let ci = 0;
  RUN_PLAN.forEach(slot => {
    if (slot === 'persona') { const q = pickOne(PERSONA_Q[axes.shift()]); walk(q, q.opts); }
    if (slot === 'chat') {
      const idx = t => CHATS.findIndex(c => c.title === t);
      const head = HEAD.map(idx).filter(i => i >= 0 && !usedChat.has(i));
      const pool = ci === 0 ? [idx('深度思考模式')] : ci < 3 ? head : CHATS.map((c, i) => i).filter(i => !usedChat.has(i));
      const k = pickOne(pool); usedChat.add(k); ci++; walk(CHATS[k], CHATS[k].opts);
    }
  });
  const vec = PERSONA_AXES.map(a => n[a.id] ? sum[a.id] / n[a.id] : 50);
  let best = null, bd = 1e9;
  PROFILES.forEach(p => { const d = Math.sqrt(p.v.reduce((a, x, i) => a + (x - vec[i]) ** 2, 0)); if (d < bd) { bd = d; best = p; } });
  return { name: best.name, vec, answered: PERSONA_AXES.map(a => n[a.id] || 0) };
}
const N = 20000, report = (label, strat) => {
  const cnt = {}; const vecAvg = [0, 0, 0, 0, 0, 0]; const ans = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) { const r = run(strat); cnt[r.name] = (cnt[r.name] || 0) + 1; r.vec.forEach((v, j) => vecAvg[j] += v / N); r.answered.forEach((v, j) => ans[j] += v / N); }
  console.log(`\n[${label}]`);
  PROFILES.map(p => p.name).map(nm => [nm, cnt[nm] || 0]).sort((a, b) => b[1] - a[1]).forEach(([nm, c]) => console.log('  ' + nm.padEnd(16, '　') + (c / N * 100).toFixed(1).padStart(5) + '%  ' + '#'.repeat(Math.round(c / N * 60))));
  console.log('  平均轴值', PERSONA_AXES.map((a, j) => a.label + ' ' + vecAvg[j].toFixed(0)).join(' · '));
  console.log('  每轴平均被计分次数', PERSONA_AXES.map((a, j) => a.id + ' ' + ans[j].toFixed(1)).join(' · '));
};
report('完全随机选', opts => pickOne(opts));
// 偏好型玩家：总选带某标签的
const pref = tag => opts => pickOne(opts.filter(o => (o.tr || []).includes(tag)).concat([]).length ? opts.filter(o => (o.tr || []).includes(tag)) : opts);
report('总选“暖心”的人', pref('warm'));
report('总选“清醒”的人', pref('based'));
report('总选“整活”的人', pref('chaos'));
report('总选“话痨”的人', pref('verbose'));
