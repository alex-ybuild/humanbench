"""扩题合并：python3 i18n/new/merge3.py <lang> [轮次，默认 3]
把 i18n/new/<lang><轮次>_*.js 追加进题库（zh 写根目录的 bank.js / chats.js / lv4.js，其他语言写 i18n/<lang>/ 下同名文件）。
- 能力题、新图表、新界面 → lv4.js；名场面（chats*）→ chats.js；人格小对话 / AI 味现场 / 随手题（persona* / vibes* / slop*）→ bank.js
- 每个源文件包在一个立即执行函数里（const/var 都不外泄；qa 脚本会把 const 换成 var，用块作用域会重复追加），按固定顺序追加，各语言顺序一致，题目下标才对得上
- 第 3 轮按 ORDER；之后的轮次按中文稿件文件名排序（其他语言缺哪个会提示）。稿件里的变量名一律沿用 ADD3 / ADD3_CHATS / ADD3_PERSONA …（每个文件在自己的函数里，不会冲突），qa/add3_check.cjs 也按这些名字检查
- 写在 /* ADD<轮次> begin */ … /* ADD<轮次> end */ 之间：重复运行在原位置整段替换（不挪到文件末尾，免得后面轮次的题目下标变了）；第一次运行追加在文件末尾
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NEW = os.path.join(ROOT, "i18n", "new")
ORDER = ["traps", "knowledge", "dense_hle", "sci_front_gdp", "dev", "chart", "osworld", "chats_a", "chats_b", "chats_c", "persona", "vibes"]
TAIL = {
    "lv4.js": 'if (typeof ADD3_CHARTS !== "undefined") Object.assign(CHARTS, ADD3_CHARTS);\n'
              'if (typeof ADD3_UIS !== "undefined") Object.assign(UIS, ADD3_UIS);\n'
              'if (typeof ADD3 !== "undefined") for (const k in ADD3) POOLS[k].push(...ADD3[k]);',
    "chats.js": 'CHATS.push(...ADD3_CHATS);',
    "bank.js": 'if (typeof ADD3_PERSONA !== "undefined") for (const k in ADD3_PERSONA) PERSONA_Q[k].push(...ADD3_PERSONA[k]);\n'
               'if (typeof ADD3_SLOP !== "undefined") SLOP_VIBES.push(...ADD3_SLOP);\n'
               'if (typeof ADD3_VIBES !== "undefined") VIBES.push(...ADD3_VIBES);',
}
LABEL = {3: "第三轮扩题（2026-09-28）"}


def target_of(name):
    if name.startswith("chats"): return "chats.js"
    if name.startswith(("persona", "vibes", "slop")): return "bank.js"
    return "lv4.js"


def order_of(rnd):
    if rnd == 3: return ORDER
    pre = f"zh{rnd}_"
    return sorted(f[len(pre):-3] for f in os.listdir(NEW) if f.startswith(pre) and f.endswith(".js"))


def main(lang, rnd=3):
    base = ROOT if lang == "zh" else os.path.join(ROOT, "i18n", lang)
    begin, end = f"/* ADD{rnd} begin */", f"/* ADD{rnd} end */"
    label = LABEL.get(rnd, f"第 {rnd} 轮扩题")
    blocks = {}
    for name in order_of(rnd):
        f = os.path.join(NEW, f"{lang}{rnd}_{name}.js")
        if not os.path.exists(f):
            print("缺", os.path.basename(f)); continue
        blocks.setdefault(target_of(name), []).append((name, open(f, encoding="utf8").read().strip()))
    if not blocks: print(f"没有找到 i18n/new/{lang}{rnd}_*.js"); return
    for target, items in blocks.items():
        path = os.path.join(base, target)
        s = open(path, encoding="utf8").read()
        body = "\n".join(f"(() => {{ // {label}：{name}\n{src}\n{TAIL[target]}\n}})();" for name, src in items)
        block = f"{begin}\n{body}\n{end}\n"
        old = re.compile(r"\n*" + re.escape(begin) + r".*?" + re.escape(end) + r"\n?", re.S)
        m = old.search(s)
        if m and s[m.end():].strip():   # 后面还有别的轮次：原位替换
            s = s[:m.start()] + "\n\n" + block + s[m.end():]
        else:
            s = old.sub("\n", s).rstrip() + "\n\n" + block
        open(path, "w", encoding="utf8", newline="\n").write(s)   # Windows 上也写 LF
        print(target, "←", ", ".join(n for n, _ in items))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "zh", int(sys.argv[2]) if len(sys.argv) > 2 else 3)
