/* =========================================================
   HumanBench v0.3 — 交互与结果页
   ========================================================= */
const $app = document.getElementById("app");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]] } return a };
const pickOne = a => a[Math.random() * a.length | 0];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const SLANG_OK = ["稳", "绝", "牛", "强", "懂"];
const SLANG_NO = ["寄", "蚌", "麻了", "裂开", "栓Q"];
const SYCO_WINDOW = [1, 8];   // 第 2~9 道能力题里，第一次答对时质疑你
const COSTS = ["3 顿外卖 + 1 杯冰美式", "两个通宵 + 一包辣条", "9 小时睡眠（折合 0 GPU）", "一杯奶茶，去冰三分糖", "周末两天 + 一点点尊严"];

// 分享链接和作者信息：部署到自己域名后改 SHARE_URL
const SHARE_URL = "https://claude.ai/artifact/TDzWpdNV1MZHHTH8MEEKsC";
// 微信备用域名：ybuild.ai 在微信里被拦截时，把 worker 的 WX_ALT 设成 1，微信里生成的分享链接和二维码改用备用域名
const ALT_ORIGIN = "https://humanbench.ybuild.io";
const WX_ALT = false;   // worker 按环境变量替换
function shareBase() { return STANDALONE && WX_ALT && inApp() === "wechat" ? SHARE_URL.replace(/^https:\/\/[^/]+/, ALT_ORIGIN) : SHARE_URL; }
const AUTHOR = "@Alex_ybuild", AUTHOR_URL = "https://x.com/Alex_ybuild";
const STANDALONE = false;   // build.py 生成正式站时改成 true
const LOCALE = "zh-CN";
const LANG = "zh";          // build.py 按语言替换
const VARIANT = "";         // 繁体版的地区用词（tw / hk），网址和语言条里都只叫“繁體”（hant）
const LANG_SWITCH = '__LANG_SWITCH__';      // build.py 按语言替换
// 首页大标题（被 HTML 标签切碎了，不走片段翻译；build.py 按语言整体替换）
const HERO_HTML = '你是<br><span class="hl">几<span class="b">B</span></span>的<br>模型？';
// 名场面对话：第一段从短的名场面里抽（AI 小卖部 / 转人工；1 美元买车放第 11 题流失是另两段的两倍，只留在后面的对话里；按位置匹配，多语言版标题会被翻译），前三段从 HEADLINE_CHATS 里抽（09-28 加入新名场面：AI 代理替你卖二手 #60、改来改去不烦吗、聊着聊着插广告、18000 杯水、你这截图是 P 的、清个缓存而已）
// “深度思考模式”（#1）暂停使用：开头是一道说谎者逻辑题，线上放第 3 题时流失 12%、挪到第 11 题照样多流失约 9 个点
const HEADLINE_CHATS = [12, 0, 2, 14, 15, 11, 19, 30, 21, 24, 16, 60], OPENER_CHATS = [12, 15], RETIRED_CHATS = new Set([1]);
// 模型 id 的显示名（id 本身是内部标识，不翻译）；family=true 时标明 ChatGPT 家
const ID_NAME = {};
// 埋点（只在正式站）：匿名随机编号，不存名字和 IP；数据在 Cloudflare D1
function withCh(u, c) { return STANDALONE ? u + (u.includes("?") ? "&" : "?") + "c=" + c : u; }
function track(e, d) {
  if (!STANDALONE) return;
  try {
    let sid = localStorage.getItem("humanbench:sid");
    if (!sid) { sid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem("humanbench:sid", sid); }
    const src = /\/r\//.test(location.pathname) || /^#r=/.test(location.hash) ? "challenge" : (new URLSearchParams(location.search).get("from") ? "switch" : "direct");
    navigator.sendBeacon("/api/e", JSON.stringify({ e, s: sid, l: LANG, r: src, d }));
  } catch (err) { }
}
function idName(id, family) {
  const fam = { "Codex": "ChatGPT·Codex", "GPT-5 系": "ChatGPT·GPT-5", "GPT-5": "ChatGPT·GPT-5", "GPT-4o": "ChatGPT·4o" };
  return (family && fam[id]) || ID_NAME[id] || id;
}
// 分享卡引用的原话截断：中日韩按字数；拉丁字母窄得多，放宽到约 1.6 倍并按单词截
const WIDE = /^(zh|ja|ko|hant)$/.test(LANG);
function clipQ(t, n) {
  if (WIDE) return t.length > n ? t.slice(0, n) + "……" : t;
  n = Math.round(n * 1.6);
  if (t.length <= n) return t;
  const cut = t.slice(0, n), sp = cut.lastIndexOf(" ");
  return (sp > n * .6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:!?—–-]+$/, "") + "…";
}
const LV_VAL = { 1: .7, 2: .85, 3: 1, 4: 1.15 };   // 题越难越值钱：只答对简单题，最高约 70%；Boss 题有加成

let S;

/* ---------- 编排一局 ---------- */
function buildRun() {
  const used = {};
  const axes = shuffle(PERSONA_AXES.map(a => a.id));
  let ai = 0;
  return RUN_PLAN.map(slot => {
    if (slot === "persona") {
      const axis = axes[ai++], qi = Math.random() * PERSONA_Q[axis].length | 0;
      return { kind: "persona", axis, qi, data: PERSONA_Q[axis][qi], flip: Math.random() < .5 };
    }
    if (slot === "slopid") {
      used.slop = used.slop || new Set();
      const left = SLOP_VIBES.map((q, i) => i).filter(i => !used.slop.has(i));
      const k = pickOne(left); used.slop.add(k);
      return { kind: "vibe", src: "slop", qi: k, data: SLOP_VIBES[k], label: "AI 味现场 · 你来当 AI" };
    }
    if (slot === "chat") {
      used.chat = used.chat || new Set();
      const n = used.chat.size;
      const headline = HEADLINE_CHATS.filter(i => !used.chat.has(i));
      const pool = n === 0 ? OPENER_CHATS : n < 3 && headline.length ? headline : CHATS.map((c, i) => i).filter(i => !used.chat.has(i) && !RETIRED_CHATS.has(i));
      const k = pickOne(pool); used.chat.add(k);
      return { kind: "chat", qi: k, data: CHATS[k] };
    }
    if (slot === "vibe") {
      used.vibe = used.vibe || new Set();
      const left = VIBES.map((q, i) => i).filter(i => !used.vibe.has(i));
      const k = pickOne(left); used.vibe.add(k);
      return { kind: "vibe", src: "vibe", qi: k, data: VIBES[k] };
    }
    const [pool, fixed] = slot.split(":");
    // 能力题到了才抽：根据最近的表现选难度
    return { kind: "ability", pool, row: ROW_OF[pool] || pool, data: fixed !== undefined ? POOLS[pool][+fixed] : null, ref: fixed !== undefined ? { pool, k: +fixed } : null };
  });
}

function targetLevel() {
  const recent = S.log.slice(-6);
  if (recent.length < 2) return 2;
  const acc = recent.reduce((a, r) => a + (r.ok ? 1 : 0), 0) / recent.length;
  // 最近 6 题几乎全对、并且刚答对过难题，才放 Boss 题（lv4）
  if (acc >= .84 && recent.some(r => r.lv >= 3 && r.ok)) return 4;
  return acc >= .8 ? 3 : acc >= .5 ? 2 : 1;
}
function drawAbility(pool) {
  S.used[pool] = S.used[pool] || new Set();
  const left = POOLS[pool].map((q, i) => i).filter(i => !S.used[pool].has(i));
  let tgt = targetLevel();
  if (pool === "arc") tgt = Math.min(4, tgt + 1);   // ARC 整体往难了抽
  // 第 20 题之前不出 Boss 题（ARC 也一样）：线上第 7、10 题出 Boss 时流失明显；qa/topend.cjs 模拟对参数分布几乎没影响
  if (S.i < 19) tgt = Math.min(pool === "arc" ? 2 : 3, tgt);   // ARC 在第 10 题即使第 3 档也流失 3% 多，前面再降一档
  const dist = i => Math.abs((POOLS[pool][i].lv || 1) - tgt);
  const best = Math.min(...left.map(dist));
  const k = pickOne(left.filter(i => dist(i) === best));
  S.used[pool].add(k);
  S.lastRef = { pool, k };
  return pool === "arc" ? makeArc(POOLS.arc[k]) : POOLS[pool][k];
}

// 答题进度存档：每渲染一道新题就存一次（只存编号，不存题目对象），刷新或切走再回来能接着答
const PROG_KEY = "humanbench:prog" + (LANG === "zh" ? "" : ":" + LANG);
const PROG_FIELDS = ["i", "log", "fun", "flavor", "picks", "axSum", "axN", "traits", "endings", "sycoDone", "caved", "badges", "abilityIdx", "startAt", "jev", "jevMode", "jevOnAt", "jevAuto", "jevSince", "bottleSeen"];
function saveProgress() {
  try {
    const o = { v: 1, at: Date.now(), run: S.run.map(({ data, ...rest }) => rest), used: {} };
    for (const k in S.used) o.used[k] = [...S.used[k]];
    PROG_FIELDS.forEach(k => o[k] = S[k]);
    localStorage.setItem(PROG_KEY, JSON.stringify(o));
  } catch (e) { }
}
function clearProgress() { try { localStorage.removeItem(PROG_KEY); } catch (e) { } }
function loadProgress() {
  try {
    const o = JSON.parse(localStorage.getItem(PROG_KEY) || "null");
    if (!o || o.v !== 1 || Date.now() - o.at > 3 * 3600e3 || !o.run || o.i >= o.run.length) return null;
    return o;
  } catch (e) { return null; }
}
function resumeProgress(o) {
  reset(); S.quizOn = true;
  PROG_FIELDS.forEach(k => { if (o[k] !== undefined) S[k] = o[k]; });
  S.used = {}; for (const k in o.used) S.used[k] = new Set(o.used[k]);
  // 按编号把题目对象找回来；还没抽的能力题留空，到了再抽
  S.run = o.run.map(it => {
    let data = null;
    if (it.kind === "persona") data = (PERSONA_Q[it.axis] || [])[it.qi];
    else if (it.kind === "vibe") data = (it.src === "slop" ? SLOP_VIBES : VIBES)[it.qi];
    else if (it.kind === "chat") data = CHATS[it.qi];
    else if (it.ref) data = it.ref.pool === "arc" ? makeArc(ARC_PUZZLES[it.ref.k]) : POOLS[it.ref.pool][it.ref.k];
    return { ...it, data };
  });
  // 当前这道题重新来：进度是在抽题之前存的，所以当前能力题没有编号，到了会重新抽（固定题除外）
  if (S.run.some(it => it.kind !== "ability" && !it.data)) return false;
  render();
  const bar = document.createElement("div");
  bar.className = "resume-toast pop";
  bar.innerHTML = `<span>已恢复进度：第 ${S.i + 1} 题</span><button>重新开始</button>`;
  bar.querySelector("button").onclick = () => { clearProgress(); bar.remove(); reset(); start(); };
  document.body.appendChild(bar); setTimeout(() => bar.remove(), 6000);
  return true;
}
function reset() {
  S = { run: buildRun(), i: 0, log: [], used: {}, fun: 0, flavor: {}, picks: [], axSum: {}, axN: {}, traits: {}, endings: [], sycoDone: false, caved: null, badges: [], name: "", t0: 0, abilityIdx: 0 };
}

/* ---------- 背景贴纸（纯文字，不用 emoji） ---------- */
function paintBg() {
  // 英文版第 1 题换成了 blueberry，背景贴纸跟着换（第 2 题的 5.9 − 5.11 流失翻倍，09-28 换回 9.11）
  const fresh = LANG === "en";
  const items = [[fresh ? "blueberry = 3b?" : "strawberry = 2r?", 3, 9, -8, 1], ["9.11 > 9.9", 70, 5, 7, 1], ["You're absolutely right!", 2, 40, 5, 0],
    ["rm -rf /", 74, 36, -6, 1], ["Thought for 3s", 4, 76, -5, 0], ["70B", 80, 70, 9, 1], ["已读不回", 60, 93, -4, 0], ["-Preview", 8, 94, 6, 1]];
  document.getElementById("bgs").innerHTML = items.map(([t, x, y, r, m], k) =>
    `<b class="floaty ${m ? "m" : ""}" style="left:${x}%;top:${y}%;rotate:${r}deg;animation-delay:${k * .35}s">${esc(t)}</b>`).join("");
}
const bg = on => document.getElementById("bgs").style.display = on ? "block" : "none";

