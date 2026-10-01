// 顶端难度模拟：玩家水平 A，答对率按题目档位 B[lv]；自适应抽题/计分/阶梯是 app.js 的简化复刻，参数可用 CFG='{…}' 改着试
// 默认值对齐 app.js 现行规则（LV_VAL、Boss 条件、第 20 题前不出 Boss、分段阶梯、∞ 门槛）；要看真实代码的结果用 qa/sim.cjs
const fs = require('fs');
const src = f => fs.readFileSync(__dirname + '/../' + f, 'utf8').replace(/^const /gm, 'var ').replace(/^let /gm, 'var ');
global.window = {}; var shuffle = a => a; eval(src('bank.js')); eval(src('arc.js')); eval(src('lv4.js'));
const CFG = Object.assign({ LV_VAL: { 1: .7, 2: .85, 3: 1, 4: 1.15 }, B: { 1: -1.2, 2: 0, 3: 1.2, 4: 2.2 }, maxLv: 4,
  lo: .2, span: .65, knee: .6, slope: 15.4, infTheta: 1.02, infMiss: 2, bossFrom: 19, arcBoost: 1,
  tgt: (acc, log) => acc >= .84 && log.slice(-6).some(r => r.lv >= 3 && r.ok) ? 4 : acc >= .8 ? 3 : acc >= .5 ? 2 : 1 }, JSON.parse(process.env.CFG || '{}'));
if (CFG.tgtCode) CFG.tgt = eval(CFG.tgtCode);
const randn = () => Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
const pickOne = a => a[Math.random() * a.length | 0];
function play(A) {
  const log = [], used = {};
  for (const [si, slot] of RUN_PLAN.entries()) {
    const [pool, fixed] = slot.split(':');
    if (['persona', 'vibe', 'chat', 'slopid'].includes(pool)) continue;
    let lv;
    if (pool === 'traps_fixed') lv = POOLS.traps_fixed[+fixed].lv || 1;
    else {
      const recent = log.slice(-6), acc = recent.length ? recent.filter(r => r.ok).length / recent.length : 0;
      let tgt = recent.length < 2 ? 2 : CFG.tgt(acc, log);
      if (pool === 'arc') tgt = Math.min(CFG.maxLv, tgt + CFG.arcBoost);
      if (CFG.bossFrom && si < CFG.bossFrom) tgt = Math.min(3, tgt);   // 第 bossFrom+1 题之前不出 Boss
      const lvs = POOLS[pool].map(q => q.lv || 1); used[pool] = used[pool] || new Set();
      const left = lvs.map((l, i) => i).filter(i => !used[pool].has(i));
      const best = Math.min(...left.map(i => Math.abs(lvs[i] - tgt)));
      const k = pickOne(left.filter(i => Math.abs(lvs[i] - tgt) === best)); used[pool].add(k); lv = lvs[k];
    }
    const p = .25 + .75 / (1 + Math.exp(-1.7 * (A - CFG.B[lv])));
    const ok = Math.random() < p; log.push({ ok, lv, pts: ok ? CFG.LV_VAL[lv] : 0 });
  }
  const theta = log.reduce((a, r) => a + r.pts, 0) / log.length, miss = log.filter(r => !r.ok).length;
  const inf = theta >= CFG.infTheta && miss <= CFG.infMiss;
  const pos = CFG.knee && theta > CFG.knee ? (CFG.knee - CFG.lo) / CFG.span * 16 + (theta - CFG.knee) * CFG.slope : (theta - CFG.lo) / CFG.span * 16;
  const idx = inf ? 16 : Math.floor(Math.max(0, Math.min(15.9999, pos)));
  return { theta, idx, miss, lv4: log.filter(r => r.lv === 4).length };
}
const NAMES = ["0.5B", "1.5B", "3B", "7B", "14B", "32B", "70B", "120B", "235B", "405B", "671B", "1T", "1.8T", "3T", "5T", "10T", "∞"];
for (const A of [3, 2.5, 2, 1.5, 1, 0.5, 0, -1]) {
  const P = []; for (let i = 0; i < 3000; i++) P.push(play(A));
  const d = {}; P.forEach(r => d[NAMES[r.idx]] = (d[NAMES[r.idx]] || 0) + 1);
  const top = Object.entries(d).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${(v / 30).toFixed(0)}%`).join(', ');
  console.log(`A=${A}`.padEnd(7), `θ=${(P.reduce((a, r) => a + r.theta, 0) / P.length).toFixed(3)}`, `错=${(P.reduce((a, r) => a + r.miss, 0) / P.length).toFixed(1)}`, `≥10T ${(P.filter(r => r.idx >= 15).length / 30).toFixed(0)}%`, `∞ ${(P.filter(r => r.idx === 16).length / 30).toFixed(0)}%`, '|', top);
}
