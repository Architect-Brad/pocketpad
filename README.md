# PocketPad

A **mobile-first code editor** that runs entirely in the browser — multi-tab editing, run consoles, GitHub, and a Termux shell — as a zero-build PWA.

**[Open live demo →](https://pocketpad-gilt.vercel.app)**

[![Deploy](https://img.shields.io/badge/deploy-Vercel-black)](https://pocketpad-gilt.vercel.app)
[![Repo](https://img.shields.io/badge/github-Architect--Brad%2Fpocketpad-blue)](https://github.com/Architect-Brad/pocketpad)

---

## Features

| Area | What you get |
|------|----------------|
| **Editor** | Multi-tab CodeMirror, 20+ languages, find/replace, **hybrid autocomplete** (keywords · builtins · snippets · doc words), themes |
| **Files** | File tree, open folder (Chromium), save via File System Access, export ZIP |
| **Run** | Remote code execution via **Judge0 CE** (default) + **Piston API** (custom URL/token) · local JS/Python fallback · HTML & Markdown preview |
| **GitHub** | Browse repos, open files, commit & push, simple diff |
| **Shell** | xterm + WebSocket (Termux + `ttyd`) |
| **Extras** | Document map, snippets, spell check |
| **Session** | Auto-save to IndexedDB (localStorage fallback) |
| **Install** | PWA — Add to Home Screen on HTTPS |

### Keyboard shortcuts

| Keys | Action |
|------|--------|
| `Ctrl/Cmd + S` | Save |
| `Ctrl/Cmd + O` | Open file |
| `Ctrl/Cmd + F` | Find |
| `Ctrl/Cmd + B` | Toggle file tree |
| `Ctrl/Cmd + M` | Document map |
| `Ctrl/Cmd + N` | New tab |
| `Ctrl/Cmd + \`` | Shell pane |
| `Ctrl/Cmd + Enter` | Run |
| `Ctrl/Cmd + Space` | Autocomplete |

---

## Quick start

### Production

Already deployed on Vercel. Pushes to `main` redeploy automatically.

```
https://pocketpad-gilt.vercel.app
```

### Local

Serve the project root with any static server (service worker needs `http://` or `https://`, not `file://`):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

### Termux shell

```bash
pkg install ttyd
ttyd -p 7681 -W bash
```

In PocketPad: **Shell → Connect** → `ws://localhost:7681`

---

## Project layout

```
index.html              # Full app (UI + logic)
manifest.json           # PWA manifest
sw.js                   # Service worker
logo.svg                # App icon
vercel.json             # Vercel headers / rewrites
404.html                # SPA-style fallback
lib/                    # ES modules (Intelli engine, language analyzers)
vendor/                 # Vendored editor libs (local-first, CDN fallback)
scripts/fetch-vendor.py # Optional: refresh vendor/ from CDN
```

Libraries load from `vendor/` first; if a file is missing, they fall back to CDN. To re-download vendor assets:

```bash
python3 scripts/fetch-vendor.py
```

---

## Notes

- **Code execution** defaults to the public [Piston](https://emkc.org/api/v2/piston) API (`emkc.org`). Requires network. Toggle **Settings → Run via Piston API** off to use the in-browser JS/Python sandboxes instead.
- Optional **stdin** appears in the console when Piston is active.


- **GitHub PAT** is stored in the browser for the GitHub panel — use a fine-scoped token and sign out on shared devices.
- **Open folder** and native save need a secure context (HTTPS or localhost) and a Chromium-based browser.
- Spell-check dictionary still loads from the network on first use.

---

## License

Use and modify freely unless a separate license file is added.