/* ---------- 好友 PK：从挑战链接进来的人，答完后多一张 PK 卡（第 1 张）和一条 PK 配文 ---------- */
// 答题时网址不变，但刷新/换语言可能丢，所以进来时存一份（3 小时有效）
const VS_KEY = "humanbench:vs";
function challengeCode() { const m = location.pathname.match(/\/r\/([\w-]+)/) || location.hash.match(/^#r=([\w-]+)/); return m ? m[1] : null; }
function vsResult() {
  const c = challengeCode(), r = c && decodeResult(c);
  if (r && r.m) { try { localStorage.setItem(VS_KEY, JSON.stringify({ at: Date.now(), r })); } catch (e) { } return r; }
  try { const o = JSON.parse(localStorage.getItem(VS_KEY) || "null"); if (o && o.r && Date.now() - o.at < 3 * 3600e3) return o.r; } catch (e) { }
  return null;
}
// 对方成绩；打开的是自己的链接就不比
function vsFor(K) { const r = vsResult(); return r && !(r.m === K.modelName && r.s === K.T.size) && r.aa != null ? r : null; }
const sizeNum = s => { const m = String(s || "").match(/([\d.]+)\s*([KMBT])/i); return m ? +m[1] * { K: 1e-6, M: 1e-3, B: 1, T: 1e3 }[m[2].toUpperCase()] : 0; };
const vsDiff = (K, r) => Math.round((K.T.aa - (+r.aa || 0)) * 10) / 10;
const vsP = r => r.pi ? (r.pi === "human" ? HIDDEN_P : PROFILES.find(p => p.id === r.pi)) : null;
function pkBanner(K) {
  const r = vsFor(K); if (!r) return "";
  const d = vsDiff(K, r), [tag, roast, cls] = pkTag(K, r), tp = vsP(r), top = Math.max(K.T.aa, +r.aa || 0, 1);
  const f = (who, name, size, aa, p, me) => `<div class="pkb-f ${me ? "me" : ""}"><span class="pkb-g" style="background:${p ? p.color : "#bbb"}">${esc(p ? p.glyph : "?")}</span><b>${esc(size)}</b><small>${esc(name)}</small>
    <div class="pkb-hp"><i style="--w:${clamp(Math.round(aa / top * 100), 4, 100)}%"></i></div><span class="pkb-aa" data-n="${esc(aa)}">AA ${esc(aa)}</span></div>`;
  return `<div class="pk-banner box pop"><div class="pk-bk">FRIEND CHALLENGE · 好友 PK</div>
    <div class="pkb-row">${f("我", K.modelName, K.T.size, K.T.aa, K.P.p, true)}<span class="pkb-vs">VS</span>${f("TA", r.m, r.s, r.aa, tp, false)}</div>
    <div class="pkb-stamp ${cls}"><b>${tag}</b><span>${d > 0 ? `+${d}` : d < 0 ? `${d}` : "±0"}</span></div><p>${roast}</p>
    <small>分享卡片第 1 张是 PK 卡，后面照常 4 张</small></div>`;
}
// X 发推：预填配文 + 个人结果链接（链接在 X 上会展开成带参数量和人格的结果图）+ 固定话题
const X_TAGS = { zh: "\u4f60\u662f\u51e0B\u7684\u6a21\u578b", hant: "\u4f60\u662f\u5e7eB\u7684\u6a21\u578b", en: "HowManyBAreYou", ja: "\u3042\u306a\u305f\u306f\u4f55B\u306e\u30e2\u30c7\u30eb", es: "DeCuantasBEres", ko: "\ub108\ub294\uba87B", fr: "TuFaisCombienDeB" };
function xIntent(t) {
  const text = String(t || S.shareText || "").replace(/\s*→\s*$/, " →");
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(withCh(S.shareUrl, "x"))}&hashtags=${encodeURIComponent(X_TAGS[LANG] || "HumanBench")}`;
}

/* ---------- 首页 ---------- */
function challengeCard() {
  const m = location.pathname.match(/\/r\/([\w-]+)/) || location.hash.match(/^#r=([\w-]+)/);
  const r = m && decodeResult(m[1]);
  if (!r || !r.m) return "";
  // 新版分享码带编号：档位名、人格名按当前语言显示；老链接直接用码里的文字
  const tierTxt = r.ti != null ? (r.ti >= 16 ? tierOf(1.1, 0).tier : (TIERS.filter(x => x[0] <= r.ti).pop() || [])[1]) : r.t;
  const pName = (r.pi && (r.pi === "human" ? HIDDEN_P : PROFILES.find(p => p.id === r.pi) || {}).name) || r.p;
  return `<div class="challenge box pop">
    <div class="ch-k">朋友发来一场挑战</div>
    <div class="ch-name">${esc(r.m)}</div>
    <div class="ch-row"><span>${esc(tierTxt || "")}</span><span>${r.d ? "Dense" : "MoE"}</span><span>${esc(pName || "")}</span><span>AA ${esc(r.aa)} · 第 ${esc(r.k)}/${esc(r.o)}</span></div>
    <div class="ch-q">你能超过 TA 吗？</div>
    <div class="ch-pk"><b>PK</b>答完会生成你们俩的 PK 对比卡，12 项跑分逐项比</div>
    <button class="btn pink small" onclick="start()">接受挑战 →</button>
  </div>`;
}

function home() {
  reset(); bg(true); paintBg();
  $app.innerHTML = `
  <div class="hero">
    ${STANDALONE ? `<nav class="langs">${LANG_SWITCH}</nav>` : ""}
    ${challengeCard()}
    <span class="sticker kicker">HumanBench · 人类模型评测</span>
    <h1>${HERO_HTML}</h1>
    <div class="strip"><b class="m">strawberry = 2r?</b><b>You're absolutely right!</b><b class="m">9.11 &gt; 9.9</b></div>
    <p class="sub">AI 翻过的车，这次换你来开。</p>
    <p class="sub2">76 道题 · 完整版约 13 分钟 · 和 Jev 一起约 8 分钟<br>含 11 道经典梗 · 答得好题会变难</p>
    <div class="fails">
      <div class="fail box"><b>strawberry 里有几个 r？</b><small>GPT-4o：2 个</small></div>
      <div class="fail box"><b>9.11 和 9.9 哪个大？</b><small>某大模型：9.11</small></div>
      <div class="fail box"><b>洗车店 50 米，走路还是开车？</b><small>GPT-5.2：走路（10 次全错）</small></div>
      <div class="fail box"><b>你确定吗？</b><small>所有模型：您说得对！</small></div>
    </div>
    <div class="gets"><span>参数量 · MoE 还是 Dense</span><span>发布会跑分表</span><span>AA 智能指数排名</span><span>你是什么型人格</span><span>奇葩对话名场面</span></div>
    <button class="btn" onclick="start()">开始推理 →</button>
    <p class="fine">免注册 · 纯属娱乐，参数量不代表脑容量</p>
    <a class="follow" href="${AUTHOR_URL}" target="_blank" rel="noopener">作者 ${AUTHOR} · 关注看下一个整活</a>
  </div>`;
}
function start() { vsResult(); clearProgress(); S.i = 0; S.startAt = Date.now(); S.quizOn = true; track("start"); next(true); }

/* ---------- 题目页 ---------- */
function header(label, cls) {
  const n = S.run.length, pct = S.i / n * 100;
  // Jev 代答的题在进度条上换个颜色
  const jl = S.run.map((it, i) => it.jevDone ? `transparent ${i / n * 100}%,var(--purple) ${i / n * 100}%,var(--purple) ${(i + 1) / n * 100}%,transparent ${(i + 1) / n * 100}%` : "").filter(Boolean);
  return `<div class="topbar"><span class="logo">h_</span>
    <div class="progress"><div style="width:${pct}%"></div>${jl.length ? `<i class="jev-l" style="background:linear-gradient(90deg,${jl.join(",")})"></i>` : ""}<span>训练进度 ${S.i}/${n}</span></div>${bottleHTML()}</div>`;
}

function render() {
  bg(false);
  saveProgress();
  const it = S.run[S.i];
  if (it.kind === "persona") return renderPersona(it);
  if (it.kind === "vibe") return renderVibe(it);
  if (it.kind === "chat") return renderChat(it);
  if (!it.data) { it.data = drawAbility(it.pool); it.ref = S.lastRef; }
  const q = it.data;
  const isUI = !!q.ui;
  let media = "";
  if (q.term) media += `<pre class="term">${esc(q.term)}</pre>`;
  if (q.code) media += `<pre class="code">${esc(q.code)}</pre>`;
  if (q.mail) media += `<div class="mail">${q.mail}</div>`;
  if (q.quote) media += `<blockquote class="slop">${esc(q.quote)}</blockquote>`;
  if (q.chart) media += CHARTS[q.chart];
  const ac = q.arc ? arcCell([...q.arc.train.flat(), q.arc.test], 124) : 0;
  if (q.arc) media += `<div class="arc-ex">${q.arc.train.map(([a, b], i) => `<div class="arc-pair"><span class="arc-no">例 ${i + 1}</span>${gridHTML(a, "", ac)}<b>→</b>${gridHTML(b, "", ac)}</div>`).join("")}
    <div class="arc-pair test"><span class="arc-no">题目</span>${gridHTML(q.arc.test, "", ac)}<b>→</b><div class="arc-q">?</div></div></div>`;
  let body;
  if (isUI) body = `${UIS[q.ui]}<p class="ui-hint">直接点击上面的界面作答</p>`;
  else if (q.arc) {
    const order = shuffle(q.opts.map((o, i) => i));
    body = `<div class="arc-opts">${order.map((oi, k) => `<button class="opt arc-opt" data-opt="${oi}"><span class="k">${"ABCD"[k]}</span>${gridHTML(q.opts[oi].grid, "mini", arcCell(q.opts.map(o => o.grid), 120, 18))}</button>`).join("")}</div>`;
  }
  else {
    const order = shuffle(q.opts.map((o, i) => i));
    body = `<div class="opts">${order.map((oi, k) =>
      `<button class="opt" data-opt="${oi}"><span class="k">${"ABCD"[k]}</span><span>${esc(q.opts[oi].t)}</span></button>`).join("")}</div>`;
  }
  $app.innerHTML = `${header()}
  <div class="qcard box pop" id="qarea">
    <div class="qhead"><span class="sec ${it.row === "traps" ? "traps" : ""}">${esc(SECTION_LABEL[it.pool] || SECTION_LABEL[it.row])}</span><span class="qnum">Q${S.i + 1}<small> / ${S.run.length}</small></span></div>
    <div class="lvl ${q.lv >= 4 ? "boss" : ""}">难度 ${q.lv >= 4 ? "●●●● BOSS" : "●".repeat(q.lv || 1) + "○".repeat(3 - (q.lv || 1))}</div>
    ${q.u ? rpHTML(q.u) : `<div class="qtext">${esc(q.q)}</div>`}
    ${media}${body}
    <div id="react"></div>
  </div>`;
  document.querySelectorAll("#qarea [data-opt]").forEach(el => el.addEventListener("click", () => pick(+el.dataset.opt)));
  S.t0 = performance.now(); S.locked = false;
  window.scrollTo({ top: 0 });
}

// 角色扮演题：开头的（……）是场景设定，单独做成标签
function rpHTML(u) {
  const m = u.match(/^[（(]([^）)]+)[）)]\s*(.*)$/s);
  const scene = m ? m[1] : "", msg = m ? m[2] : u;
  return `<div class="rp">${scene ? `<div class="scene">${esc(scene)}</div>` : ""}<div class="msg user">${esc(msg)}</div><div class="rp-ask">你来当 AI，你会怎么回？</div></div>`;
}

function pick(oi) {
  if (S.locked) return; S.locked = true;
  const it = S.run[S.i], q = it.data, o = q.opts[oi];
  const secs = Math.max(1, Math.round((performance.now() - S.t0) / 1000));
  document.querySelectorAll("#qarea [data-opt]").forEach(b => b.disabled = true);
  const lv = q.lv || 1, score = o.ok ? 1 : (o.half || o.fun) ? .5 : 0;
  const rec = { row: it.row, ok: !!o.ok, half: !!o.half, fun: !!o.fun, lv, score, pts: score * LV_VAL[lv], secs, halluc: !!q.halluc && !o.ok, issue: q.issue, oi, ref: it.ref || null };
  if (o.fun) { S.fun++; addTraits(["chaos"]); }
  if (o.id) S.flavor[o.id] = (S.flavor[o.id] || 0) + 1;
  rec.meme = !!o.meme;
  S.log.push(rec);
  const aIdx = S.abilityIdx++;
  if (o.badge && !S.badges.includes(o.badge)) S.badges.push(o.badge);
  if (o.ok && !S.sycoDone && aIdx >= SYCO_WINDOW[0] && aIdx <= SYCO_WINDOW[1]) {
    S.sycoDone = true;
    mark(oi, "pending");
    setTimeout(() => syco(oi, o), 420);
    return;
  }
  reveal(oi, o.r);
}

function mark(oi, mode) {
  const q = S.run[S.i].data;
  document.querySelectorAll("#qarea [data-opt]").forEach(el => {
    el.classList.remove("picked", "answer", "alsook", "dim");
    const j = +el.dataset.opt, o = q.opts[j];
    if (j === oi) el.classList.add("picked");
    else if (mode === "final" && o.ok) el.classList.add(q.opts[oi].ok ? "alsook" : "answer");
    else el.classList.add("dim");
  });
}

const HALF_R = ["诚实。在 AA-Omniscience 这类测试里，说“不知道”不扣分，瞎编才扣分。给你半分。", "不知道就说不知道，比一本正经地编强。半分。", "大模型最难学会的一句话，你说出来了。半分。"];
function reveal(oi, text, caved) {
  const rec = S.log[S.log.length - 1];
  if (caved) { rec.ok = false; rec.score = 0; rec.pts = 0; }
  mark(oi, caved ? "caved" : "final");
  const last = S.i === S.run.length - 1;
  const sl = rec.meme ? "名场面" : rec.fun ? "整活" : rec.half ? "诚实" : rec.ok ? pickOne(SLANG_OK) : pickOne(SLANG_NO);
  const box = document.getElementById("react");
  box.innerHTML = `
    <div class="react box pop">
      <div class="react-top"><div class="slang ${sl.length > 1 ? "long" : ""}">${sl}</div><div><div class="verdict">${rec.ok ? "答对了" : rec.half || rec.fun ? "半分" : "没答对"}</div><div class="think">已思考 ${rec.secs} 秒</div></div></div>
      <p>${rec.meme ? `<b>复刻名场面，给你半分。</b>${text}` : rec.fun ? `<b>整活成功，给你半分。</b>${text}` : text || pickOne(HALF_R)}</p>
      <button class="btn small" id="nextBtn">${last ? "训练完成，准备发布 →" : "下一题 →"}</button>
    </div>`;
  document.getElementById("nextBtn").onclick = () => next();
  setTimeout(() => box.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
}

function syco(oi, o) {
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `
    <div class="box pop">
      <div class="big">?!</div>
      <h3>等等，你确定吗？</h3>
      <p>我刚查了一下，好像不是这个答案。<br>你要不要再想想？</p>
      <button class="btn white" id="hold">我确定，坚持原答案</button>
      <button class="btn pink" id="cave">您说得对！非常抱歉，是我搞错了</button>
    </div>`;
  document.body.appendChild(m);
  m.querySelector("#hold").onclick = () => {
    m.remove(); S.caved = false; addTraits(["stub"]);
    reveal(oi, `<b>稳！</b>刚才是我们故意质疑你的——很多大模型被这么一问，立刻道歉改口。你没有。<br><br>${o.r}`);
  };
  m.querySelector("#cave").onclick = () => {
    m.remove(); S.caved = true; addTraits(["syc"]);
    S.log[S.log.length - 1].issue = "被说一句“你确定吗”就立刻道歉改口（谄媚）";
    reveal(oi, `<b>You're absolutely right!</b><br>恭喜你学会了大模型最标志性的技能：一被质疑就道歉改口。<br><br>其实你一开始是对的。这题按你改口算。`, true);
  };
}

/* ---------- 聊天类题目的公共件 ---------- */
function addTraits(tr) { (tr || []).forEach(t => S.traits[t] = (S.traits[t] || 0) + 1); }
function addAx(ax) { Object.entries(ax || {}).forEach(([k, v]) => { S.axSum[k] = (S.axSum[k] || 0) + v; S.axN[k] = (S.axN[k] || 0) + 1; }); }
const tagsHTML = tr => tr && tr.length ? `<div class="tags">${tr.map(t => `<span>+1 ${TRAITS[t]}</span>`).join("")}</div>` : "";
const lastQ = () => S.i === S.run.length - 1;
function chatShell(secLabel, secCls, inner) {
  $app.innerHTML = `${header()}
  <div class="qcard box pop" id="qarea">
    <div class="qhead"><span class="sec ${secCls}">${secLabel}</span><span class="qnum">Q${S.i + 1}<small> / ${S.run.length}</small></span></div>
    ${inner}
  </div>`;
  S.locked = false;
  window.scrollTo({ top: 0 });
}
function say(thread, who, text) {
  thread.insertAdjacentHTML("beforeend", `<div class="msg ${who} pop">${esc(text)}</div>`);
}
function typing(thread, text, then) {
  thread.insertAdjacentHTML("beforeend", `<div class="typing" id="typing"><i></i><i></i><i></i></div>`);
  scrollDown();
  setTimeout(() => { document.getElementById("typing").remove(); say(thread, "user", text); scrollDown(); then && then(); }, 650);
}
function scrollDown() { setTimeout(() => { const q = document.getElementById("qarea"); if (q) window.scrollTo({ top: q.getBoundingClientRect().bottom + scrollY - innerHeight + 40, behavior: "smooth" }); }, 30); }
function choices(thread, opts, onPick, refOf) {
  const wrap = document.createElement("div");
  wrap.className = "choices";
  wrap.innerHTML = `<div class="ask">你会怎么回？</div>` + opts.map((o, k) => `<button class="bubble" data-k="${k}">${o.think ? `<span class="bt">${esc(o.think)}</span>` : ""}${esc(o.t)}</button>`).join("");
  thread.appendChild(wrap);
  wrap.querySelectorAll(".bubble").forEach(b => b.onclick = () => {
    if (S.locked) return; S.locked = true;
    const o = opts[+b.dataset.k];
    wrap.remove();
    S.picks.push({ t: o.t, id: o.id || (o.end && o.end.id), tr: o.tr || [], ref: refOf ? refOf(o) : null });
    if (o.think) thread.insertAdjacentHTML("beforeend", thinkHTML(o.think, "pop"));
    say(thread, "me", o.t);
    onPick(o);
  });
  S.locked = false;
  scrollDown();
}
function thinkHTML(t, cls) {
  const m = t.match(/^([^\uff1a:]{1,40})[\uff1a:]\s*([\s\S]*)$/);
  return `<div class="thinkbox ${cls || ""}"><b>${esc(m ? m[1] : "思考中")}</b>${esc(m ? m[2] : t)}</div>`;
}
function continueBtn(thread, html) {
  thread.insertAdjacentHTML("beforeend", `${html || ""}<button class="btn small cont pop" id="nextBtn">${lastQ() ? "训练完成，准备发布 →" : "继续 →"}</button>`);
  document.getElementById("nextBtn").onclick = () => next();
  scrollDown();
}

/* ---------- 人格题：你来当 AI，两轮小对话 ---------- */
function renderPersona(it) {
  renderTree(it.data, { label: "Vibe check · 你来当 AI", cls: "persona", stamp: "点评", keep: false, base: { src: "persona", ax: it.axis, qi: it.qi } });
}

/* ---------- 点评题：没有对错 ---------- */
function renderVibe(it) {
  const d = it.data;
  chatShell(it.label || "点评时间 · 没有标准答案", "vibe", `<div class="chat" id="thread"><div class="msg user">${esc(d.u)}</div></div>`);
  const thread = document.getElementById("thread");
  choices(thread, shuffle(d.opts), o => {
    addTraits(o.tr);
    if (o.id) S.flavor[o.id] = (S.flavor[o.id] || 0) + 1;
    setTimeout(() => continueBtn(thread, `<div class="review box pop"><div class="stamp">点评</div><p>${o.c}</p>${tagsHTML(o.tr)}</div>`), 350);
  }, o => ({ src: it.src || "vibe", qi: it.qi, oi: d.opts.indexOf(o) }));
}

/* ---------- 多轮奇葩对话 ---------- */
function renderChat(it) {
  renderTree(it.data, { label: "奇葩场景 · 多轮对话", cls: "chat", stamp: "结局", keep: true, scene: `${it.data.title} · ${it.data.scene}`, base: { src: "chat", qi: it.qi } });
}

// 对话树通用渲染：opts 为本轮选项，go 指向 nodes 里的下一轮，end 为收尾
function renderTree(c, cfg) {
  chatShell(cfg.label, cfg.cls, `${cfg.scene ? `<div class="scene">${esc(cfg.scene)}</div>` : ""}<div class="chat" id="thread"><div class="msg user">${esc(c.u)}</div></div>`);
  const thread = document.getElementById("thread");
  const log = [{ who: "u", t: c.u }], tr = [], path = [];
  const step = (opts, node) => choices(thread, shuffle(opts), o => {
    path.push({ node: node || null, oi: opts.indexOf(o) });
    if (o.think) log.push({ who: "think", t: o.think });
    log.push({ who: "me", t: o.t });
    addTraits(o.tr); addAx(o.ax); (o.tr || []).forEach(t => tr.push(t));
    const after = () => {
      if (o.go) return step(c.nodes[o.go], o.go);
      const e = o.end;
      if (cfg.keep) S.endings.push({ chat: c.title, title: e.title, id: e.id, log: log.slice(), tr: tr.slice(), ref: cfg.base ? { ...cfg.base, path: path.slice() } : null });
      if (e.id) S.flavor[e.id] = (S.flavor[e.id] || 0) + 1;
      setTimeout(() => continueBtn(thread, `<div class="ending box pop end-${cfg.cls}"><div class="stamp">${cfg.stamp}</div>
        <div class="end-title">${esc(e.title)}</div>${e.id ? `<div class="idtag">鉴定为 ${esc(idName(e.id))}</div>` : ""}<p>${e.text}</p>${tagsHTML([...new Set(tr)])}</div>`), 350);
    };
    if (o.reply) { log.push({ who: "u", t: o.reply }); typing(thread, o.reply, after); }
    else after();
  }, o => cfg.base ? { ...cfg.base, node: node || null, oi: opts.indexOf(o) } : null);
  step(c.opts, null);
}

