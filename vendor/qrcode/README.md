# Vendored QR Code generator

The files in this directory are the QR Code generator for JavaScript by
**Kazuhiko Arase** (the engine shipped inside `qrcode-terminal`):

- Upstream project: https://github.com/kazuhikoarase/qrcode-generator
- License: **MIT** — see the header of `index.js` and `THIRD_PARTY_NOTICES.md`
  in this package root.
- The `.js` files are kept byte-identical to the version vendored by
  `qrcode-terminal` (MIT engine portion), so generated matrices (auto version,
  error-correction level L, 8-bit byte mode) are fully compatible with what
  `qrcode-terminal` prints.

This directory carries its own `package.json` with `"type": "commonjs"`
because the enclosing package is ESM (`"type": "module"`). The host side
imports it from `lib/qr.js` through Node's CommonJS interop.
