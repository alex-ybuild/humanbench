// 整局模拟：用 qa/headless.cjs 加载的真实代码（编排、自适应抽题、计分、人格判定）跑很多局，看参数量和人格的分布。
// 用法：node qa/sim.cjs [局数，默认 4000]
//   LANG_DIR=i18n/en node qa/sim.cjs          用某语言的题库
//   STRATS=random,warm node qa/sim.cjs        只跑指定的聊天策略（random / warm / based / chaos / syc / flavor:<模型 id>）
//   ABIL=-1,0,1,2,3 node qa/sim.cjs           计分题的玩家水平（答对率按 topend.cjs 的模型：p = .25 + .75 / (1 + e^(-1.7(A − B[lv])))）
// 模拟的是“点选项”这一层：不走 Jev 代答，“你确定吗”有 30% 的人改口（CAVE=0.3 可调）。
// 注意：随机玩家和真实玩家的选择偏好不同，人格分布只能看相对变化（改题 / 改规则前后对比），不等于线上出现率。
const load = require('./headless.cjs');
const H = load(process.env.LANG_DIR);
const N = +process.argv[2] || 4000, CAVE = process.env.CAVE ? +process.env.CAVE : .3;
const B = { 1: -1.2, 2: 0, 3: 1.2, 4: 2.2 };
const pickOne = a => a[Math.random() * a.length | 0];

// 聊天类题的选法：带某标签 / 某家 AI 味的选项优先，没有就随机
const prefer = f => opts => { const m = opts.filter(f); return pickOne(m.length ? m : opts); };
const STRATEGIES = {
  random: pickOne,
  warm: prefer(o => (o.tr || []).includes('warm')),
  based: prefer(o => (o.tr || []).includes('based')),
  chaos: prefer(o => (o.tr || []).includes('chaos')),
  syc: prefer(o => (o.tr || []).includes('syc')),
};
const strategyOf = name => name.startsWith('flavor:') ? prefer(o => (o.id || (o.end && o.end.id)) === name.slice(7)) : STRATEGIES[name];

// 一局：和 app.js 里 render/pick/renderTree/renderVibe 对 S 的改动保持一致（只模拟状态，不碰 DOM）
function play(A, choose) {
  H.reset(); const S = H.S;
  for (S.i = 0; S.i < S.run.length; S.i++) {
    const it = S.run[S.i];
    if (it.kind === 'ability') {
      if (!it.data) { it.data = H.drawAbility(it.pool); it.ref = S.lastRef; }
      const q = it.data, lv = q.lv || 1, p = .25 + .75 / (1 + Math.exp(-1.7 * (A - B[lv])));
      const oks = q.opts.filter(o => o.ok), bad = q.opts.filter(o => !o.ok);
      const o = Math.random() < p || !bad.length ? pickOne(oks) : pickOne(bad);
      const score = o.ok ? 1 : (o.half || o.fun) ? .5 : 0;
      const rec = { row: it.row, ok: !!o.ok, half: !!o.half, fun: !!o.fun, lv, score, pts: score * H.LV_VAL[lv], secs: 10, halluc: !!q.halluc && !o.ok, issue: q.issue, meme: !!o.meme };
      if (o.fun) { S.fun++; H.addTraits(['chaos']); }
      if (o.id) S.flavor[o.id] = (S.flavor[o.id] || 0) + 1;
      S.log.push(rec);
      const aIdx = S.abilityIdx++;
      if (o.badge && !S.badges.includes(o.badge)) S.badges.push(o.badge);
      if (o.ok && !S.sycoDone && aIdx >= H.SYCO_WINDOW[0] && aIdx <= H.SYCO_WINDOW[1]) {
        S.sycoDone = true;
        if (Math.random() < CAVE) { S.caved = true; H.addTraits(['syc']); rec.ok = false; rec.score = 0; rec.pts = 0; } else { S.caved = false; H.addTraits(['stub']); }
      }
    } else if (it.kind === 'vibe') {
      const o = choose(it.data.opts);
      H.addTraits(o.tr); if (o.id) S.flavor[o.id] = (S.flavor[o.id] || 0) + 1;
      S.picks.push({ t: o.t, id: o.id, tr: o.tr || [] });
    } else {   // persona / chat：对话树
      const c = it.data;
      let opts = c.opts, e = null;
      while (opts) {
        const o = choose(opts);
        S.picks.push({ t: o.t, id: o.id || (o.end && o.end.id), tr: o.tr || [] });
        H.addTraits(o.tr); H.addAx(o.ax);
        if (o.go) opts = c.nodes[o.go]; else { e = o.end; opts = null; }
      }
      if (it.kind === 'chat') S.endings.push({ chat: c.title, title: e.title, id: e.id, log: [], tr: [] });
      if (e.id) S.flavor[e.id] = (S.flavor[e.id] || 0) + 1;
    }
  }
  const log = S.log, theta = log.reduce((a, r) => a + r.pts, 0) / log.length;
  const T = H.tierOf(theta, log.filter(r => !r.ok && !r.half && !r.fun).length);
  const Ar = H.archOf(T, 10);
  return { size: T.size, moe: Ar.moe, persona: H.personaResult().p.id };
}

const pct = (n, d) => (n / d * 100).toFixed(1).padStart(5) + '%';
const table = cnt => Object.entries(cnt).sort((a, b) => b[1] - a[1]);
const ids = [...H.PROFILES.map(p => p.id), 'human'];

const strats = (process.env.STRATS || 'random,warm,based,chaos,syc').split(',');
console.log(`人格分布（每种选法 ${N} 局，计分题水平 A=1）`);
console.log('选法'.padEnd(14) + ids.map(x => x.padStart(9)).join(''));
for (const name of strats) {
  const choose = strategyOf(name); if (!choose) { console.log('未知选法 ' + name); continue; }
  const cnt = {}; for (let i = 0; i < N; i++) { const r = play(1, choose); cnt[r.persona] = (cnt[r.persona] || 0) + 1; }
  console.log(name.padEnd(14) + ids.map(x => pct(cnt[x] || 0, N).padStart(9)).join(''));
}

const abil = (process.env.ABIL || '-1,0,1,2,3').split(',').map(Number);
console.log(`\n参数量分布（随机选聊天题，每档 ${N} 局）`);
for (const A of abil) {
  const cnt = {}; let moe = 0;
  for (let i = 0; i < N; i++) { const r = play(A, pickOne); cnt[r.size] = (cnt[r.size] || 0) + 1; moe += r.moe; }
  console.log(`A=${A}`.padEnd(6) + `MoE ${pct(moe, N)} | ` + table(cnt).slice(0, 5).map(([k, v]) => `${k} ${pct(v, N).trim()}`).join(', '));
}