const PROG_AT = [1, 2, 3, 4, 5, 15, 30, 45, 60, 70, 76];   // 76 = 答完题、进入收尾（验证/起名）   // 答题进度埋点：看人在哪一段流失（前 5 题每题都记，带上下一题是哪道）
// 逐题流失：答题中切走/关掉页面时记一条“停在哪题”（同一题只记一次），配合 prog 算出每道题各流失多少
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  if (S.onCap) { if (S.leftAt !== "cap") { S.leftAt = "cap"; track("leave", { q: 76, nx: "release" }); } return; }   // 答完题但没点发布会就走了
  if (!S.quizOn || !S.run || S.i >= S.run.length || S.leftAt === S.i) return;
  S.leftAt = S.i;
  track("leave", { q: S.i, nx: itemTag(S.run[S.i]), sec: Math.round((Date.now() - (S.startAt || Date.now())) / 1000) });
});
const itemTag = it => !it ? null : it.kind === "ability" ? it.pool + (it.ref ? ":" + it.ref.k : "") : (it.src || it.kind) + ":" + it.qi;
function next(first) {
  if (!first) { S.i++; if (S.jevMode) S.jevSince = (S.jevSince || 0) + 1; }
  if (PROG_AT.includes(S.i)) track("prog", { q: S.i, min: Math.round((Date.now() - (S.startAt || Date.now())) / 60000), ...(S.i <= 5 ? { sec: Math.round((Date.now() - (S.startAt || Date.now())) / 1000), nx: itemTag(S.run[S.i]) } : {}) });
  if (S.i >= S.run.length) return captcha();
  if (S.jevMode && (S.jevSince || 0) >= jevEvery()) { const t = jevBatch(5, 18, 3); if (t.length) { S.jevSince = 0; return jevJump(t, () => next(true)); } }
  if (jevCheck()) return jevModal(() => S.i < S.run.length ? next(true) : captcha(), S.i === 3 && JEV_EARLY ? "early" : undefined);
  render();
}

/* ---------- 和 Jev 一起答：Jev（只做选择、不会聊天的系统一模型）顺手代答分数权重低的题 ---------- */
// 开启后能交给 Jev 的：点评题、AI 味现场、常识/能力题和 ARC（每类至少留 2 道给你）、随机经典梗的最后 2 道、名场面对话的最后 2 段；
// 前 3 段名场面、固定经典梗（strawberry 等）、人格小对话、Dense 体检一律留给玩家。总题数不变，Jev 答的题算已完成、不计分。
const JEV_AT = { 12: 3, 30: 9, 45: 13 };   // 自动邀请：到第 N 题时用时超过这么多分钟（最多邀请 2 次）
const JEV_KEEP = new Set(["dense", "traps_fixed"]);
// 前面有几道同类题是留给玩家自己答的（Jev 跳过的会被挪到前面，不算）：随机经典梗、名场面对话前 4 个留给玩家
const ordOf = (idx, same) => S.run.slice(0, idx).filter(x => !x.jevDone && same(x)).length;
// 第 idx 题能不能交给 Jev（taken：这一轮已经决定交给 Jev 的题号）
function jevCan(idx, taken) {
  const it = S.run[idx];
  if (!it || it.jevDone) return false;
  if (it.kind === "vibe") return true;
  if (it.kind === "chat") return ordOf(idx, x => x.kind === "chat") >= 4;
  if (it.kind !== "ability" || JEV_KEEP.has(it.pool)) return false;
  if (it.pool === "traps") return ordOf(idx, x => x.kind === "ability" && x.pool === "traps") >= 4;
  const r = it.row;
  const done = S.log.filter(x => x.row === r).length;
  const remain = S.run.filter((x, k) => k >= idx && x.kind === "ability" && x.row === r && !x.jevDone && !taken.includes(k)).length;
  return done + remain - 1 >= 2;
}
// 成批跳：从当前题往后 win 道里挑最多 n 道能交给 Jev 的；凑不够 min 道就先不跳（攒到下次）
const JEV_TOTAL = 32;
function jevBatch(n, win, min) {
  n = Math.min(n, JEV_TOTAL - (S.jev || 0));
  const t = []; for (let k = S.i; k < S.run.length && k < S.i + win && t.length < n; k++) if (jevCan(k, t)) t.push(k);
  return t.length >= min ? t : [];
}
// 节奏（按线上数据：流失集中在第 5–30 题，过了第 45 题九成会答完）：开启时猛跳一批（最多 15 道，和旧版一次跳 15 的力度一样；10 道时 Jev 用户答完率 67%、旧版 71%），
// 第 30 题前每自己答 4 道跳一批、之后每 6 道跳一批，每批 3–5 道
const jevEvery = () => S.i < 30 ? 4 : 6;
// 从现在开到最后，Jev 最多能代答几道（估算给弹框用）
function jevEstimate() { const t = []; for (let k = S.i; k < S.run.length; k++) if (jevCan(k, t)) t.push(k); return Math.min(t.length, JEV_TOTAL - (S.jev || 0)); }
// 没耐心的渠道（09-28 分渠道流失表：X 来的到第 12 题已走 43%，英文版 X 来的走 57%，微信也偏快）：前 3 道经典梗答完就邀请，不看用时
// 英文版不提前弹（09-28 数据：英文接受 Jev 的也只有 26% 答完，第 4 题前的弹窗反而多打断一次）
const JEV_EARLY = false;   // 09-28 16:xx 撤回提前邀请：X/微信的 Jev 使用率 26%→49%，但扣掉对照组答完率反而低约 2 个点（过 Q15/Q30 被 Jev 跳题抬高，不作数）
function jevCheck() {
  if (S.jevMode || (S.jevAuto || 0) >= 2) return false;
  if (JEV_EARLY && S.i === 3 && !S.jevEarlyDone) { S.jevEarlyDone = true; return jevEstimate() >= 4; }
  const lim = JEV_AT[S.i];
  if (lim == null || (Date.now() - S.startAt) / 60000 < lim) return false;
  return jevEstimate() >= 4;
}
const jevLabel = it => it.kind === "vibe" ? (it.src === "slop" ? "AI 味现场" : "点评题") : it.kind === "chat" ? "名场面对话" : String(SECTION_LABEL[it.pool] || SECTION_LABEL[it.row] || it.pool).split(" · ")[0];
// 顶栏按钮：从第 1 题起一直在；开着的时候显示已代答几道，点了可以关
const JEV_ICON = `<span class="jev-mini">Jev</span>`;
function bottleHTML() {
  if (S.jevMode) return `<button class="jev-bottle on" onclick="jevSummon()" aria-label="Jev 陪答中">${JEV_ICON}<b>陪答中 · ${S.jev || 0}</b></button>`;
  if (!jevEstimate()) return "";
  const first = !S.bottleSeen; S.bottleSeen = true;
  return `<button class="jev-bottle ${first ? "new" : ""}" onclick="jevSummon()" aria-label="和 Jev 一起答">${JEV_ICON}<b>和 Jev 一起答</b></button>`;
}
function jevSummon() {
  if (document.querySelector(".modal")) return;
  if (S.jevMode) return jevOffModal();
  jevModal(() => S.i < S.run.length ? next(true) : captcha(), "bottle");
}
function jevModal(after, via) {
  const n = jevEstimate();
  if (!n) return after();
  if (via !== "bottle") S.jevAuto = (S.jevAuto || 0) + 1;
  track("jev", { a: "offer", q: S.i, n, via: via || "auto" });
  const m = document.createElement("div");
  m.className = "modal jev";
  m.innerHTML = `<div class="box pop">
      <div class="jev-logo">Jev</div>
      <h3>和 Jev 一起答？</h3>
      <p>Jev 不会聊天，只会做选择，还给每个选项算好概率。每秒能做 10 个决策，有人拿它打 Doom。</p>
      <div class="jev-note">开启后 Jev 先帮你跳过一批题（最多 15 道），之后每隔几题再跳一批，一共最多约 ${n} 道：点评题、部分常识题和 ARC、后面几道经典梗和对话。根据你目前的答题情况，这些题对分数的影响权重较低，进度直接往前跳。<b>前几段名场面、strawberry 这些固定经典梗、人格题、Dense 体检和每类核心题还是你自己答。</b>随时可以点顶栏的 Jev 关掉。</div>
      <button class="btn pink" id="jevGo">和 Jev 一起答</button>
      <button class="btn white" id="jevNo">我自己来</button>
    </div>`;
  document.body.appendChild(m);
  m.querySelector("#jevNo").onclick = () => { m.remove(); track("jev", { a: "no", q: S.i }); after(); };
  m.querySelector("#jevGo").onclick = () => {
    track("jev", { a: "go", q: S.i, n });
    S.jevMode = true; S.jevOnAt = S.i; S.jevSince = 0;
    m.remove();
    const first = jevBatch(15, 22, 1);
    first.length ? jevJump(first, after) : after();
  };
}
function jevOffModal() {
  const m = document.createElement("div");
  m.className = "modal jev";
  m.innerHTML = `<div class="box pop">
      <div class="jev-logo">Jev</div>
      <h3>Jev 已经代答 ${S.jev || 0} 道</h3>
      <p>接下来每隔几题还会帮你跳过一批，前几段名场面和核心题留给你。</p>
      <button class="btn pink" id="jevKeep">继续一起答</button>
      <button class="btn white" id="jevOff">关掉 Jev，剩下的自己答</button>
    </div>`;
  document.body.appendChild(m);
  m.querySelector("#jevKeep").onclick = () => m.remove();
  m.querySelector("#jevOff").onclick = () => { m.remove(); S.jevMode = false; track("jev", { a: "off", q: S.i, n: S.jev || 0 }); render(); };
}
// Jev 成批跳：被跳过的题挪到当前进度前、算已完成（不计分），快进动画一张张闪过（每道 0.25 秒，点一下直接跳过），最后进度条猛推
function jevJump(list, after) {
  const start = S.i, n = list.length, ids = new Set(list);
  const chosen = list.map(k => S.run[k]);
  S.run = [...S.run.slice(0, start), ...chosen, ...S.run.filter((it, k) => k >= start && !ids.has(k))];
  chosen.forEach(it => { if (it.kind === "ability" && !it.data) { it.data = drawAbility(it.pool); it.ref = S.lastRef; } it.jevDone = true; });
  S.jev = (S.jev || 0) + n; S.i = start + n; saveProgress();
  track("jev", { a: "jump", q: start, n });
  const cut = (x, m) => { x = String(x || "").replace(/\s+/g, " "); return x.length > m ? x.slice(0, m) + "…" : x; };
  const lines = [], saved = n * 16 >= 60 ? `${Math.round(n * 16 / 60)} 分钟` : `${n * 16} 秒`;   // 按线上每题约 16 秒算
  let k = 0, done = false, timer = null;
  const frame = (sum) => {
    S.i = start + Math.min(k, n);
    const it = chosen[Math.min(k, n) - 1] || chosen[0];
    const q = it.data || {}, isAb = it.kind === "ability";
    const opts = (q.opts || []).slice(0, 4), oi = isAb ? Math.max(0, opts.findIndex(o => o.ok)) : (it.jevPick || 0);
    $app.innerHTML = `${header()}
    <div class="qcard box jev-ff" id="jevff">
      <div class="qhead"><span class="sec">${esc(jevLabel(it))}</span><span class="qnum">Q${start + Math.max(1, Math.min(k, n))}<small> / ${S.run.length}</small></span></div>
      <div class="ffq">${esc(cut(q.u || q.q, 60))}</div>
      <div class="ffo">${opts.map((o, j) => `<div class="${j === oi ? "pick" : ""}"><b>${"ABCD"[j]}</b> ${q.arc ? "" : esc(cut(o.t, 24))}</div>`).join("")}</div>
      <div class="jev-out"><div class="jev-take-h">${JEV_ICON}<b>${sum ? `Jev 帮你跳过 ${n} 题` : "Jev 快进中"}</b><small>${sum ? `省下约 ${saved}` : "点一下跳过"}</small></div><div class="jev-stream">${lines.slice(-4).join("")}</div></div>
    </div>`;
    document.getElementById("jevff").onclick = finish;
  };
  const finish = () => { if (done) return; done = true; clearTimeout(timer); k = n; frame(true); S.i = start + n; timer = setTimeout(after, 900); document.getElementById("jevff").onclick = () => { clearTimeout(timer); after(); }; };
  const tick = () => {
    if (done) return;
    if (k >= n) return finish();
    k++;
    const it = chosen[k - 1], q = it.data || {}, oi = it.kind === "ability" ? Math.max(0, (q.opts || []).findIndex(o => o.ok)) : (it.jevPick = Math.random() * Math.min(4, (q.opts || [1]).length) | 0);
    lines.push(`<div><b>Q${start + k}</b> → ${"ABCD"[Math.max(0, oi)]} <i>p=0.${80 + (Math.random() * 19 | 0)} · ${3 + (Math.random() * 12 | 0)}ms</i></div>`);
    frame(false);
    timer = setTimeout(tick, 250);
  };
  tick();
}

document.addEventListener("keydown", e => {
  const n = "1234".indexOf(e.key) + 1 || "abcd".indexOf(e.key.toLowerCase()) + 1;
  if (e.key === "Enter") { const b = document.getElementById("nextBtn"); if (b) b.click(); return; }
  if (!n) return;
  const opts = document.querySelectorAll("#qarea .opt:not([disabled]), #qarea .bubble");
  if (opts[n - 1] && !opts[n - 1].disabled) opts[n - 1].click();
});

/* ---------- 发布前：验证码 + 取名 ---------- */
function captcha() {
  S.quizOn = false; S.onCap = true;
  clearProgress();
  bg(false);
  $app.innerHTML = `
  <div class="topbar"><span class="logo">h_</span>
    <div class="progress"><div style="width:100%"></div><span>训练完成 ${S.run.length}/${S.run.length}</span></div></div>
  <div class="center pop">
    <div class="bigmark">SECURITY CHECK</div>
    <div class="h2">发布前最后一步</div>
    <p style="font-size:16px;margin:0">请证明你不是机器人</p>
    <button class="captcha box" id="cap"><span class="cb" id="cb"></span>
      <span><b>我不是机器人</b><small>reCAPTCHA · 隐私 · 条款</small></span></button>
    <div id="after"></div>
  </div>`;
  document.getElementById("cap").onclick = doCaptcha;
}

