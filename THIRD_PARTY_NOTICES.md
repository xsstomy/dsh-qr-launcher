# Third-Party Notices

This package redistributes or depends on the following third-party software:

## Bundled runtime code

### QR Code generator for JavaScript (vendored, shipped in `vendor/qrcode/`)

- Source: Kazuhiko Arase — https://github.com/kazuhikoarase/qrcode-generator
- Obtained via the `qrcode-terminal` package (https://github.com/gtanner/qrcode-terminal),
  which vendors this engine (MIT-licensed portion).
- License: MIT (see the header of `vendor/qrcode/index.js`).
- Files: `vendor/qrcode/*.js` — used unchanged (CommonJS scope) to generate QR
  matrices on the host; the browser bundle ships its own copy of the same
  matrices injected per page load.
- The word "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.

## Development-only dependencies (not shipped at runtime)

| Package | License |
| :--- | :--- |
| `jsqr` (QR decoding in tests) | MIT |
| `playwright-core` (optional e2e helper launching a locally installed browser) | Apache-2.0 |

## Full license texts

### MIT License (vendored QR engine)

```
Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Other dependencies' licenses are available in the npm registry descriptions.