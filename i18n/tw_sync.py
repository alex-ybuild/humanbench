"""繁体中文版：从简体源文件自动转换，build.py 每次构建时调用，简体改了繁体自动跟上。
- /tw/ 台湾：OpenCC s2twp（繁体 + 台湾用词），修正表 i18n/tw_fix.json + i18n/tw/_review/*.json
- /hk/ 香港：OpenCC s2hk（香港字形，不换词），修正表 i18n/hk_fix.json + i18n/hk/_review/*.json
- 题库 bank/chats/arc/lv4.js → i18n/<v>/*.js（模型鉴定 id 保持简体原样，界面层靠 id 匹配）
- app.js 界面片段 → i18n/<v>/ui.json
- 修正表每条 [转换后的文字, 想要的文字, (理由)]，按顺序替换；越长越具体越安全
"""
import os, sys, re, json, collections
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, "_vendor")); sys.path.insert(0, HERE)
from opencc import OpenCC
import ui_tool
KEEP = {"豆包", "GPT-5 系"}  # 界面层按简体 id 匹配
VARIANTS = {"tw": "s2twp", "hk": "s2hk"}
_Q = lambda x: x.replace("“", "「").replace("”", "」")  # 港台都用直角引号


def fixes(v):
    F = []
    base = os.path.join(HERE, f"{v}_fix.json")
    if os.path.exists(base): F += [e[:2] for e in json.load(open(base, encoding="utf-8"))]
    rv = os.path.join(HERE, v, "_review")
    for f in sorted(os.listdir(rv)) if os.path.isdir(rv) else []:
        if f.endswith(".json"): F += [e[:2] for e in json.load(open(os.path.join(rv, f), encoding="utf-8"))]
    return [[_Q(a), _Q(b)] for a, b in F]


class Conv:
    def __init__(self, v):
        self.cc = OpenCC(VARIANTS[v]); self.fix = fixes(v)

    def __call__(self, s):
        t = _Q(self.cc.convert(s))
        for a, b in self.fix: t = t.replace(a, b)
        return t


def ids_of(src):
    return set(re.findall(r'\bid:\s*"([^"]*[一-鿿][^"]*)"', src)) | set(re.findall(r'E\(\s*"(?:[^"\\]|\\.)*"\s*,\s*"(?:[^"\\]|\\.)*"\s*,\s*"([^"]*[一-鿿][^"]*)"\s*\)', src))  # 只认三参数 E(标题, 正文, id)


def sync(v="tw"):
    conv = Conv(v)
    out = os.path.join(HERE, v); os.makedirs(out, exist_ok=True)
    ids = set(KEEP)
    srcs = {f: open(os.path.join(ROOT, f), encoding="utf-8").read() for f in ["bank.js", "chats.js", "arc.js", "lv4.js"]}
    for s in srcs.values(): ids |= ids_of(s)
    for f, s in srcs.items():
        t = conv(s)
        for i in ids:
            c = conv(i)
            if c != i: t = t.replace(f'"{c}"', f'"{i}"')
        open(os.path.join(out, f), "w", encoding="utf-8", newline="\n").write(t)
    app = open(os.path.join(ROOT, "app.js"), encoding="utf-8").read()
    table = {}
    for line in app.split("\n"):
        for seg in ui_tool.segments_of(ui_tool.code_part(line)):
            if seg in KEEP or seg in table: continue
            c = conv(seg)
            if c != seg: table[seg] = c
    json.dump(table, open(os.path.join(out, "ui.json"), "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)
    return len(table)


def sync_all(langs):
    for v in VARIANTS:
        if v in langs: sync(v)


def residue(v="tw"):
    """繁体结果里还剩多少“简体专用字”（按 s2t 会变的字粗筛，后/里/面/干 这类繁体也用的字会误报）"""
    s2t = OpenCC("s2t"); cnt = collections.Counter()
    for f in ["bank.js", "chats.js", "arc.js", "lv4.js", "ui.json"]:
        t = open(os.path.join(HERE, v, f), encoding="utf-8").read()
        t = re.sub(r'//.*|/\*[\s\S]*?\*/', '', t)
        for k in KEEP: t = t.replace(k, "")
        if f == "ui.json": t = "".join(json.loads(t).values())
        for c in re.findall(r'[一-鿿]', t):
            if s2t.convert(c) != c: cnt[c] += 1
    return cnt


if __name__ == "__main__":
    for v in sys.argv[1:] or list(VARIANTS):
        print(v, "ui segments:", sync(v)); print("  疑似简体字:", residue(v).most_common(30))