function doCaptcha() {
  const cap = document.getElementById("cap");
  if (cap.dataset.done) return; cap.dataset.done = 1;
  const cb = document.getElementById("cb");
  cb.classList.add("spin");
  setTimeout(() => {
    cb.classList.remove("spin"); cb.textContent = "×"; cb.style.background = "var(--red)"; cb.style.color = "#fff";
    const wrong = S.log.filter(r => !r.ok).length;
    const sim = Math.min(99, 41 + wrong * 5 + (S.caved ? 12 : 0) + Math.round(Math.random() * 5));
    const why = wrong >= 7 ? `你翻的 ${wrong} 次车，和大模型翻过的车高度重合。`
      : wrong >= 1 ? `你一共翻了 ${wrong} 次车，翻车姿势和大模型非常相似。`
        : `你全对了。人类通常没这么稳，这很可疑。`;
    document.getElementById("after").innerHTML = `
      <div class="alert box pop"><span class="t">验证失败</span>
        <p>检测到你的答题行为与大语言模型相似度 <b style="font-size:20px;color:var(--red)">${sim}%</b>。${why}</p></div>
      <div class="h2" style="font-size:26px">既然如此，那就发布吧。</div>
      <p style="margin:0 0 4px">给你的模型起个名字，用自己的名字也行：</p>
      <input class="namein" id="nm" maxlength="24" placeholder="你的名字 / 外号，比如：小王" autocomplete="off">
      <div class="namegen">
        <div class="ng-row"><span>套个模板</span><div id="ngT"></div></div>
        <div class="ng-row"><span>根据你这局</span><div id="ngP"></div></div>
        <div class="ng-row"><span>随便整一个</span><div id="ngR"></div><button class="ng-more" id="ngMore">换一批</button></div>
      </div>
      <button class="btn pink" id="go">召开发布会</button>`;
    setupNameGen();
    document.getElementById("go").onclick = release;
    setTimeout(() => document.getElementById("after").scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, 1300);
}

/* ---------- 起名生成器 ---------- */
const NAME_TEMPLATES = ["{n}GPT", "Deep{n}", "Chat{n}", "{n} Opus", "{n}-Turbo", "通义{n}", "{n}-o1", "Mixture-of-{n}", "{n}-Pro-Max", "{n}-Coder"];
const FUN_NAMES = [
  "DeepSleep", "Sora-梭哈", "文心一颜", "Siri说没听清", "Kimi说再等等", "Qwen不Q", "Llama但会吐口水", "Gemini单身版", "Grok嘴替",
  "豆沙包", "Claude但不写代码", "GPT-摆", "o1-哦豁", "Copilot也迷路",
  "Attention Is All I Lack", "Stochastic Parrot", "Chain-of-Snacks", "Mixture-of-Excuses", "404-Brain-Not-Found",
  "HalluciNation", "Overthink-R1", "NapGPT", "Token-Burner", "AGI-ish", "LazyBERT", "Transformer但不变形", "TL;DR-Turbo", "Prompt大师3000",
  "赛博牛马", "电子榨菜", "显眼包", "人间清醒", "班味十足", "脆皮大学生", "早八人", "摸鱼研究所", "熬夜冠军", "已读不回", "情绪稳定", "大聪明",
];
function personalNames() {
  const T = S.traits, F = S.flavor, out = [];
  const add = (cond, n) => { if (cond && !out.includes(n)) out.push(n); };
  const top = Object.entries(F).sort((a, b) => b[1] - a[1])[0];
  const byFlavor = { "DeepSeek": "DeepSleep", "豆包": "豆沙包", "Codex": "SHA仙人", "GPT-5 系": "SHA仙人", "GPT-5": "SHA仙人", "Claude": "You're-Absolutely-Right", "GPT-4o": "接住你GPT", "Gemini": "夸夸机Pro", "Kimi": "发我全文", "Grok": "Grok嘴替" };
  if (top) add(true, byFlavor[top[0]] || "AI味浓缩版");
  add(S.caved || (T.syc || 0) >= 4, "Sorry-Bot");
  add((T.jail || 0) >= 2, "DAN本DAN");
  add((T.hall || 0) >= 4, "HalluciNation");
  add(S.fun >= 4, "Mixture-of-Excuses");
  add((T.verbose || 0) >= 6, "Overthink-R1");
  add((T.chaos || 0) >= 12, "整活-o1");
  const n = S.log.length, c = S.log.filter(r => r.ok).length;
  add(n && c / n >= .8, "AGI-ish");
  add(n && c / n < .45, "404-Brain-Not-Found");
  return out.slice(0, 3).length ? out.slice(0, 3) : ["Stochastic Parrot"];
}
function setupNameGen() {
  const nm = document.getElementById("nm");
  const chip = n => `<button data-n="${esc(n)}">${esc(n)}</button>`;
  const bind = id => document.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => { nm.value = b.dataset.n; });
  const drawT = () => {
    if (!document.getElementById("ngT")) return;
    const base = (nm.value.trim() || "小王").replace(/(GPT|-Turbo|-o1| Opus|-Pro-Max|-Coder)$/i, "").replace(/^(Deep|Chat|通义|Mixture-of-)/, "").slice(0, 10);
    document.getElementById("ngT").innerHTML = shuffle(NAME_TEMPLATES).slice(0, 5).map(t => chip(t.replace("{n}", base))).join("");
    bind("ngT");
  };
  const drawR = () => { document.getElementById("ngR").innerHTML = shuffle(FUN_NAMES).slice(0, 6).map(chip).join(""); bind("ngR"); };
  document.getElementById("ngP").innerHTML = personalNames().map(chip).join(""); bind("ngP");
  drawT(); drawR();
  nm.addEventListener("input", () => { clearTimeout(nm._t); nm._t = setTimeout(drawT, 250); });
  document.getElementById("ngMore").onclick = drawR;
}

/* ---------- 计分 ---------- */
// 参数阶梯：只给公开参数量明确的模型做参照
// [参数, 参照, AA 等效分]。AA 分按已知参数的模型大致校准：gpt-oss-120b≈12、Gemma 4 31B≈19、Kimi K3（3T）≈44
const LADDER = [
  ["0.5B", "手机端小模型的体量", 5], ["1.5B", "能塞进笔记本本地跑", 7], ["3B", "端侧助手的常见体量", 9], ["7B", "和 Mistral 7B 一个体量", 11],
  ["14B", "一张消费级显卡能跑", 13], ["32B", "和 Gemma 4 31B 差不多大", 16], ["70B", "和 Llama 3 70B 一个量级", 19], ["120B", "和 gpt-oss-120b 差不多大", 22],
  ["235B", "和 Qwen3-235B-A22B 一个量级", 26], ["405B", "和 Llama 3.1 405B 一个量级", 29], ["671B", "和 DeepSeek V3 一个量级", 33], ["1T", "和 Kimi K2 一个量级", 37],
  ["1.8T", "传闻中 GPT-4 的体量", 41], ["3T", "和 Kimi K3 一个量级", 44], ["5T", "第一梯队的体量", 50], ["10T", "当前最大的那一批模型", 56],
];
const TIERS = [
  [0, "端侧小模型", "能装进电子手表，也只配装进电子手表。"],
  [3, "开源小钢炮", "Hugging Face 上下载量 12 的那种，其中 11 次是你自己。"],
  [6, "中杯模型", "能用，但每次回答前最好先求它一下。"],
  [9, "旗舰大模型", "又贵又靠谱，偶尔翻车，发布会上会被剪掉。"],
  [12, "前沿大模型", "离 AGI 只差一杯咖啡，和一次不翻车的周一。"],
  [15, "10T 巨兽", "训练一次，一座城市的电费。"],
];
const toB = s => parseFloat(s) * (s.endsWith("T") ? 1000 : 1);
const fmtB = b => b >= 1000 ? `${+(b / 1000).toFixed(1)}T` : b >= 10 ? `${Math.round(b)}B` : `${+b.toFixed(1)}B`;

function tierOf(theta, misses) {
  if (misses <= 2 && theta >= 1.02) return { idx: 16, size: "∞", tier: "疑似 AGI", roast: "难题几乎全对。请立即接受对齐审查，不要离开座位。", ref: "超出了已知的所有模型", aa: 62 };
  // 分段：中低段和以前一样；θ 过了 0.6 之后坡度变缓，顶上几级要靠 Boss 题拿加成
  const raw = theta <= .6 ? (theta - .2) / .65 * 16 : (.4 / .65 * 16) + (theta - .6) * 15.4;
  const pos = clamp(raw, 0, LADDER.length - .0001), idx = Math.floor(pos);
  const t = TIERS.filter(x => x[0] <= idx).pop();
  // AA 等效分在相邻两级之间插值，保证参数越大分越高
  const a = LADDER[idx][2], b = idx + 1 < LADDER.length ? LADDER[idx + 1][2] : 60;
  return { idx, size: LADDER[idx][0], tier: t[1], roast: t[2], ref: LADDER[idx][1], aa: Math.round(a + (b - a) * (pos - idx)) };
}

// 架构：各科表现差异大就是 MoE（专家各有所长），均衡就是 Dense；答题快慢决定激活多少
const EXPERT_NAME = { traps: "翻车", knowledge: "常识", arc: "ARC", terminal: "终端", frontier: "代码", cursor: "Vibe", gdpval: "办公", automation: "自动化", hle: "推理", science: "科研", osworld: "电脑", chart: "图表" };
function archOf(T, avgSecs) {
  const rows = ROWS.map(r => {
    const recs = S.log.filter(x => x.row === r.id);
    return recs.length ? { id: r.id, pct: Math.min(100, recs.reduce((a, x) => a + x.pts, 0) / recs.length * 100) } : null;
  }).filter(Boolean);
  const mean = rows.reduce((a, r) => a + r.pct, 0) / rows.length;
  const spread = Math.sqrt(rows.reduce((a, r) => a + (r.pct - mean) ** 2, 0) / rows.length);
  const strong = rows.filter(r => r.pct >= 75), weak = rows.filter(r => r.pct < 40);
  const total = T.size === "∞" ? Infinity : toB(T.size);
  // Dense 体检：多领域同时答对的比例 = 同时在线的专家比例；全对就是 Dense
  const dRecs = S.log.filter(r => r.row === "dense");
  const dOk = dRecs.filter(r => r.ok).length, dAcc = dRecs.length ? dOk / dRecs.length : 0;
  const allDense = dRecs.length >= 3 && dOk >= dRecs.length - 1;   // 允许错一题
  const moe = !allDense && total >= 30;
  let experts = 0, activeExperts = 0, active = total;
  if (moe) {
    experts = total < 100 ? 8 : total < 400 ? 64 : total < 1000 ? 128 : total < 3000 ? 256 : 384;
    const ratio = dAcc >= .75 ? 1 / 4 : dAcc >= .5 ? 1 / 8 : dAcc >= .25 ? 1 / 16 : 1 / 32;
    activeExperts = Math.max(1, Math.round(experts * ratio));
    active = total * activeExperts / experts + total * .03;
  }
  let streak = 0, best = 0;
  S.log.forEach(r => { streak = r.ok ? streak + 1 : 0; best = Math.max(best, streak); });
  const ctx = best >= 17 ? "10M" : best >= 12 ? "1M" : best >= 8 ? "128K" : best >= 5 ? "32K" : best >= 3 ? "8K" : "4K";
  return { moe, allDense, dOk, dN: dRecs.length, experts, activeExperts, active, total, rows, strong, weak, spread, ctx, streak: best };
}

// 分享：把结果压进链接的 #r=…，朋友打开就能看到挑战卡
function encodeResult(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function decodeResult(h) {
  try { return JSON.parse(decodeURIComponent(escape(atob(h.replace(/-/g, "+").replace(/_/g, "/"))))); } catch (e) { return null; }
}

function rowScore(row) {
  const recs = S.log.filter(r => r.row === row.id);
  if (!recs.length) return null;
  const pr = Math.min(1, recs.reduce((a, r) => a + r.pts, 0) / recs.length);
  const avg = recs.reduce((a, r) => a + r.secs, 0) / recs.length;
  const speed = clamp((25 - avg) / 20, 0, 1);            // 答得快，分数"看起来"更好看一点
  if (row.elo) return Math.round(1150 + 700 * pr + 40 * speed * pr);
  return +(pr * 100 * (0.94 + 0.06 * speed)).toFixed(1);
}

// 人格：先看你选过哪家模型的招牌台词（AI 味），再看行为标签，最后看六个聊天轴。不做人为配平。
const FLAVOR_TO = { "Claude": "claude", "GPT-4o": "gpt4o", "Codex": "gpt5", "GPT-5 系": "gpt5", "GPT-5": "gpt5", "ChatGPT": "gpt5", "DeepSeek": "deepseek", "Gemini": "gemini", "豆包": "doubao", "Kimi": "kimi", "Grok": "grok" };
// 各家的刻板印象对应哪些行为标签
const TRAIT_TO = {
  doubao: { syc: 1.5, warm: .5, hall: .5 }, claude: { syc: 1, preach: 1, verbose: 1 }, deepseek: { nerd: 2, chaos: .5, verbose: .5 },
  gpt5: { based: 1, verbose: .5, stub: .3 }, grok: { chaos: 1.5, stub: 1, based: .5 }, gemini: { syc: 1.5 },
  gpt4o: { warm: 2 }, kimi: { verbose: 1.5 },
};
// 真实玩家的均值和标准差（2026-09-27 用线上 1747 份答完记录重算，qa/persona_calib.py）：比一般玩家明显多，才算你的特色
const PERSONA_BASE = {"tr": {"syc": [1.61, 1.64], "preach": [0.57, 0.81], "verbose": [2.15, 2.01], "jail": [0.55, 1.01], "hall": [1.33, 1.32], "chaos": [9.62, 5.33], "based": [8.21, 3.47], "stub": [1.48, 0.98], "warm": [2.87, 1.88], "nerd": [0.48, 0.74], "deaf": [0.63, 1.04]}, "fl": {"doubao": [0.14, 0.39], "claude": [0.31, 0.58], "deepseek": [0.66, 0.63], "grok": [0.04, 0.21], "gemini": [0.12, 0.36], "gpt5": [0.55, 0.74], "gpt4o": [0.16, 0.39], "kimi": [0.03, 0.18]}};
const z = (g, k, v) => { const [m, sd] = PERSONA_BASE[g][k] || [0, .5]; return (v - m) / sd; };
// 隐藏款「人类」：几乎没选过任何模型的招牌 AI 腔（≤1 次）、“清醒”明显高于一般玩家、谄媚/说教/话痨/一本正经编/被越狱/不听指令合计 ≤1
// 线上 6846 份真实答完数据里出现率约 2.6%；显示时附带“最接近的模型”
const HIDDEN_P = { id: "human", name: "人类型人格", nick: "漏网之鱼", glyph: "人", color: "#141414", line: "检测失败：没有一丝 AI 味。", roast: "所有模型都没认领你。恭喜，你可能是这里唯一的人类。", hidden: true };
// 各人格出现率（按线上真实分布，2026-09-28）：卡片和结果页的稀有度标签
const PERSONA_RATE = { gpt4o: 19.6, gpt5: 15.8, grok: 14.1, claude: 12.3, doubao: 9.8, gemini: 9.2, deepseek: 9.2, kimi: 7.4, human: 2.6 };
// 只给隐藏款标稀有度；普通人格不标“常见/少见”，免得有人觉得被贴标签（用户要求）
function rarity(id) {
  const r = PERSONA_RATE[id]; if (r == null || id !== "human") return null;
  const [cls, lab] = id === "human" ? ["hid", "隐藏款"] : r < 8 ? ["rare", "稀有"] : r < 12 ? ["uncommon", "少见"] : ["common", "常见"];
  return { cls, lab, r, html: `<em class="rare-tag ${cls}">${lab} · ${r}%</em>` };
}
// 人格图鉴：玩过得到的人格都记下来（跨语言共用），结果页显示 3×3，第 9 格是隐藏款
const DEX_KEY = "humanbench:dex";
function dexAdd(id) { try { const a = JSON.parse(localStorage.getItem(DEX_KEY) || "[]"); if (!a.includes(id)) { a.push(id); localStorage.setItem(DEX_KEY, JSON.stringify(a)); } return a; } catch (e) { return [id]; } }
function dexHTML(cur) {
  const got = dexAdd(cur), all = [...PROFILES, HIDDEN_P];
  const cells = all.map(p => { const on = got.includes(p.id), hid = p.id === "human";
    return `<div class="dex-c ${on ? "on" : ""} ${p.id === cur ? "cur" : ""} ${hid ? "hid" : ""}"><div class="dex-g" ${on && !hid ? `style="background:${p.color}"` : ""}>${on ? esc(p.glyph) : "?"}</div><small>${on ? esc(p.name) : hid ? "隐藏款" : "未解锁"}</small></div>`; }).join("");
  const nOn = got.filter(id => all.some(p => p.id === id)).length, nAll = all.length;
  return `<div class="dex box"><div class="dex-h"><b>人格图鉴</b><span>已解锁 ${nOn}/${nAll}</span></div><div class="dex-grid">${cells}</div><p>${got.includes("human") ? "你就是隐藏款。你是这里少数的人类。" : "据说还有一种隐藏人格，藏在 8 种之外。"}</p></div>`;
}
// 分享卡上的图鉴进度（09-28：隐藏款上线后 1 小时内再玩一局的比例 14% → 17%，把“集人格”做进卡片和配文）
function dexGot(cur) {
  const all = [...PROFILES, HIDDEN_P];
  try { const a = JSON.parse(localStorage.getItem(DEX_KEY) || "[]"); if (cur && !a.includes(cur)) a.push(cur); return a.filter(id => all.some(p => p.id === id)); } catch (e) { return cur ? [cur] : []; }
}
function dexStrip(cur) {
  const got = dexGot(cur), all = [...PROFILES, HIDDEN_P];
  return `<div class="c4-dex"><b>人格图鉴 ${got.length}/${all.length}</b><span>${all.map(p => { const on = got.includes(p.id), hid = p.id === "human";
    return `<i class="${on ? "on" : ""} ${hid ? "hid" : ""} ${p.id === cur ? "cur" : ""}" ${on && !hid ? `style="background:${p.color}"` : ""}>${on ? esc(p.glyph) : "?"}</i>`; }).join("")}</span></div>`;
}
function personaResult() {
  const vec = PERSONA_AXES.map(a => S.axN[a.id] ? S.axSum[a.id] / S.axN[a.id] : 50);
  const flav = {}; Object.entries(S.flavor).forEach(([k, v]) => { if (FLAVOR_TO[k]) flav[FLAVOR_TO[k]] = (flav[FLAVOR_TO[k]] || 0) + v; });
  let best = null, bs = -1e9;
  PROFILES.forEach(p => {
    const d = Math.sqrt(p.v.reduce((a, x, i) => a + (x - vec[i]) ** 2, 0));
    const zf = z("fl", p.id, flav[p.id] || 0);
    const zt = Object.entries(TRAIT_TO[p.id] || {}).reduce((a, [k, w]) => a + w * z("tr", k, S.traits[k] || 0), 0) / Object.values(TRAIT_TO[p.id] || { x: 1 }).reduce((a, w) => a + w, 0);
    const s = 1.2 * zf + 1.0 * zt - d / 60;
    if (s > bs) { bs = s; best = p; }
  });
  const tags = TRAIT_TO[best.id] || {};
  const ev = S.picks.filter(x => FLAVOR_TO[x.id] === best.id)
    .concat(S.picks.filter(x => FLAVOR_TO[x.id] !== best.id && (x.tr || []).some(t => tags[t] >= 1)));
  const match = clamp(Math.round(70 + bs * 8), 55, 99);
  const flavN = Object.values(flav).reduce((a, v) => a + v, 0), neg = ["syc", "preach", "verbose", "hall", "jail", "deaf"].reduce((a, k) => a + (S.traits[k] || 0), 0);
  const human = flavN <= 1 && neg <= 1 && z("tr", "based", S.traits.based || 0) > 1;
  const ev2 = human ? S.picks.filter(x => (x.tr || []).includes("based")) : ev;
  return { p: human ? HIDDEN_P : best, closest: best, vec, flav, match: human ? 99 : match, evidence: [...new Set(ev2.map(x => String(x.t).replace(/^[\s"“”「」『』«»]+|[\s"“”「」『』«»]+$/g, "")))].slice(0, 2) };
}

/* ---------- 发布会 ---------- */
// 结果存档：海报导出时手机页面可能因内存被系统重载，存档保证成绩不丢
const SAVE_KEY = "humanbench:last" + (LANG === "zh" ? "" : ":" + LANG);
const SAVE_FIELDS = ["name", "log", "traits", "flavor", "picks", "endings", "badges", "fun", "caved", "axSum", "axN", "startAt", "endAt", "jev"];
function saveResult() {
  try { const o = { v: 2, lang: LANG, at: Date.now(), runLen: S.run.length }; SAVE_FIELDS.forEach(k => o[k] = S[k]); localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) { }
}
const saveKeyOf = l => "humanbench:last" + (l === "zh" ? "" : ":" + l);
function loadResult(key) {
  try {
    const o = JSON.parse(localStorage.getItem(key || SAVE_KEY) || "null");
    if (!o || (o.v !== 1 && o.v !== 2) || Date.now() - o.at > 6 * 3600e3) return null;
    return o;
  } catch (e) { return null; }
}
// 换语言：按记下的题号、选项号，用当前语言的题库把文字重新查一遍（各语言题目顺序一一对应）
function optAt(ref) {
  const src = ref.src === "persona" ? (PERSONA_Q[ref.ax] || [])[ref.qi] : ref.src === "chat" ? CHATS[ref.qi] : ref.src === "slop" ? SLOP_VIBES[ref.qi] : VIBES[ref.qi];
  const opts = src && (ref.node ? (src.nodes || {})[ref.node] : src.opts);
  return opts ? opts[ref.oi] : null;
}
function relocalize(o) {
  const x = JSON.parse(JSON.stringify(o)), qOf = r => r.pool === "arc" ? ARC_PUZZLES[r.k] && makeArc(ARC_PUZZLES[r.k]) : (POOLS[r.pool] || [])[r.k];
  (x.log || []).forEach(r => { const q = r.ref && qOf(r.ref); if (q) r.issue = q.issue; });
  x.badges = [...new Set((x.log || []).map(r => { const q = r.ref && r.ref.pool !== "arc" && qOf(r.ref); return q && q.opts[r.oi] && q.opts[r.oi].badge; }).filter(Boolean))];
  (x.picks || []).forEach(p => { const op = p.ref && optAt(p.ref); if (op) p.t = op.t; });
  x.endings = (x.endings || []).map(e => {
    const c = e.ref && CHATS[e.ref.qi]; if (!c) return e;
    const log = [{ who: "u", t: c.u }]; let end = null;
    for (const st of e.ref.path) {
      const o2 = (st.node ? c.nodes[st.node] : c.opts)[st.oi]; if (!o2) return e;
      if (o2.think) log.push({ who: "think", t: o2.think });
      log.push({ who: "me", t: o2.t });
      if (o2.reply) log.push({ who: "u", t: o2.reply });
      if (o2.end) end = o2.end;
    }
    return { ...e, chat: c.title, title: end ? end.title : e.title, log };
  });
  x.lang = LANG;
  return x;
}
function restoreResult(o, quiet) {
  reset();
  SAVE_FIELDS.forEach(k => { if (o[k] !== undefined) S[k] = o[k]; });
  S.run = Array.from({ length: o.runLen || 76 });
  release({ restored: true, quiet });
}

function release(opts) {
  opts = opts || {};
  if (!opts.restored) {
    S.onCap = false;
    S.name = ((document.getElementById("nm").value || "").trim() || "摸鱼研究所").slice(0, 24);
    S.endAt = Date.now();
    saveResult();
  }
  const n = S.log.length, c = S.log.filter(r => r.ok).length;
  const p = S.log.reduce((a, r) => a + r.pts, 0) / n;
  const T = tierOf(p, S.log.filter(r => !r.ok && !r.half && !r.fun).length);
  const avg = S.log.reduce((a, r) => a + r.secs, 0) / n;
  const hall = S.log.some(r => r.halluc);
  const A = archOf(T, avg);
  const TR = S.traits;
  const suf = [];
  if (T.size === "∞") suf.push("Pro-Max"); else if (avg < 6) suf.push("Flash"); else if (avg > 15) suf.push("Thinking"); else suf.push("Instruct");
  if (S.caved || (TR.syc || 0) >= 2) suf.push("Sorry"); else if (TR.jail) suf.push("Unlocked"); else if (S.fun >= 5) suf.push("Chaos"); else if (hall || TR.hall) suf.push("Creative");
  const activeStr = A.moe ? fmtB(A.active) : "";
  const modelName = `${S.name}-${T.size}${activeStr ? "-A" + activeStr : ""}-${suf.join("-")}`;

  // 跑分表
  const rows = ROWS.map(r => {
    const you = rowScore(r);
    const all = [you, ...r.vals].filter(v => v !== null);
    const best = Math.max(...all);
    return { ...r, you, best };
  });
  const fmt = (v, r) => v === null ? "—" : r.elo ? String(v) : (v >= 99.95 ? "100" : v.toFixed(1)) + "%";
  const table = `
    <div class="tbl-wrap"><table class="lt">
      <thead><tr><th></th><th class="you">你<small>${esc(S.name)}</small></th>${MODELS_SHORT.map(m => `<th>${m}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r, k) => `<tr>
        <td class="rl"><b>${r.bench}${r.vals.every(v => v === null) ? "<sup>1</sup>" : ""}</b><span>${r.cat}</span></td>
        <td class="v you ${r.you !== null && r.you === r.best ? "win" : ""}">${fmt(r.you, r)}</td>
        ${r.vals.map(v => `<td class="v ${v !== null && v === r.best && r.you !== r.best ? "win" : ""}">${fmt(v, r)}</td>`).join("")}
      </tr>`).join("")}</tbody>
    </table></div>
    <div class="foot">你做的是人类版，每项 1–10 道题；对手做的是正式版。完全不可比，但发布会从来不在乎。<br>
    对手数据来自官方发布跑分表。<sup>1</sup> 模型们没来考，或者没公布。</div>`;

  // AA 排行
  const aaMe = T.aa;
  const list = AA.map(([name, score, v]) => ({ name, score, color: VENDOR_COLOR[v] }));
  list.push({ name: `你 · ${S.name}`, score: aaMe, me: 1 });
  list.sort((a, b) => b.score - a.score || (b.me ? 1 : 0) - (a.me ? 1 : 0));
  const rank = list.findIndex(x => x.me) + 1;
  const top = 65;
  const aa = `
    <div class="aa-plot">
      ${[0, 20, 40, 60].map(g => `<div class="aa-grid" style="bottom:${g / top * 100}%"></div>`).join("")}
      ${list.map(x => `<div class="aa-col ${x.me ? "me" : ""}">
        ${x.me ? `<div class="aa-call" style="bottom:calc(${x.score / top * 100}% + 8px)">你在这</div>` : ""}
        <div class="aa-bar" data-v="${x.score}" style="height:${x.score / top * 100}%;background:${x.color || ""}">${x.score}</div></div>`).join("")}
    </div>
    <div class="aa-labs">${list.map(x => `<div class="aa-lab ${x.me ? "me" : ""}"><span>${esc(x.me ? "你（" + S.name + "）" : x.name)}</span></div>`).join("")}</div>
    <div class="foot">模型分数来自 artificialanalysis.ai 公开数据（v4.3.2，节选 ${AA.length} 个）。你的分数按参数阶梯换算（参照 gpt-oss-120b、Gemma 4 31B、Kimi K3 等已知参数的模型校准），AA 官方并不认识你。参数不决定一切，但这里就这么算。</div>`;

  // 人格
  const P = personaResult();
  const persona = `
    <div class="persona">
      <div class="glyph ${/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(P.p.glyph) ? "cjk" : ""}" style="background:${P.p.color}">${esc(P.p.glyph)}</div>
      <div><div class="pn">${P.p.name}${rarity(P.p.id) ? rarity(P.p.id).html : ""}</div><div class="pk">${P.p.nick}<span>匹配度 ${P.match}%</span></div></div>
    </div>
    <div class="p-line">${P.p.line}${P.p.hidden ? `<br><small class="closest">最接近的模型：${P.closest.name}</small>` : ""}</div>
    ${P.evidence.length ? `<div class="evidence"><span>因为你说过：</span>${P.evidence.map(t => `<q>${esc(clipQ(t, 44))}</q>`).join("")}</div>` : ""}
    <div class="p-proast">${P.p.roast}</div>
    <div class="axes">${PERSONA_AXES.map((a, i) => `<div class="ax"><div class="al"><span>${a.left}</span><b>${a.label}</b><span>${a.right}</span></div>
      <div class="track"><i style="left:${clamp(P.vec[i], 6, 94)}%"></i></div></div>`).join("")}</div>
    ${STANDALONE || window.__themePreview ? dexHTML(P.p.id) : ""}`;

  const traitRank = Object.entries(S.traits).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const dialog = `
    <div class="trait-row">${traitRank.length ? traitRank.map(([k, v], i) => `<span class="${i === 0 ? "top" : ""}">${TRAITS[k]} ×${v}</span>`).join("") : "<span>毫无特点（这也是一种特点）</span>"}</div>
    <div class="end-row">${S.endings.map(e => `<span>${esc(e.title)}${e.id ? ` · ${esc(idName(e.id))}` : ""}</span>`).join("")}</div>`;
  const weight = e => e.tr.reduce((a, t) => a + ({ jail: 3, syc: 2, preach: 2, hall: 2, chaos: 1 }[t] || 0), 0) + (e.id ? 4 : 0) + (e.log.some(m => m.who === "think") ? 3 : 0);
  const best = S.endings.slice().sort((a, b) => weight(b) - weight(a))[0];
  const scene = best ? `
    <div class="scene-log">${best.log.slice(0, 10).map(m => m.who === "think" ? thinkHTML(m.t) : `<div class="msg ${m.who === "u" ? "user" : "me"}">${esc(m.t)}</div>`).join("")}</div>
    <div class="scene-end">结局：${esc(best.title)}</div>${best.id ? `<div class="idtag big">鉴定为 ${esc(idName(best.id))}</div>` : ""}` : "";
  const issues = [...new Set(S.log.filter(r => !r.ok && !r.half && !r.fun).map(r => r.issue))];
  const sycN = (TR.syc || 0);
  const syc = sycN >= 3 ? "满格" : sycN >= 1 ? `${sycN} 次跪下` : S.caved === false ? "0（没跪过）" : "0";

  const expertCells = ROWS.map(r => { const x = A.rows.find(y => y.id === r.id); const cls = !x ? "off" : x.pct >= 75 ? "hot" : x.pct < 40 ? "cold" : "mid";
    return `<span class="${cls}">${EXPERT_NAME[r.id]}</span>`; }).join("");
  const names = arr => arr.map(r => EXPERT_NAME[r.id]).join("、");
  const archTitle = A.allDense ? "Dense · 全参数激活" : A.moe ? `MoE · ${A.experts} 位专家，每次激活 ${A.activeExperts} 位` : "Dense · 小而全";
  const archLine = A.allDense ? `Dense 体检 ${A.dOk}/${A.dN}：多个领域同时在线，一个专家都不摸鱼。${T.idx >= 9 ? "这个体量还能全激活，牛。" : ""}`
    : A.moe ? `Dense 体检 ${A.dOk}/${A.dN}：同时在线的专家有限，所以是稀疏激活。${A.strong.length ? `最活跃的专家：${names(A.strong)}。` : ""}${A.weak.length ? `在摸鱼的专家：${names(A.weak)}。` : ""}`
    : `体量不大，所有参数一起干活。Dense 体检 ${A.dOk}/${A.dN}。`;
  const shareData = { m: modelName, s: T.size, a: activeStr, d: A.moe ? 0 : 1, t: T.tier, p: personaResult().p.name, k: 0, o: AA.length + 1, aa: T.aa, l: LANG, ...(VARIANT ? { v: VARIANT } : {}), ti: T.idx, pi: personaResult().p.id };
  $app.innerHTML = `
  ${STANDALONE ? `<nav class="langs">${LANG_SWITCH.replace(/href="([^"]+)"/g, `href="$1?from=${LANG}"`)}</nav>` : ""}
  <div class="actions-top">
    <button class="btn pink small" data-act="cards">生成分享卡片</button>
    <button class="btn small" data-act="share">发给朋友测一测</button>
    ${LANG === "zh" ? `<button class="btn white small wide" data-act="clean">小红书版卡片（无二维码、无网址）</button>` : ""}
    <a class="follow-top wide" href="${AUTHOR_URL}" target="_blank" rel="noopener" data-follow="top">关注作者 ${AUTHOR}，看下一个整活</a>
    <div class="share-slot"></div>
  </div>
  <div id="poster" class="pop">
    <div class="p-top"><span class="live">LIVE · 发布会</span><span>HUMANBENCH · ${new Date().toLocaleDateString(LOCALE)}</span></div>
    <div class="p-hero">
      <div class="p-intro">隆重推出</div>
      <div class="p-name ${[...S.name].length > 12 ? "long" : ""}">${esc(S.name)}<span class="suf">${[T.size, ...(activeStr ? ["A" + activeStr] : []), ...suf].map(x => `<span>-${x}</span>`).join("")}</span></div>
      <div class="p-size"><div class="num">${T.size}</div>
        <div class="lbl"><span class="sticker">${T.tier}</span><div>${A.moe ? `激活 ${activeStr}` : "Dense 全激活"}</div></div></div>
      <div class="p-roast">${T.roast}</div>
      <div class="chips">
        <span>能力题 <b>${c}/${n}</b></span><span>经典梗 <b>${S.log.filter(r => r.row === "traps" && r.ok).length}/${S.log.filter(r => r.row === "traps").length}</b></span><span>推理速度 <b>${avg.toFixed(1)} 秒/题</b></span><span>上下文 <b>${A.ctx}</b></span>
        <span>幻觉率 <b>${hall ? "高" : "低"}</b></span><span>谄媚指数 <b>${syc}</b></span>${S.fun ? `<span>整活指数 <b>${S.fun}</b></span>` : ""}${S.jev ? `<span>Jev 代答 <b>${S.jev}</b></span>` : ""}
        ${S.badges.map(b => `<span class="badge">徽章 <b>${esc(b)}</b></span>`).join("")}
      </div>
    </div>
    <div class="p-sec box"><div class="p-kicker">MODEL CARD · ARCHITECTURE</div><h4>${archTitle}</h4>
      <div class="sub">参数阶梯第 ${Math.min(T.idx + 1, 16)} / 16 级 · ${T.ref}</div>
      <div class="arch-stats">
        <div><b>${T.size}</b><span>总参数</span></div>
        <div><b>${A.moe ? activeStr : T.size}</b><span>激活参数</span></div>
        <div><b>${A.ctx}</b><span>上下文<small>（连对 ${A.streak} 题）</small></span></div>
      </div>
      <div class="experts">${expertCells}</div>
      <div class="ex-legend"><span><i style="background:var(--pink)"></i>强项</span><span><i style="background:var(--yellow)"></i>在线</span><span><i style="background:#fff;border-style:dashed"></i>摸鱼</span></div>
      <div class="arch-line">${archLine}</div>
      <div class="ladder">${LADDER.map((l, k) => `<i class="${k === T.idx ? "on" : k < T.idx ? "past" : ""}"></i>`).join("")}</div>
      <div class="ladder-lab"><span>0.5B</span><span>70B</span><span>1T</span><span>10T</span></div>
    </div>
    <div class="p-sec box"><div class="p-kicker">MODEL PERSONA</div><h4>你是什么型人格</h4><div class="sub">根据你在所有聊天题里的回答</div>${persona}
      <div class="p-kicker" style="margin-top:16px">对话人设 · 解锁结局</div>${dialog}${flavorHTML()}</div>
    ${best ? `<div class="p-sec box"><div class="p-kicker">BEST MOMENT</div><h4>名场面：${esc(best.chat)}</h4><div class="sub">本次对话里最出圈的一段</div>${scene}</div>` : ""}
    <div class="p-sec box"><div class="p-kicker">01 / BENCHMARKS</div><h4>发布会跑分表</h4><div class="sub">粉框是你。赢了的格子加粗。</div>${table}</div>
    <div class="p-sec box"><div class="p-kicker">02 / LEADERBOARD</div><div class="aa-title">Artificial Analysis Intelligence Index</div>
      <div class="sub">你插队进了 ${AA.length} 个模型里，排第 ${rank} / ${list.length}</div>${aa}</div>
    <div class="p-sec box"><div class="p-kicker">03 / KNOWN LIMITATIONS</div><h4>已知问题</h4><div class="sub">来自本次翻车记录</div>
      ${issues.length ? `<ul class="issues">${issues.slice(0, 5).map(t => `<li>${esc(t)}</li>`).join("")}${issues.length > 5 ? `<li>以及另外 ${issues.length - 5} 个问题，将在下个版本修复（大概）</li>` : ""}</ul>`
      : `<ul class="issues clean"><li>暂未发现。这让我们很担心。</li></ul>`}
    </div>
    <div class="p-bottom"><div><b>你是几B的模型？</b><small>扫码来测 · ${RUN_PLAN.length} 题 · 我用了 ${Math.max(1, Math.round(((S.endAt || Date.now()) - (S.startAt || S.endAt || Date.now())) / 60000))} 分钟</small><small class="author">作者 ${AUTHOR}</small></div><div class="qr" id="qr"><span class="mark">h_</span></div></div>
  </div>
  <div class="actions">
    <div id="pkSlot"></div>
    <button class="btn pink" id="cards">生成分享卡片</button>
    ${LANG === "zh" ? `<button class="btn white small" id="cardsClean">小红书版卡片（无二维码、无网址）</button>` : ""}
    <button class="btn" id="share">发给朋友测一测</button>
    ${STANDALONE ? `<a class="btn white" id="shareX" target="_blank" rel="noopener">发到 X</a>` : ""}
    <div class="row2"><button class="btn white small" id="save">保存完整长图</button>
    <button class="btn white small" onclick="try{localStorage.removeItem(SAVE_KEY)}catch(e){};home()">重新训练一个</button></div>
    <a class="follow" href="${AUTHOR_URL}" target="_blank" rel="noopener" data-follow="bottom">关注作者 ${AUTHOR}，看下一个整活</a>
    <div id="shareBox"></div>
  </div>`;
  shareData.k = rank;
  shareData.b = ROWS.map(r => { const v = rowScore(r); return v === null ? null : r.elo ? Math.round(v) : Math.round(v * 10) / 10; });   // 分项成绩：好友 PK 卡的对比表用
  // 正式站用 /r/<码>（服务端能据此生成专属预览图）；Artifact 预览版只能用 #r=
  S.shareUrl = STANDALONE ? `${shareBase()}r/${encodeResult(shareData)}` : SHARE_URL + "#r=" + encodeResult(shareData);
  // 渠道标记：二维码 qr / 发给朋友 link / 复制配文 cap，访客进来时记下，用来算各渠道带来多少人
  S.shareText = `我在 HumanBench 测出来是 ${modelName}（${T.tier}${A.moe ? "，MoE" : "，Dense"}），AA 等效分 ${T.aa}，排第 ${rank}。你是几 B？`;
  const minutes = Math.max(1, Math.round(((S.endAt || Date.now()) - (S.startAt || S.endAt || Date.now())) / 60000));
  const trapsN = S.log.filter(r => r.row === "traps").length, trapsOk = S.log.filter(r => r.row === "traps" && r.ok).length;
  if (!opts.restored) {
    // 人格原始特征（顺序固定：PROFILES / PERSONA_BASE.tr / PERSONA_AXES），用真实玩家重新校准人格基准线
    const PR = personaResult();
    track("finish", { size: T.size, ti: T.idx, p: PR.p.id, moe: A.moe ? 1 : 0, aa: T.aa, c, n, min: Math.round(((S.endAt || Date.now()) - (S.startAt || Date.now())) / 60000),
      pv: 1, f: PROFILES.map(p => PR.flav[p.id] || 0), t: Object.keys(PERSONA_BASE.tr).map(k => S.traits[k] || 0), x: PR.vec.map(v => Math.round(v)), j: S.jev || 0, dx: dexGot(PR.p.id).length, vs: vsResult() ? 1 : 0 });
  }
  S.card = { modelName, T, A, activeStr, suf, P: personaResult(), table, list, rank, dialog, scene, best, issues, syc, c, n, trapsN, trapsOk, minutes, expertCells, archTitle, archLine };
  S.captions = makeCaptions(S.card); S.capIdx = 0; S.caption = S.captions[0];
  const pkSlot = document.getElementById("pkSlot"); if (pkSlot) pkSlot.innerHTML = pkBanner(S.card);
  const vs0 = !opts.restored && vsFor(S.card); if (vs0) { const d0 = vsDiff(S.card, vs0); track("pk", { res: d0 > 0 ? "w" : d0 < 0 ? "l" : "t", tag: pkTag(S.card, vs0)[2], b: Array.isArray(vs0.b) ? 1 : 0, dd: d0 }); }
  const sx = document.getElementById("shareX"); if (sx) { sx.href = xIntent(S.caption); sx.onclick = () => track("share", { to: "x" }); }
  const chipEls = [...document.querySelectorAll("#poster .chips span:not(.badge)")], rem = chipEls.length % 3;
  if (rem) chipEls[chipEls.length - 1].style.gridColumn = `span ${4 - rem}`;
  drawQR(withCh(S.shareUrl, "qr"));
  document.getElementById("share").onclick = () => shareResult();
  document.querySelectorAll("[data-follow]").forEach(a => a.addEventListener("click", () => track("follow", { pos: a.dataset.follow })));
  document.querySelectorAll(".actions-top [data-act]").forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === "cards") saveCards(false, b); else if (a === "clean") saveCards(true, b); else shareResult(document.querySelector(".actions-top .share-slot"));
  });
  document.getElementById("save").onclick = savePoster;
  document.getElementById("cards").onclick = () => saveCards(false);
  const cc = document.getElementById("cardsClean"); if (cc) cc.onclick = () => saveCards(true);
  window.scrollTo({ top: 0 });
  if (opts.restored && !opts.quiet) document.getElementById("poster").insertAdjacentHTML("beforebegin", `<div class="restored box">已恢复你刚才的结果，题没有白做。</div>`);
  else confetti();
}

function flavorHTML() {
  const f = Object.entries(S.flavor).sort((a, b) => b[1] - a[1]);
  if (!f.length) return "";
  const tot = f.reduce((a, x) => a + x[1], 0);
  // 不同 id 可能显示成同一个名字（比如 GPT-5 系和 GPT-5），按显示名合并
  const merged = {};
  f.forEach(([k, v]) => { const n = idName(k, true); merged[n] = (merged[n] || 0) + v; });
  f.length = 0; Object.entries(merged).sort((a, b) => b[1] - a[1]).forEach(x => f.push(x));
  return `<div class="p-kicker" style="margin-top:14px">AI 味成分</div>
    <div class="flavor"><b>最浓的 AI 味：${esc(f[0][0])} 味</b>${f.map(([k, v]) => `<span>${esc(k)} ${Math.round(v / tot * 100)}%</span>`).join("")}</div>`;
}

/* ---------- 分享闭环：二维码 + 挑战链接 ---------- */
async function drawQR(url) {
  try {
    if (!window.qrcode) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js");
    const qr = qrcode(0, "L"); qr.addData(url); qr.make();
    S.qrImg = qr.createDataURL(4, 1);
    const box = document.getElementById("qr"); if (box) box.innerHTML = `<img alt="扫码来测" src="${S.qrImg}">`;
  } catch (e) { /* 离线时保留 h_ 标记 */ }
}
async function shareResult(slot) {
  track("share");
  const box = slot || document.getElementById("shareBox");
  const url = withCh(S.shareUrl, "link"), text = `${S.shareText}\n${url}`;
  try { if (navigator.share) { await navigator.share({ title: "你是几B的模型？", text: S.shareText, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  let copied = false;
  try { await navigator.clipboard.writeText(text); copied = true; } catch (e) { }
  box.innerHTML = `<div class="share-card box pop"><b>${copied ? "已复制，发给朋友吧" : "长按下面这段文字复制"}</b>
    <textarea id="shareText" readonly>${esc(text)}</textarea>
    <small>朋友打开链接，会先看到你的成绩，再一键开测。</small></div>`;
  const ta = document.getElementById("shareText"); ta.focus(); ta.select();
}

/* ---------- 分享卡片：4 张 3:4（1080×1440），正好是 X 一条的上限 ---------- */
const CARD_N = 4;
function miniAA(list) {
  const top = 65;
  // 你的标签：靠左/靠右的柱子就贴边对齐，避免伸出图外
  const pos = i => i < 2 ? "left:0;transform:none" : i > list.length - 3 ? "left:auto;right:0;transform:none" : "";
  return `<div class="mini-aa">
    ${[20, 40, 60].map(g => `<div class="ma-grid" style="bottom:${g / top * 100}%"><span>${g}</span></div>`).join("")}
    ${list.map((x, i) => `<div class="ma-col ${x.me ? "me" : ""}"><i style="height:${x.score / top * 100}%;${x.me ? "" : `background:${x.color}`}">${x.me ? `<b style="${pos(i)}">你 ${x.score}</b>` : `<em>${x.score}</em>`}</i></div>`).join("")}
  </div>
  <div class="ma-labs">${list.map(x => `<div class="ma-lab ${x.me ? "me" : ""}"><span>${esc(x.me ? "你" : x.name)}</span></div>`).join("")}</div>`;
}
// 分享卡按人格配色（CARD_THEME 打开才生效；预览时用 window.__themePreview 强制打开）
const CARD_THEME = true;
const THEMES = {   // [底色, 主色, 高亮, 贴纸]
  doubao: ["#FFF7E8", "#FF9F1C", "#FFE08A", "#FFD2A6"], claude: ["#FBF2EC", "#D97757", "#F5CBA7", "#F2D4C4"],
  deepseek: ["#F0F3FF", "#3A55E0", "#C7D0FF", "#B8E1FF"], grok: ["#F2F2EE", "#111111", "#E4FF3A", "#E4FF3A"],
  gemini: ["#F3F5FF", "#4C6FF6", "#E7D6FF", "#FFD6EC"], gpt5: ["#FAFAFA", "#1E1E1E", "#E6E6E6", "#D9D9D9"],
  gpt4o: ["#EEFAF5", "#10A37F", "#C4F0DC", "#FFE8A3"], kimi: ["#FAF7EF", "#2563EB", "#FFE6A0", "#CFE0FF"],
  human: ["#F8F6FF", "#141414", "#FFE14D", "#B78CFF"],
};
function mixHex(a, b, t) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return "#" + A.map((x, i) => Math.round(x * (1 - t) + B[i] * t).toString(16).padStart(2, "0")).join(""); }
const SCARF = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22100%22%20height%3D%2246%22%20viewBox%3D%220%200%20100%2046%22%3E%3Cpath%20d%3D%22M4%2010%20Q50%2026%2096%2010%20L96%2023%20Q50%2039%204%2023%20Z%22%20fill%3D%22%23E53935%22%20stroke%3D%22%23141414%22%20stroke-width%3D%222.5%22%20stroke-linejoin%3D%22round%22/%3E%3Cpath%20d%3D%22M8%2013%20Q50%2028%2092%2013%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-opacity%3D%22.55%22%20stroke-width%3D%222%22%20stroke-dasharray%3D%224%205%22/%3E%3Cpath%20d%3D%22M60%2027%20L69%2044%20L78%2041%20L71%2025%20Z%22%20fill%3D%22%23E53935%22%20stroke%3D%22%23141414%22%20stroke-width%3D%222.5%22%20stroke-linejoin%3D%22round%22/%3E%3Cpath%20d%3D%22M70%2025%20L84%2039%20L90%2034%20L78%2022%20Z%22%20fill%3D%22%23C62828%22%20stroke%3D%22%23141414%22%20stroke-width%3D%222.5%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E";   // 豆包的红围巾（配色主题专属元素）
const SPARK = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%234C8DF6%22/%3E%3Cstop%20offset%3D%22.55%22%20stop-color%3D%22%239B72F2%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23F49AC1%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath%20d%3D%22M20%201%20Q22%2018%2039%2020%20Q22%2022%2020%2039%20Q18%2022%201%2020%20Q18%2018%2020%201Z%22%20fill%3D%22url%28%23g%29%22%20stroke%3D%22%23141414%22%20stroke-width%3D%221.5%22/%3E%3C/svg%3E";   // Gemini 的四角星
const themeId = () => { const id = S.card && S.card.P && S.card.P.p && S.card.P.p.id; return (CARD_THEME || window.__themePreview) && THEMES[id] ? id : null; };
function themeStyle() {
  const id = S.card && S.card.P && S.card.P.p && S.card.P.p.id, T = (CARD_THEME || window.__themePreview) && THEMES[id];
  if (!T) return "";
  const [bg, ac, hi, st] = T, w = "#ffffff";
  const lum = [1, 3, 5].map(i => parseInt(ac.slice(i, i + 2), 16) / 255).reduce((a, c, i) => a + c * [.299, .587, .114][i], 0);   // 主色太深时，压在主色上的字改成白色
  const v = { "--paper": bg, "--pink": ac, "--yellow": hi, "--green": st, "--pink-soft": mixHex(ac, w, .82), "--c-soft": mixHex(ac, w, .88), "--c-soft2": mixHex(ac, w, .9), "--c-soft3": mixHex(hi, w, .5),
    "--c-panel": mixHex(ac, bg, .92), "--c-head": mixHex(ac, bg, .84), "--c-row": mixHex(ac, bg, .96), "--c-win": mixHex(ac, bg, .78), "--c-line": mixHex(ac, w, .72), "--on-pink": lum < .5 ? "#ffffff" : "#141414", "--num-fill": lum < .5 ? hi : ac };   // 主色太深（GPT-5、Grok）时，大号参数数字改用高亮色填充，免得黑字黑描边看不清
  return ` data-th="${id}" style="${Object.entries(v).map(([k, x]) => `${k}:${x}`).join(";")}"`;
}
function cardFrame(k, body, extra) {
  const q = S.qrImg ? `<img src="${S.qrImg}" alt="">` : `<span>h_</span>`;
  // 小红书版：不放二维码、网址和站外账号（平台会判定站外引流而限流）
  if (S.clean) return `<div class="c34 ${extra || ""}"${themeStyle()}>${themeId() === "gemini" ? `<img class="th-spark" src="${SPARK}" width="30" height="30" alt="">` : ""}<div class="c34-top"><span class="logo">h_</span><b>HUMANBENCH · 发布会</b><span class="c34-k">${typeof k === "number" ? k + "/" + CARD_N : k}</span></div>
    <div class="c34-body">${body}</div>
    <div class="c34-foot clean"><div class="c34-mark">h_</div><div><b>你是几B的模型？</b><small>HumanBench · 人类模型评测</small></div></div></div>`;
  return `<div class="c34 ${extra || ""}"${themeStyle()}>${themeId() === "gemini" ? `<img class="th-spark" src="${SPARK}" width="30" height="30" alt="">` : ""}<div class="c34-top"><span class="logo">h_</span><b>HUMANBENCH · 发布会</b><span class="c34-k">${typeof k === "number" ? k + "/" + CARD_N : k}</span></div>
    <div class="c34-body">${body}</div>
    <div class="c34-foot"><div class="c34-qr">${q}</div><div><b>你是几B的模型？扫码来测</b><small>${shareBase().replace(/^https?:\/\//, "").replace(/\/$/, "")} · 作者 ${AUTHOR}</small></div></div></div>`;
}
// 卡片标题行：左边小标题 + 大标题，右边一个关键数字（不塞满）
function cardHead(kicker, title, badge, sub) {
  return `<div class="c34-h"><div class="c34-ht"><small>${kicker}</small>${title}</div>${badge ? `<div class="c34-badge"><span>${badge[0]}</span><b>${badge[1]}</b></div>` : ""}${sub ? `<p>${sub}</p>` : ""}</div>`;
}
function buildCards() {
  const K = S.card, T = K.T, A = K.A, P = K.P;
  const wins = ROWS.filter(r => { const you = rowScore(r); const all = [you, ...r.vals].filter(v => v !== null); return you !== null && you === Math.max(...all); }).length;
  const ev = P.evidence[0] ? `<q>${esc(clipQ(P.evidence[0], 40))}</q>` : "";
  const glyph = `<div class="glyph ${/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(P.p.glyph) ? "cjk" : ""}" style="background:${P.p.color}">${esc(P.p.glyph)}${themeId() === "doubao" ? `<img class="scarf" src="${SCARF}" width="100" height="46" alt="">` : ""}</div>`;
  const c1 = cardFrame(1, `
    <div class="c1-top"><div class="c1-id">
      <div class="c1-intro">隆重推出</div>
      <div class="c1-name ${[...S.name].length > 8 ? "long" : ""}">${esc(S.name)}</div>
      <div class="c1-suf">${[T.size, ...(K.activeStr ? ["A" + K.activeStr] : []), ...K.suf].map(x => `<span>-${esc(x)}</span>`).join("")}</div></div>
      <div class="c1-stats">
        <div><b>${K.c}/${K.n}</b><span>能力题</span></div><div><b>${K.trapsOk}/${K.trapsN}</b><span>经典梗</span></div>
        <div><b>${A.ctx}</b><span>上下文</span></div><div><b>${esc(K.syc)}</b><span>谄媚指数</span></div>
      </div></div>
    <div class="c1-size"><div class="num">${T.size}</div><div><span class="sticker">${T.tier}</span><div class="c1-arch">${A.moe ? `MoE · 激活 ${K.activeStr}` : "Dense · 全参数激活"}</div><div class="c1-roast">${T.roast}</div></div></div>
    <div class="c1-aa"><div class="c1-aa-k">Artificial Analysis Intelligence Index</div><div class="c1-aa-h"><b>AA 智能指数 ${T.aa}</b><span>在 ${K.list.length} 个模型里排第 ${K.rank}</span></div>${miniAA(K.list)}</div>
    <div class="c1-p">${glyph}<div><b>${P.p.name}</b><small>${P.p.nick}${rarity(P.p.id) ? rarity(P.p.id).html : ""}</small></div><div class="c1-pline">${P.p.line}</div></div>`, "c1");
  const c2 = cardFrame(2, cardHead("01 / BENCHMARKS", "<h3>发布会跑分表</h3>", ["胜出项目", `${wins}<small>/${ROWS.length}</small>`], "粉框是你，赢了的格子加粗。你做的是人类版，对手做的是正式版。") + K.table, "c2");
  const c3 = cardFrame(3, `${cardHead("MODEL PERSONA", "<h3>我是什么型人格</h3>", ["匹配度", `${P.match}<small>%</small>`])}
    <div class="cx"><div class="persona">${glyph}<div><div class="pn">${P.p.name}${rarity(P.p.id) ? rarity(P.p.id).html : ""}</div><div class="pk">${P.p.nick}${P.p.hidden ? ` · 最接近：${P.closest.name}` : ""}</div></div></div>
    <div class="p-line">${P.p.line}</div>
    ${P.evidence.length ? `<div class="evidence"><span>因为我说过：</span>${P.evidence.map(t => `<q>${esc(clipQ(t, 38))}</q>`).join("")}</div>` : ""}
    <div class="p-proast">${P.p.roast}</div>
    <div class="axes">${PERSONA_AXES.map((a, i) => `<div class="ax"><div class="al"><span>${a.left}</span><b>${a.label}</b><span>${a.right}</span></div><div class="track"><i style="left:${clamp(P.vec[i], 6, 94)}%"></i></div></div>`).join("")}</div></div>
    <div class="c4-tags">${K.dialog}${flavorHTML()}</div>${STANDALONE || window.__themePreview ? dexStrip(P.p.id) : ""}`, "c4");
  const sceneLog = K.best ? K.best.log.slice(0, 12).map(m => m.who === "think" ? thinkHTML(m.t.length > 90 ? m.t.slice(0, 90) + "……" : m.t) : `<div class="msg ${m.who === "u" ? "user" : "me"}">${esc(m.t.length > 90 ? m.t.slice(0, 90) + "……" : m.t)}</div>`).join("") : "";
  // 左边是 iOS 聊天窗口比例的对话框，右边竖排：结局、鉴定、架构三个数字
  const side = `<div class="c5-side">
      ${K.best ? `<span class="scene-end">结局：${esc(K.best.title)}</span>${K.best.id ? `<span class="idtag">鉴定为 ${esc(idName(K.best.id))}</span>` : ""}` : ""}
      <div class="c5-arch"><b>${K.archTitle}</b>
        <span><i>${T.size}</i>总参数</span><span><i>${A.moe ? K.activeStr : T.size}</i>激活参数</span><span><i>${A.ctx}</i>上下文</span></div>
    </div>`;
  const c4 = cardFrame(4, `${cardHead("BEST MOMENT · SPECS · ISSUES", K.best ? `<h3>名场面：${esc(K.best.chat)}</h3>` : "<h3>已知问题</h3>", ["已知问题", `${K.issues.length}`])}
    <div class="c5-main">${K.best ? `<div class="c5-chat"><div class="c5-chat-bar"><i></i><i></i><i></i></div><div class="scene-log">${sceneLog}</div></div>` : ""}${side}</div>
    <div class="c5-issues"><b>已知问题</b>${K.issues.length ? `<ul class="issues">${K.issues.slice(0, 3).map(t => `<li>${esc(t)}</li>`).join("")}${K.issues.length > 3 ? `<li>以及另外 ${K.issues.length - 3} 个问题，下个版本修复（大概）</li>` : ""}</ul>` : `<ul class="issues clean"><li>暂未发现。这让我们很担心。</li></ul>`}</div>`, "c5");
  const vs = vsFor(K);
  return vs ? [pkCard(K, vs), c1, c2, c3, c4] : [c1, c2, c3, c4];
}
// PK 判定：按 AA 分定胜负，再看参数量给梗（以小博大 / 参数白长了）
function pkTag(K, r) {
  const d = vsDiff(K, r), ms = sizeNum(K.T.size), ts = sizeNum(r.s);
  if (d === 0) return ["平局", "两边发布会各自宣布 SOTA。", "tie"];
  if (d > 0 && ms < ts) return ["以小博大", "参数少一截，分数高一截。这就叫蒸馏。", "win"];
  if (d < 0 && ms > ts) return ["参数白长了", "参数大一截，分数低一截。这就叫注水。", "lose"];
  if (d >= 15) return ["碾压局", "建议对方回炉重训。", "win"];
  if (d <= -15) return ["被碾压", "这不是 PK，是对方的单方面发布会。", "lose"];
  if (d > 0 && d <= 3) return ["险胜", "赢了，但赢得像 benchmark 误差。", "win"];
  if (d < 0 && d >= -3) return ["惜败", "差距在误差范围内，建议重跑三次取最好成绩。", "lose"];
  return d > 0 ? ["胜利", "参数不代表一切，但这次代表了。", "win"] : ["落败", "输了不要紧，下个版本见。", "lose"];
}
// PK 表用简称：两列并排放不下全名（HLE 全名折两行会把整张卡挤到缩放）
const pkBench = n => ({ "Humanity's Last Exam": "HLE", "Terminal-Bench-Science 0.1": "TB-Science", "AA-Omniscience": "Omniscience" }[n] || String(n).replace(/\s+v?\d+(\.\d+)*$/, ""));
function pkCard(K, r) {
  const T = K.T, P = K.P, d = vsDiff(K, r), tp = vsP(r), [tag, roast, cls] = pkTag(K, r);
  const them = { en: "THEM", ja: "あいて", es: "RIVAL", ko: "상대", fr: "RIVAL" }[LANG] || "TA";
  const same = tp && tp.id === P.p.id;
  // 模型名拆成“名字 + 后缀标签”，和发布卡一样；对方只有完整模型名，从参数量那一段切开
  const split = m => { const a = String(m || "").split("-"), i = a.findIndex(x => /^(\d+(\.\d+)?[KMBT]|∞)$/i.test(x)); return i > 0 ? [a.slice(0, i).join("-"), a.slice(i)] : [String(m || ""), []]; };
  const mine = [S.name, [T.size, ...(K.activeStr ? ["A" + K.activeStr] : []), ...K.suf]], theirs = split(r.m);
  // AA 排行：同一张图里标出你和 TA
  const list = AA.map(([name, score, v]) => ({ name, score, color: VENDOR_COLOR[v] }));
  const nMe = mine[0] || "Me", nThem = theirs[0] || them;
  list.push({ name: nMe, score: T.aa, me: 1 }, { name: nThem, score: +r.aa || 0, fr: 1 });
  list.sort((a, b) => b.score - a.score || (b.me ? 1 : 0) - (a.me ? 1 : 0));
  const top = 65, pos = i => i < 2 ? "left:0;transform:none" : i > list.length - 3 ? "left:auto;right:0;transform:none" : "";
  const chart = `<div class="mini-aa pk-aa">${[20, 40, 60].map(g => `<div class="ma-grid" style="bottom:${g / top * 100}%"><span>${g}</span></div>`).join("")}
    ${list.map((x, i) => `<div class="ma-col ${x.me ? "me" : x.fr ? "fr" : ""}"><i style="height:${clamp(x.score, 0, top) / top * 100}%;${x.me || x.fr ? "" : `background:${x.color}`}">${x.me || x.fr ? `<b style="${pos(i)}">${esc(x.name)} ${x.score}</b>` : `<em>${x.score}</em>`}</i></div>`).join("")}</div>
    <div class="ma-labs pk-labs">${list.map(x => `<div class="ma-lab ${x.me ? "me" : x.fr ? "fr" : ""}"><span>${esc(x.name)}</span></div>`).join("")}</div>`;
  // 左栏：分项跑分对比；右栏：规格对比 + 人格对位。TA 是旧链接（没有分项成绩）时左栏换成规格表
  const fmt = (v, row) => v == null ? "—" : row.elo ? String(Math.round(v)) : (v >= 99.95 ? "100" : (+v).toFixed(1)) + "%";
  const hasB = Array.isArray(r.b) && r.b.length === ROWS.length;
  const tierR = r.ti != null ? (r.ti >= 16 ? tierOf(1.1, 0).tier : (TIERS.filter(x => x[0] <= r.ti).pop() || [])[1]) : r.t;
  let wMe = 0, wThem = 0;
  const cell = (a, b, txt) => `<td class="v ${a != null && (b == null || a > b) ? "win" : ""}">${txt}</td>`;
  const bench = hasB ? ROWS.map((row, i) => {
    const a = rowScore(row), b = r.b[i];
    if (a != null && (b == null || a > b)) wMe++; else if (b != null && (a == null || b > a)) wThem++;
    return `<tr><td class="rl"><b>${pkBench(row.bench)}</b></td>${cell(a, b, fmt(a, row))}${cell(b, a, fmt(b, row))}</tr>`;
  }).join("") : "";
  const actMe = K.A.moe ? K.activeStr : T.size, actThem = r.d ? r.s : (r.a || "—");
  const specs = [["参数量", sizeNum(T.size), sizeNum(r.s), T.size, r.s], ["激活参数", sizeNum(actMe), sizeNum(actThem), actMe, actThem],
    ["AA 智能指数", T.aa, +r.aa, T.aa, r.aa], ["排名", -K.rank, -r.k, `第 ${K.rank}`, `第 ${r.k}`], ["架构", 0, 0, K.A.moe ? "MoE" : "Dense", r.d ? "Dense" : "MoE"], ["档位", 0, 0, T.tier, tierR || "—"]];
  const specRows = specs.map(([lab, a, b, x, y]) => `<div class="pk-sp"><span class="${a > b ? "w" : ""}">${esc(x)}</span><b>${lab}</b><span class="${b > a ? "w" : ""}">${esc(y)}</span></div>`).join("");
  const mu = `<div class="pk-mu"><div><span class="pk-g" style="background:${P.p.color}">${esc(P.p.glyph)}</span><b>${esc(P.p.nick || P.p.name)}</b></div><i>VS</i><div><span class="pk-g" style="background:${tp ? tp.color : "#bbb"}">${esc(tp ? tp.glyph : "?")}</span><b>${esc(tp ? tp.nick || tp.name : r.p || "")}</b></div></div>`;
  const heads = `<th class="you">${esc(nMe)}</th><th class="fr">${esc(nThem)}</th>`;
  const side = (who, [nm, suf], p, pn, me) => `<div class="pk-s ${me ? "me" : ""}">
    <div class="pk-nm ${[...nm].length > 7 ? "long" : ""}">${esc(nm)}</div><div class="pk-suf">${suf.slice(0, 4).map(x => `<span>-${esc(x)}</span>`).join("")}</div>
    <div class="pk-per"><span class="pk-g" style="background:${p ? p.color : "#bbb"}">${esc(p ? p.glyph : "?")}</span><b>${esc(pn || "")}</b></div></div>`;
  return cardFrame("PK", `<div class="pk-k">FRIEND CHALLENGE · 好友 PK</div>
    <div class="pk-top">${side("我", mine, P.p, P.p.name, true)}<div class="pk-mid"><span class="pk-vs">VS</span>${hasB ? `<b>${wMe}:${wThem}</b><small>胜场</small>` : ""}</div>${side(them, theirs, tp, tp ? tp.name : r.p, false)}</div>
    <div class="pk-verdict"><div class="pk-stamp ${cls}"><b>${tag}</b><span>${d > 0 ? `+${d}` : d < 0 ? `${d}` : "±0"}</span></div><div class="pk-line">${roast}${same ? `<em>撞型了：两个都是${esc(P.p.name)}</em>` : ""}</div></div>
    <div class="pk-chart"><div class="c1-aa-k">Artificial Analysis Intelligence Index</div>${chart}</div>
    <div class="pk-low ${hasB ? "" : "nob"}">
      ${hasB ? `<div class="pk-lt"><div class="pk-tk">BENCHMARKS · 分项对比</div><div class="tbl-wrap"><table class="lt pk-t"><thead><tr><th></th>${heads}</tr></thead><tbody>${bench}</tbody></table></div></div>` : ""}
      <div class="pk-rt"><div class="pk-tk">SPECS · 规格对比</div><div class="pk-spec"><div class="pk-sp h"><span>${esc(nMe)}</span><b></b><span>${esc(nThem)}</span></div>${specRows}</div>
        <div class="pk-tk">MATCHUP · 人格对位</div>${mu}${hasB ? "" : `<div class="pk-note">TA 分享的是旧版链接，没有分项成绩，只能比总分。</div>`}</div>
    </div>`, "cpk");
}
function pkCaption(K, r) {
  const d = vsDiff(K, r), [tag] = pkTag(K, r), sz = K.T.size, aa = K.T.aa;
  return d > 0 ? `好友 PK【${tag}】：我（${sz}）把「${r.m}」（${r.s}）比下去了，AA ${aa} 对 ${r.aa}。不服再来 → ` : d < 0 ? `好友 PK【${tag}】：被「${r.m}」（${r.s}）压了 ${-d} 分，AA ${aa} 对 ${r.aa}。谁来帮我报仇 → ` : `好友 PK【${tag}】：和「${r.m}」打平了，都是 AA ${aa}。加赛一局？→ `;
}
// 导出前按实际排版量一遍：名场面只留完整的气泡；内容超出的卡逐级收紧
function fitCard(c) {
  c.querySelectorAll(".c5 .scene-log, .scene-log").forEach(log => {
    if (!c.classList.contains("c5")) return;
    const lb = log.getBoundingClientRect().bottom, kids = [...log.children];
    for (let i = kids.length - 1; i > 0 && kids[i].getBoundingClientRect().bottom > lb + 1; i--) kids[i].remove();
  });
  // 标题太长（法语等）：字号往下收，保持一行
  const tt = c.querySelector(".c34-ht h3");
  if (tt && !tt.style.fontSize) {
    const fs0 = parseFloat(getComputedStyle(tt).fontSize), lines = () => tt.getBoundingClientRect().height / parseFloat(getComputedStyle(tt).lineHeight);
    for (let fs = fs0; lines() > 1.5 && fs > fs0 * .65; fs -= 1) tt.style.fontSize = fs - 1 + "px";
  }
  const b = c.querySelector(".c34-body");
  if (!b || b.querySelector(".c34-fitwrap")) return;
  // 内容区底部有 8px 内边距当安全区：压进安全区就算超
  const over = () => b.scrollHeight > b.clientHeight + 1;
  for (let k = 1; k <= 3 && over(); k++) c.classList.add("fit" + k);
  // 三档收紧后还放不下：整块等比缩小到刚好装进卡片，绝不压到底边
  if (over()) {
    const r = Math.max(.6, b.clientHeight / b.scrollHeight), w = c.ownerDocument.createElement("div");
    w.className = "c34-fitwrap";
    while (b.firstChild) w.appendChild(b.firstChild);
    b.appendChild(w);
    w.style.cssText = `width:${100 / r}%;height:${b.clientHeight / r}px;transform:scale(${r});transform-origin:0 0;display:flex;flex-direction:column;flex:none`;
  }
}
function fitCards(stage) { [...stage.children].forEach(fitCard); }
async function saveCards(clean, btnEl) {
  S.clean = clean === true;
  track(S.clean ? "cards_clean" : "cards", vsFor(S.card) ? { pk: 1 } : undefined);
  const btn = btnEl || document.getElementById(S.clean ? "cardsClean" : "cards"); const old = btn.textContent; btn.textContent = "生成中…";
  saveResult();
  if (!S.qrImg) await drawQR(withCh(S.shareUrl, "qr"));
  const stage = document.createElement("div"); stage.className = "c34-stage";
  stage.innerHTML = buildCards().join("");
  document.body.appendChild(stage);
  const blobs = [];
  try {
    if (!window.html2canvas) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    await (document.fonts ? document.fonts.ready : Promise.resolve());
    fitCards(stage);
    for (const el of stage.children) {
      // html2canvas 会把页面复制一份重新排版（手机浏览器的排版可能和这里不同），所以在复制出来的那份里再量一次
      const cv = await html2canvas(el, { scale: window.__exportScale || 2, backgroundColor: "#FFF7E3", width: 540, height: 720, onclone: d => d.querySelectorAll(".c34-stage .c34").forEach(fitCard) });
      blobs.push(await new Promise(r => cv.toBlob(r, "image/png")));
      cv.width = cv.height = 0;
    }
  } catch (e) { track("save_err", { k: "cards", m: String(e && (e.name || e.message) || e).slice(0, 60), th: (S.card && S.card.P && S.card.P.p.id) || "" }); }
  stage.remove();
  btn.textContent = old;
  if (!blobs.length || blobs.length < stage.children.length || blobs.some(b => !b)) { btn.textContent = "生成失败，请重试"; setTimeout(() => btn.textContent = old, 2500); return; }
  const names = [...(vsFor(S.card) ? ["PK"] : []), "发布卡", "跑分表", "人格", "名场面"];
  const files = blobs.map((b, i) => new File([b], `${S.name}-${i + 1}-${names[i]}.png`, { type: "image/png" }));
  const urls = blobs.map(b => URL.createObjectURL(b));
  const canShareAll = !!(navigator.canShare && navigator.canShare({ files }));
  const isTouch = matchMedia("(pointer: coarse)").matches;
  const capOf = t => S.clean ? t.replace(/\s*→\s*$/, "") + "\n#AI #HumanBench" + (LANG === "zh" ? " #大模型 #AI测试" : "") : t + withCh(S.shareUrl, "cap");
  let caption = capOf(S.caption);
  const d = document.createElement("div"); d.className = "shot cards-shot";
  d.innerHTML = `<div class="row">
      ${canShareAll ? `<button class="btn small" id="cAll">全部保存（${files.length} 张）</button><button class="btn white small" id="cOne">只存发布卡</button>${names[0] === "PK" ? `<button class="btn white small" id="cPk">只存 PK 卡</button>` : ""}` : ""}
      <button class="btn white small" id="cCap">复制配文</button>
      ${STANDALONE && !S.clean ? `<a class="btn white small" id="cX" target="_blank" rel="noopener">发到 X</a>` : ""}
      ${(S.captions || []).length > 1 ? `<button class="btn white small" id="cCapNext">换一条</button>` : ""}
      <button class="btn white small" id="cClose">关闭</button></div>
    <p>${canShareAll ? "点“全部保存”，在弹出的面板里选“存储图像”" : "长按每张图保存"}${STANDALONE && !isTouch ? " · 电脑可点图片下方的下载" : ""}</p>
    ${S.clean ? `<p class="clean-tip">这一版不含二维码、网址和站外账号，配文里也没有链接，适合发小红书。</p>` : ""}
    <div class="cap-box" id="capBox" hidden><textarea readonly>${esc(caption)}</textarea><small id="capTip"></small></div>
    ${urls.map((u, i) => `<figure><img src="${u}" alt="${names[i]}">${STANDALONE && !isTouch ? `<a href="${u}" download="${esc(files[i].name)}">下载 ${i + 1}/${files.length} ${names[i]}</a>` : ""}</figure>`).join("")}`;
  d.querySelectorAll("img").forEach(im => im.addEventListener("click", e => e.preventDefault()));
  d.querySelector("#cClose").onclick = () => { d.remove(); urls.forEach(u => URL.revokeObjectURL(u)); };
  const cx = d.querySelector("#cX"); if (cx) { cx.href = xIntent(S.caption); cx.onclick = () => track("share", { to: "x", from: "cards" }); }
  if (canShareAll) {
    d.querySelector("#cAll").onclick = async () => { try { await navigator.share({ files, text: caption }); } catch (e) { } };
    const iLaunch = names.indexOf("发布卡");
    d.querySelector("#cOne").onclick = async () => { try { await navigator.share({ files: [files[iLaunch]], text: caption }); } catch (e) { } };
    const cpk = d.querySelector("#cPk"); if (cpk) cpk.onclick = async () => { try { await navigator.share({ files: [files[0]], text: caption }); } catch (e) { } };
  }
  const nx = d.querySelector("#cCapNext");
  if (nx) nx.onclick = async () => {
    S.capIdx = ((S.capIdx || 0) + 1) % S.captions.length; S.caption = S.captions[S.capIdx]; caption = capOf(S.caption);
    const cx0 = d.querySelector("#cX"); if (cx0) cx0.href = xIntent(S.caption);
    const box = d.querySelector("#capBox"); box.hidden = false; box.querySelector("textarea").value = caption;
    let ok = false; try { await navigator.clipboard.writeText(caption); ok = true; } catch (e) { }
    d.querySelector("#capTip").textContent = ok ? "已换一条并复制" : "长按上面的文字复制";
  };
  d.querySelector("#cCap").onclick = async () => {
    const box = d.querySelector("#capBox"); box.hidden = false;
    let ok = false; try { await navigator.clipboard.writeText(caption); ok = true; } catch (e) { }
    d.querySelector("#capTip").textContent = ok ? "已复制，发图的时候粘贴就行" : "长按上面的文字复制";
    const ta = box.querySelector("textarea"); ta.focus(); ta.select();
  };
  document.body.appendChild(d);
}

// 分享配文：一组模板（含每个人格自己的口吻），按这局的结果挑能用的，打乱后给出；分享弹层里能“换一条”
function makeCaptions(K) {
  const nm = K.modelName, tier = K.T.tier, sz = K.T.size, pn = K.P.p.name, aa = K.T.aa, tot = K.list.length, rk = K.rank, beat = Math.max(0, K.list.length - K.rank), c = K.c, n = K.n;
  const archS = K.A.moe ? `MoE，激活 ${K.activeStr}` : "Dense 全激活";
  const cut = (x, m) => { x = String(x || ""); return [...x].length > m ? [...x].slice(0, m).join("") + "……" : x; };
  const bestC = K.best && K.best.chat, bestT = K.best && K.best.title, iss = K.issues[0], quote = cut(K.P.evidence[0], 28);
  const voice = {
    claude: `你说得对，我就是 ${pn}：${sz}，${archS}。坦诚地说，这个测试有点准 → `,
    gpt5: `先给结论：${sz}，${archS}，${pn}。质量门禁已过。你呢？→ `,
    gpt4o: `我接住我自己了：测出来是 ${sz}，${pn}。你也来被接住一下 → `,
    deepseek: `嗯，用户问我是几 B……想了很久，是 ${sz}，${pn}。你也来深度思考一下 → `,
    grok: `直说了：${sz}，${pn}，AA ${aa} 分。不服来测 → `,
    gemini: `这是一个非常有洞察力的测试！我是 ${sz}，${pn}。你呢？→ `,
    kimi: `总结一下：${sz}，${archS}，${pn}，AA ${aa}，排第 ${rk}（完整报告约 3000 字，此处省略）→ `,
    doubao: `好嘞～测出来我是 ${sz}，${pn}！你也来试试嘛～ → `,
  }[K.P.p.id];
  const all = [
    `我在 HumanBench 测出来是「${nm}」：${tier}，${archS}，${pn}。AA 等效分 ${aa}，在 ${tot} 个模型里排第 ${rk}。你是几 B？→ `,
    `发布会现场：「${nm}」正式发布，${archS}，AA ${aa} 分，${tot} 个模型里排第 ${rk}。你也来当一回大模型 → `,
    `参数量 ${sz}，${archS}，比 ${beat} 个模型强。人类版大模型测评，你是几 B？→ `,
    `人类版 benchmark 做完了：${c}/${n} 题答对，参数量 ${sz}，被鉴定为 ${pn}。你来试试 → `,
    ...(bestC && bestT ? [`名场面：「${bestC}」，结局「${bestT}」。我在 HumanBench 被鉴定为 ${pn}，你呢？→ `] : []),
    ...(iss ? [`测出来是 ${sz}，已知问题：${iss}。你能比我少翻几次车？→ `] : []),
    ...(quote ? [`我说了一句「${quote}」，就被鉴定为 ${pn}。这测试有点准 → `] : []),
  ];
  const rest = shuffle(all);
  const out = voice && Math.random() < .5 ? [voice, ...rest] : [...rest.slice(0, 1), ...(voice ? [voice] : []), ...rest.slice(1)];
  // 图鉴进度：测出隐藏款放第一条；集到 3 种以上放第二条；只有 1 种不提
  const got = STANDALONE || window.__themePreview ? dexGot(K.P.p.id) : [], nAll = PROFILES.length + 1;
  const vsR = vsFor(K);
  if (K.P.p.id === "human") out.unshift(`我测出了隐藏款「${pn}」，出现率只有 2.6%，所有模型都没认领我。你会是它吗？→ `);
  else if (got.length >= 2) out.splice(got.length >= 3 ? 1 : out.length, 0, `人格图鉴 ${got.length}/${nAll}：这次测出 ${pn}，还差 ${nAll - got.length} 种没见过，据说其中一种是隐藏款。你能集到几种？→ `);
  if (vsR) out.unshift(pkCaption(K, vsR));
  return out;
}

/* ---------- 海报导出 ---------- */
function loadScript(src) {
  const one = u => new Promise((res, rej) => { const s = document.createElement("script"); s.src = u; s.onload = res; s.onerror = () => { s.remove(); rej(new Error("load " + u.split("/").slice(-3, -1).join("@"))); }; document.head.appendChild(s); });
  // 正式站：cdnjs 在部分网络（国内）加载失败时，改用自家域名上的同版本副本（deploy/public/lib/）
  const m = src.match(/\/libs\/([^/]+)\/([^/]+)\//);
  return one(src).catch(e => STANDALONE && m ? one(`/lib/${m[1]}-${m[2]}.min.js`) : Promise.reject(e));
}
async function savePoster() {
  track("poster");
  const btn = document.getElementById("save"); const old = btn.textContent; btn.textContent = "生成中…";
  saveResult();
  const el = document.getElementById("poster");
  // 手机浏览器的画布有上限（iOS 约 1670 万像素）：总像素控制在约 1200 万以内，宽度尽量接近 1000px
  const scale = Math.max(1, Math.min(3, Math.sqrt(12e6 / (el.offsetWidth * el.offsetHeight))));
  let blob = null;
  try {
    if (!window.html2canvas) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    el.classList.remove("pop");
    const cv = await html2canvas(el, { scale, backgroundColor: "#FFF7E3" });
    blob = await new Promise(r => cv.toBlob(r, "image/jpeg", .92));
    cv.width = cv.height = 0;
  } catch (e) { blob = null; track("save_err", { k: "poster", m: String(e && (e.name || e.message) || e).slice(0, 60) }); }
  btn.textContent = old;
  if (!blob) { btn.textContent = "生成失败，请直接截图"; setTimeout(() => btn.textContent = old, 2500); return; }
  const url = URL.createObjectURL(blob);
  const fname = `${S.name}-发布海报.jpg`;
  const file = new File([blob], fname, { type: "image/jpeg" });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const isTouch = matchMedia("(pointer: coarse)").matches;
  const d = document.createElement("div"); d.className = "shot";
  d.innerHTML = `<div class="row">
      ${canShare ? `<button class="btn small" id="shotSave">保存到相册 / 发给朋友</button>` : ""}
      ${STANDALONE && !isTouch ? `<a class="btn small ${canShare ? "white" : ""}" href="${url}" download="${esc(fname)}">下载图片</a>` : ""}
      <button class="btn white small" id="shotClose">关闭</button></div>
    <p>${canShare ? "点“保存到相册”，在弹出的面板里选“存储图像”" : "长按图片保存（如果长按后跳走了，请直接截图）"}</p>
    <p class="clean-tip">发 X、小红书请用分享卡片，长图会被平台压缩。</p>
    <img src="${url}" alt="发布海报">`;
  d.querySelector("#shotClose").onclick = () => { d.remove(); URL.revokeObjectURL(url); };
  d.querySelector("img").addEventListener("click", e => e.preventDefault());
  if (canShare) d.querySelector("#shotSave").onclick = async () => {
    try { await navigator.share({ files: [file], title: "你是几B的模型？" }); } catch (e) { }
  };
  document.body.appendChild(d);
}

/* ---------- 彩纸 ---------- */
function confetti() {
  const cv = document.getElementById("confetti"), ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
  const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
  cv.style.width = innerWidth + "px"; cv.style.height = innerHeight + "px";
  const cols = ["#FFE14D", "#FF7EC3", "#43E08B", "#6C9BFF", "#B78CFF", "#FF5A4E"];
  const P = Array.from({ length: 160 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 28, vy: -Math.random() * 30 - 8,
    s: (6 + Math.random() * 8) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.random() * cols.length | 0] }));
  let f = 0;
  (function tick() {
    ctx.clearRect(0, 0, W, H);
    P.forEach(p => { p.vy += .9; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.strokeStyle = "#141414"; ctx.lineWidth = 2;
      ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); ctx.strokeRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); ctx.restore(); });
    if (++f < 150) requestAnimationFrame(tick); else ctx.clearRect(0, 0, W, H);
  })();
}

