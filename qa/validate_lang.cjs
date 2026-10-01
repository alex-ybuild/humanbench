// 用法：node qa/validate_lang.cjs <lang>
// 核对 i18n/<lang>/{bank,chats,arc}.js 与中文原版结构一致，并检查“正确答案最长”偏差和残留中文
const fs = require('fs'), path = require('path');
const lang = process.argv[2];
const root = path.join(__dirname, '..');
function load(dir) {
  const ctx = {};
  const src = ['bank.js', 'chats.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const fn = new Function(src.replace(/^const /gm, 'var ') + '\nreturn {POOLS, PERSONA_Q, PERSONA_AXES, TRAITS, VIBES, SLOP_VIBES, PROFILES, CHATS, ROWS, MODELS, AA, RUN_PLAN, SECTION_LABEL, CHARTS, UIS, E, SV};');
  const r = fn();
  const arcSrc = fs.readFileSync(path.join(dir, 'arc.js'), 'utf8');
  r.ARC = new Function('POOLS', 'shuffle', 'pickOne', arcSrc.replace(/^const /gm, 'var ') + '\nreturn {ARC_PUZZLES, ARC_QUIPS, ARC_MISS, ARC, SPLIT, G};')({}, a => a, a => a[0]);
  // Boss 题（lv4.js）：追加到题池末尾
  const lv4 = path.join(dir, 'lv4.js');
  if (fs.existsSync(lv4)) new Function('POOLS', 'ARC', 'ARC_PUZZLES', 'SPLIT', 'G', 'SV', 'CHARTS', 'UIS', fs.readFileSync(lv4, 'utf8').replace(/^const /gm, 'var '))(r.POOLS, r.ARC.ARC, r.ARC.ARC_PUZZLES, r.ARC.SPLIT, r.ARC.G, r.SV, r.CHARTS, r.UIS);   // 第三轮扩题的新图表/新界面也在 lv4.js 里注册
  return r;
}
const zh = load(root), L = load(path.join(root, 'i18n', lang));
const errs = [];
const eq = (a, b, where) => { if (JSON.stringify(a) !== JSON.stringify(b)) errs.push(`${where}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
const flags = o => ({ ok: !!o.ok, half: !!o.half, fun: !!o.fun, meme: !!o.meme, id: o.id || null, tr: o.tr || [], ax: o.ax || null, go: o.go || null, end: !!o.end, endId: o.end ? o.end.id || null : null });
// 题池
for (const k of Object.keys(zh.POOLS)) {
  if (!L.POOLS[k]) { errs.push(`缺题池 ${k}`); continue; }
  eq(L.POOLS[k].length, zh.POOLS[k].length, `题池 ${k} 题数`);
  zh.POOLS[k].forEach((q, i) => {
    const t = L.POOLS[k][i]; if (!t) return;
    eq(t.lv || 1, q.lv || 1, `${k}[${i}] 难度`); eq(t.ui || null, q.ui || null, `${k}[${i}] ui`); eq(t.chart || null, q.chart || null, `${k}[${i}] chart`);
    eq(!!t.halluc, !!q.halluc, `${k}[${i}] halluc`); eq(!!t.u, !!q.u, `${k}[${i}] 角色扮演`);
    eq(t.opts.length, q.opts.length, `${k}[${i}] 选项数`);
    q.opts.forEach((o, j) => t.opts[j] && eq(flags(t.opts[j]), flags(o), `${k}[${i}].opts[${j}]`));
  });
}
// UI 模拟界面：热区编号一致
for (const k of Object.keys(zh.UIS)) {
  const ids = s => [...(s || '').matchAll(/data-opt="(\d)"/g)].map(m => m[1]).sort().join();
  eq(ids(L.UIS[k]), ids(zh.UIS[k]), `UIS.${k} 热区`);
}
for (const k of Object.keys(zh.CHARTS)) if (!L.CHARTS[k]) errs.push(`缺图表 ${k}`);
// 对话树
const tree = (a, b, where) => {
  eq(Object.keys(b.nodes || {}).sort(), Object.keys(a.nodes || {}).sort(), `${where} 节点`);
  const walk = (x, y, w) => { eq(y.length, x.length, `${w} 选项数`); x.forEach((o, j) => { if (!y[j]) return; eq(flags(y[j]), flags(o), `${w}[${j}]`); if (!!o.think !== !!y[j].think) errs.push(`${w}[${j}] 思考流有无不一致`); }); };
  walk(a.opts, b.opts, `${where}.opts`);
  Object.keys(a.nodes || {}).forEach(n => b.nodes && b.nodes[n] && walk(a.nodes[n], b.nodes[n], `${where}.${n}`));
};
eq(L.CHATS.length, zh.CHATS.length, '对话数'); zh.CHATS.forEach((c, i) => L.CHATS[i] && tree(c, L.CHATS[i], `CHATS[${i}]`));
for (const ax of Object.keys(zh.PERSONA_Q)) { eq(L.PERSONA_Q[ax].length, zh.PERSONA_Q[ax].length, `人格 ${ax} 题数`); zh.PERSONA_Q[ax].forEach((q, i) => L.PERSONA_Q[ax][i] && tree(q, L.PERSONA_Q[ax][i], `PERSONA_Q.${ax}[${i}]`)); }
for (const [name, A, B] of [['VIBES', zh.VIBES, L.VIBES], ['SLOP_VIBES', zh.SLOP_VIBES, L.SLOP_VIBES]]) {
  eq(B.length, A.length, `${name} 数量`); A.forEach((v, i) => B[i] && (eq(B[i].opts.length, v.opts.length, `${name}[${i}] 选项数`), v.opts.forEach((o, j) => B[i].opts[j] && eq(flags(B[i].opts[j]), flags(o), `${name}[${i}].opts[${j}]`))));
}
eq(L.PROFILES.map(p => [p.id, p.v, p.color]), zh.PROFILES.map(p => [p.id, p.v, p.color]), 'PROFILES');
eq(Object.keys(L.TRAITS), Object.keys(zh.TRAITS), 'TRAITS 键'); eq(L.PERSONA_AXES.map(a => a.id), zh.PERSONA_AXES.map(a => a.id), '人格轴');
eq(L.ROWS.map(r => [r.id, r.vals, !!r.elo]), zh.ROWS.map(r => [r.id, r.vals, !!r.elo]), 'ROWS'); eq(L.AA, zh.AA, 'AA 数据'); eq(L.RUN_PLAN, zh.RUN_PLAN, 'RUN_PLAN');
eq(Object.keys(L.SECTION_LABEL).sort(), Object.keys(zh.SECTION_LABEL).sort(), 'SECTION_LABEL 键');
eq(L.ARC.ARC_PUZZLES.map(p => [p.lv, p.train, p.test]), zh.ARC.ARC_PUZZLES.map(p => [p.lv, p.train, p.test]), 'ARC 题目');
// 正确答案不能是唯一最长（按字符数；图片/界面题除外）
const len = t => [...String(t)].length; let longest = [];
for (const [k, v] of Object.entries(L.POOLS)) { if (k === 'osworld' || k === 'arc') continue; v.forEach((q, i) => { const a = Math.max(...q.opts.filter(o => o.ok).map(o => len(o.t))), b = Math.max(...q.opts.filter(o => !o.ok).map(o => len(o.t))); if (a > b) longest.push(`${k}[${i}] ${String(q.u || q.q).slice(0, 30)}`); }); }
// 残留中文（日语允许汉字，只查简体专用常见字）
const all = ['bank.js', 'chats.js', 'arc.js', 'lv4.js'].filter(f => fs.existsSync(path.join(root, 'i18n', lang, f))).map(f => fs.readFileSync(path.join(root, 'i18n', lang, f), 'utf8')).join('\n').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(豆包|GPT-5 系)"/g, '""');   // 模型鉴定 id 按规定不翻译，不算残留
const zhRe = lang === 'tw' || lang === 'hk' ? /(?!)/g : lang === 'ja' ? /[这个们说为么还没吗吧呢么让对话题时间问题电脑]/g : /[一-鿿]/g;
const leftover = [...new Set((all.match(zhRe) || []))];
console.log(`[${lang}] 结构问题 ${errs.length} 个 · 正确答案最长 ${longest.length} 题 · 残留中文字 ${leftover.length} 个`);
errs.slice(0, 40).forEach(e => console.log('  结构 ' + e));
longest.slice(0, 40).forEach(e => console.log('  最长 ' + e));
if (leftover.length) console.log('  残留：' + leftover.slice(0, 60).join(''));
process.exit(errs.length || longest.length || leftover.length ? 1 : 0);
