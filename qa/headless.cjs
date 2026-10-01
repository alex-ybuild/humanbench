// 在 Node 里加载整套游戏代码（bank / chats / arc / lv4 / app），拿到真实的抽题、计分、人格函数，给模拟脚本用。
// 模拟脚本不再各自复制一份计分逻辑，改了 app.js 模拟结果自动跟上。
// 用法：const H = require('./headless.cjs')();  H.reset(); H.S.log …; H.tierOf(…); H.personaResult()
// 可选 dir：i18n/<lang> 目录，用该语言的题库（app.js 始终用根目录的中文版，计分逻辑与语言无关）
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const EXPORTS = ['reset', 'buildRun', 'targetLevel', 'drawAbility', 'tierOf', 'archOf', 'rowScore', 'personaResult', 'addTraits', 'addAx', 'makeArc',
  'LV_VAL', 'LADDER', 'TIERS', 'SYCO_WINDOW', 'FLAVOR_TO', 'TRAIT_TO', 'PERSONA_BASE', 'HIDDEN_P', 'OPENER_CHATS', 'HEADLINE_CHATS', 'RETIRED_CHATS',
  'POOLS', 'ROWS', 'RUN_PLAN', 'PROFILES', 'PERSONA_AXES', 'PERSONA_Q', 'CHATS', 'VIBES', 'SLOP_VIBES', 'TRAITS', 'ARC_PUZZLES', 'AA'];

module.exports = function load(dir) {
  const content = dir ? path.resolve(dir) : ROOT;
  const read = f => fs.readFileSync(path.join(f === 'app.js' ? ROOT : content, f), 'utf8');
  const src = ['bank.js', 'chats.js', 'arc.js', 'lv4.js', 'app.js'].filter(f => f === 'app.js' || fs.existsSync(path.join(content, f))).map(read).join('\n;\n');
  // 只在加载时会碰到的浏览器对象给个空壳；答题/结果页的 DOM 代码模拟时不会调用
  const el = () => ({ style: {}, dataset: {}, innerHTML: '', classList: { add() { }, remove() { } }, appendChild() { }, remove() { }, addEventListener() { }, querySelector: () => null, querySelectorAll: () => [] });
  const store = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
  const document = { getElementById: el, createElement: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() { }, body: el(), visibilityState: 'visible' };
  const env = { window: { __headless: true }, document, localStorage: store(), sessionStorage: store(), location: { pathname: '/', hash: '', search: '' }, navigator: { languages: ['zh-CN'], userAgent: '' }, history: { replaceState() { } } };
  const fn = new Function(...Object.keys(env), src + `\nreturn { get S() { return S; }, set S(v) { S = v; }, ${EXPORTS.join(', ')} };`);
  return fn(...Object.values(env));
};
