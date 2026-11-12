"""What the ABI Builder merchant page holds: prints the shape of its data (run after merchant_extract.py has saved the page,
or it downloads it to tools/out/merchant.html)."""
import json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "tools", "out", "merchant.html")

def page():
    if not os.path.exists(PAGE):
        req = urllib.request.Request("https://abibuilder.com/merchant", headers={"User-Agent": "Mozilla/5.0"})
        open(PAGE, "wb").write(urllib.request.urlopen(req).read())
    return open(PAGE, encoding="utf-8").read()

def payload(html):
    """The page's data stream: the strings in self.__next_f.push([1, "..."]), decoded and joined."""
    out = []
    for m in re.finditer(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', html):
        out.append(json.loads(m.group(1)))
    return "".join(out)

def obj_at(text, start):
    """The JSON object or array that opens at text[start]."""
    depth, i, q = 0, start, False
    while i < len(text):
        c = text[i]
        if q:
            if c == "\\": i += 1
            elif c == '"': q = False
        elif c == '"': q = True
        elif c in "{[": depth += 1
        elif c in "}]":
            depth -= 1
            if not depth: return json.loads(text[start:i + 1])
        i += 1

def data(text):
    """The object that has both "items" and "profiles"."""
    i = text.find('"profiles":[')
    while i > 0:
        j = text.rfind("{", 0, i)
        # walk out until the object holds items too
        while j >= 0:
            try:
                o = obj_at(text, j)
                if isinstance(o, dict) and isinstance(o.get("items"), list) and isinstance(o.get("profiles"), list): return o
            except Exception: pass
            j = text.rfind("{", 0, j)
        i = text.find('"profiles":[', i + 1)

if __name__ == "__main__":
    d = data(payload(page()))
    if not d: sys.exit("no data found")
    for k, v in d.items():
        print(k, type(v).__name__, len(v) if hasattr(v, "__len__") else v)
        if isinstance(v, list) and v: print("   e.g.", json.dumps(v[0])[:600])
        elif isinstance(v, dict): print("   e.g.", json.dumps(v)[:600])
