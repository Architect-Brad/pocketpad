# Vendor libraries

PocketPad loads editor libraries from `./vendor/` first, then falls back to CDN if a file is missing (`data-cdn` + `onerror`).

## Refresh local copies

From the project root (needs network):

```bash
python3 scripts/fetch-vendor.py
```

Or:

```bash
bash scripts/fetch-vendor.sh
```

After a successful fetch, the app works better offline and survives CDN outages.
