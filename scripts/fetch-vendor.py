#!/usr/bin/env python3
"""Download CDN assets referenced by index.html into vendor/."""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
VENDOR = ROOT / "vendor"


def to_local(url: str) -> Path:
    u = urlparse(url)
    if "cdnjs.cloudflare.com" in u.netloc:
        rel = "cdnjs" + u.path.replace("/ajax/libs", "")
    else:
        rel = "jsdelivr" + u.path.replace("/npm", "")
    return VENDOR / rel.lstrip("/")


def main() -> None:
    html = HTML.read_text(encoding="utf-8")
    # Prefer original CDN URLs from data-cdn attrs, else raw https links
    urls = set(re.findall(r'data-cdn="(https://[^"]+)"', html))
    urls |= set(re.findall(r'https://(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)[^"\']+', html))
    mapping = {}
    ok = fail = 0
    for url in sorted(urls):
        local = to_local(url)
        mapping[url] = local.relative_to(ROOT).as_posix()
        local.parent.mkdir(parents=True, exist_ok=True)
        if local.exists() and local.stat().st_size > 100:
            print("skip", local)
            ok += 1
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "PocketPad-vendor/1.0"})
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
            local.write_bytes(data)
            print("ok  ", local, len(data))
            ok += 1
        except Exception as e:
            print("fail", url, e)
            fail += 1
    (VENDOR / "mapping.json").write_text(json.dumps(mapping, indent=2), encoding="utf-8")
    print(f"done ok={ok} fail={fail}")


if __name__ == "__main__":
    main()