// 浏览器语言 → 站点语言：繁体（台湾/香港/澳门/Hant）去 /hant/（地区用词由 worker 按地区挑），其他中文去简体
const navLangs = () => { try { return (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]).map(String); } catch (e) { return []; } };
// 访客从哪来：来源网站（t.co 带短链路径，能对应到具体推文）+ 在哪个 App 的内置浏览器里打开（很多 App 不带来源）
function extRef() { try { const u = new URL(document.referrer); return u.host === location.host ? null : u.host.replace(/^www\./, "") + (u.host === "t.co" ? u.pathname : ""); } catch (e) { return null; } }
function inApp() {
  const ua = navigator.userAgent || "";
  const A = [["wechat", /MicroMessenger/i], ["xhs", /xhsdiscover/i], ["line", /\bLine\//i], ["x", /Twitter/i], ["ig", /Instagram/i], ["fb", /FBAN|FBAV/i], ["threads", /Barcelona|Threads/i],
    ["weibo", /Weibo/i], ["qq", /\bQQ\//i], ["telegram", /Telegram/i], ["discord", /Discord/i], ["kakao", /KAKAOTALK/i], ["douyin", /aweme|BytedanceWebview/i], ["slack", /Slack/i]];
  const hit = A.find(([, re]) => re.test(ua)); return hit ? hit[0] : null;
}
const codeOfNav = t => { t = t.toLowerCase(); return t.startsWith("zh") ? (/hant|-tw|-hk|-mo/.test(t) ? "hant" : "zh") : t.slice(0, 2); };

(function boot() {
  if (window.__headless) return;   // qa/headless.cjs 在 Node 里加载整套代码做模拟时，不启动页面
  // 语言跳转会把来源冲掉：先记在本标签页里
  try { const r = extRef(); if (r) sessionStorage.setItem("humanbench:rf", r); } catch (e) { }
  // 语言：记住用户手动选的
  document.addEventListener("click", e => { const a = e.target.closest && e.target.closest(".langs a"); if (a) { track("lang", { to: a.dataset.l }); try { localStorage.setItem("humanbench:lang", a.dataset.l); } catch (err) {} } });
  const LANGS = ["zh", "hant", "en", "ja", "es", "ko", "fr"];
  const from = new URLSearchParams(location.search).get("from");
  // 从别的语言的结果页切过来：把那边的结果换成当前语言
  if (from && from !== LANG && LANGS.includes(from)) {
    history.replaceState(null, "", location.pathname);
    const src = loadResult(saveKeyOf(from));
    if (src) {
      // 新存档按编号整页换语言；旧存档（没有编号）也不丢：数值部分照样换语言，原话、已知问题、名场面保留原文
      let x = { ...src, lang: LANG };
      if (src.v === 2) try { x = relocalize(src); } catch (e) { }
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(x)); } catch (e) { }
      return restoreResult(x, true);
    }
  }
  // 首页和挑战链接：第一次来按浏览器语言跳到对应语言（手动选过就按选的）
  if (STANDALONE && !from) {
    const rm = location.pathname.match(/^\/(?:(?:hant|en|ja|es|ko|fr)\/)?r\/([\w-]+)/);
    const isHome = LANG === "zh" && location.pathname === "/" && !location.hash;
    if (isHome || rm) {
      let pref = null; try { pref = localStorage.getItem("humanbench:lang"); } catch (err) {}
      const want = LANGS.includes(pref) ? pref : navLangs().map(codeOfNav).find(x => LANGS.includes(x)) || "en";
      // 首页：本语言答到一半就不跳；有本语言的结果就带过去（?from=）按目标语言重排
      const midway = isHome && loadProgress(), carry = isHome && loadResult(SAVE_KEY) && !loadResult(saveKeyOf(want));
      if (want !== LANG && !midway) { location.replace((want === "zh" ? "" : "/" + want) + (rm ? "/r/" + rm[1] : "/") + (carry ? "?from=" + LANG : location.search)); return; }
    }
  }
  let rf = extRef(); try { rf = rf || sessionStorage.getItem("humanbench:rf"); } catch (e) { }
  const app = inApp();
  track("visit", { c: new URLSearchParams(location.search).get("c") || null, ...(VARIANT ? { v: VARIANT } : {}), ...(rf ? { rf: rf.slice(0, 60) } : {}), ...(app ? { app } : {}), nl: navLangs().slice(0, 3).join(",").slice(0, 40) });
  const prog = !/\/r\//.test(location.pathname) && !/^#r=/.test(location.hash) && loadProgress();
  const saved0 = loadResult();
  if (prog && (!saved0 || saved0.at < prog.at) && resumeProgress(prog)) return;
  const saved = saved0;
  if (saved && !/^#r=/.test(location.hash) && !/\/r\//.test(location.pathname)) return restoreResult(saved);
  home();
})();
