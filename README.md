# PocketPad

**Mobile code editor** — zero-build PWA. No npm.

Open tabs, run code, talk to Termux, push to GitHub, export a ZIP. Works from any static host.

![status](https://img.shields.io/badge/build-zero--build-brightgreen) ![pwa](https://img.shields.io/badge/PWA-ready-blue)

## Live demo

**https://pocketpad-gilt.vercel.app**

GitHub: [Architect-Brad/pocketpad](https://github.com/Architect-Brad/pocketpad)  
Auto-deploys to Vercel on push to `main`.

## Run locally (30 seconds)

```bash
# any static server from this folder
python3 -m http.server 8080
```

Open **http://localhost:8080** on desktop or phone.

| Goal | How |
|------|-----|
| Production | Vercel (linked repo) — `vercel --prod` or push to `main` |
| Install as app | Browser menu → **Add to Home Screen** (HTTPS) |
| Offline-friendly | Libraries are in `vendor/` with CDN fallback |

Refresh vendor copies anytime (optional, needs network):

```bash
python3 scripts/fetch-vendor.py
```

## Features

- Multi-tab editing (CodeMirror 5), 20+ languages  
- **File tree** of open files · Open **folder** (Chromium) · **Export ZIP**  
- Find/replace, word completion, themes, spell check  
- Run: JavaScript, Python (Skulpt), HTML preview, Piston (C/C++/Rust/…)  
- Document map, snippets, GitHub browse/commit/diff  
- Shell via xterm + WebSocket (Termux + `ttyd`)  
- Session restore via **IndexedDB** (localStorage fallback)  
- Save/open via **File System Access API** when available  

### Shortcuts

| Keys | Action |
|------|--------|
| Ctrl/Cmd+S | Save |
| Ctrl/Cmd+O | Open file |
| Ctrl/Cmd+F | Find |
| Ctrl/Cmd+B | File tree |
| Ctrl/Cmd+M | Document map |
| Ctrl/Cmd+N | New tab |
| Ctrl/Cmd+\` | Shell pane |
| Ctrl/Cmd+Enter | Run |

### Termux shell

```bash
pkg install ttyd
ttyd -p 8080 -W bash
```

In PocketPad: **Shell → Connect** → `ws://localhost:8080`  
(If the editor is also on 8080, use another port for ttyd, e.g. `7681`.)

## Project layout

```
index.html          # app (HTML + CSS + JS)
manifest.json       # PWA
sw.js               # service worker
logo.svg            # icon
vendor/             # local copies of CodeMirror, xterm, Skulpt, …
scripts/fetch-vendor.py
index.legacy.html   # older single-file backup
```

## Notes

- Renamed from “Notepad++ Mobile” to avoid trademark clash; personal forks can rebrand freely.  
- GitHub PAT is stored in the browser — use a fine-scoped token.  
- Folder open / native save need a secure context (HTTPS or localhost) and a Chromium-based browser.

## License

Use and modify freely for your own projects unless you add a license file.
