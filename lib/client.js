/**
 * dsh-qr-launcher 浏览器端 bundle（单文件，经 __ModuleLoader__ 加载）。
 *
 * 在 DSH 设置页注册「二维码访问」分节：
 *   - 读取宿主在 index 响应中注入的 JSON 状态（window 的
 *     <script id="dsh-qr-launcher-state">），渲染局域网访问二维码（canvas）；
 *   - 二维码下方提供可复制的明文 URL、尺寸调节与手动刷新；
 *   - 覆盖三种异常状态（未绑定局域网 / 未探测到 IP / 认证不可用）。
 *
 * 数据通道：无 RPC —— 状态由宿主每次下发 index 时实时采样注入，
 * 页面刷新即拿到最新 IP/端口/token。样式全部走 --dsw-* 主题变量。
 */

window.__ModuleLoader__.load({
  id: 'dsh-qr-launcher',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const { createElement: el, Fragment, useState, useEffect, useMemo, useCallback } = React

    // ── 状态读取（宿主注入的 JSON） ─────────────────────────────────────────

    var STATE_TAG_ID = 'dsh-qr-launcher-state'

    function readState() {
      var node = typeof document !== 'undefined' ? document.getElementById(STATE_TAG_ID) : null
      if (!node) return null
      try {
        return JSON.parse(node.textContent)
      } catch (error) {
        console.warn('[dsh-qr-launcher] failed to parse injected state', error)
        return null
      }
    }

    // ── 文案（中/英，按浏览器语言） ─────────────────────────────────────────

    var COPY = {
      zh: {
        sectionLabel: '二维码访问',
        title: '手机扫一扫，即刻使用 DSH',
        subtitle: '局域网访问二维码（含访问令牌）',
        urlLabel: '明文 URL（可复制分享给可信设备）',
        copy: '复制链接',
        copied: '已复制 ✓',
        refresh: '刷新',
        sizeSmaller: '缩小',
        sizeLarger: '放大',
        ipLabel: '局域网 IP',
        portLabel: '端口',
        statusOk: '✓ 已就绪',
        security: '安全提示：二维码包含访问令牌（token），任何人扫码即可访问本机 DSH。请仅在可信局域网内使用，勿在屏幕共享或录屏时暴露；如不再需要请立即停止使用或更换令牌。',
        warnNotBound: [
          'DSH Web 当前仅监听 127.0.0.1，手机无法访问，因此没有可用的局域网二维码。',
          '要启用手机访问，请安装 dsh-lan-access 插件（将 webserver 绑定到 0.0.0.0），或在 cordis.patch.yml 中覆盖 webserver 行的 host 为 0.0.0.0。',
        ],
        warnNoIp: [
          '未检测到局域网 IP，请检查网络（是否连接了 Wi-Fi/网线）。',
          '也可以在本机设置 DSH_QR_IP=192.168.x.x 后重启 dsh 手动指定。',
        ],
        warnNoAuth: '认证服务不可用，无法生成带 token 的访问链接（请确认运行的是 dsh web 且 connection 服务正常）。',
        overrideTrusted: '已按环境变量 DSH_QR_IP 手动指定二维码 IP。',
        overrideUntrusted: 'DSH_QR_IP 指定的地址不在当前网卡地址列表中，扫码后 /api 可能被信任栅栏拒绝（建议改为实际网卡地址）。',
        noState: '无法读取二维码状态（页面可能由旧版本服务生成），请刷新页面重试。',
      },
      en: {
        sectionLabel: 'QR Access',
        title: 'Scan with your phone to open DSH',
        subtitle: 'LAN access QR code (includes the access token)',
        urlLabel: 'Plain URL (copy to trusted devices)',
        copy: 'Copy URL',
        copied: 'Copied ✓',
        refresh: 'Refresh',
        sizeSmaller: 'Smaller',
        sizeLarger: 'Larger',
        ipLabel: 'LAN IP',
        portLabel: 'Port',
        statusOk: '✓ Ready',
        security: 'Security: the QR code embeds the access token — anyone scanning it gets access to this DSH instance. Use only on trusted LANs; do not expose it on screen shares or recordings.',
        warnNotBound: [
          'DSH Web only listens on 127.0.0.1, so phones cannot reach it and no LAN QR code is available.',
          'To enable phone access install the dsh-lan-access plugin (binds the webserver to 0.0.0.0), or override the webserver row host to 0.0.0.0 in cordis.patch.yml.',
        ],
        warnNoIp: [
          'No LAN IP detected — check your network (Wi-Fi / Ethernet connected?).',
          'You can also set DSH_QR_IP=192.168.x.x on this machine and restart dsh.',
        ],
        warnNoAuth: 'The auth service is unavailable, so a tokenized URL cannot be built (make sure `dsh web` is running with a working connection service).',
        overrideTrusted: 'QR IP forced via the DSH_QR_IP environment variable.',
        overrideUntrusted: 'The DSH_QR_IP address is not among the current interface addresses; /api may be refused by the trust fence after scanning (use a real interface address).',
        noState: 'Cannot read QR state (the page may be served by an older build); refresh the page and try again.',
      },
    }

    function currentLang() {
      var lang = (typeof navigator !== 'undefined' ? navigator.language : '') || ''
      return lang.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
    }

    function makeT() {
      var lang = currentLang()
      return function t(key) {
        var table = COPY[lang] || COPY.en
        return table[key] !== undefined ? table[key] : COPY.en[key]
      }
    }

    // ── 样式（幂等注入一次） ────────────────────────────────────────────────

    var CSS_ID = 'dsh-qr-launcher/client.css'
    var CSS = [
      '/* dsh-qr-launcher: 设置页二维码访问面板 */',
      '.dql{display:flex;flex-direction:column;gap:14px;max-width:680px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.dql-head{display:flex;flex-direction:column;gap:4px}',
      '.dql-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.dql-sub{font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dql-body{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}',
      '.dql-qr{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}',
      '.dql-canvas{border-radius:4px;display:block}',
      '.dql-size{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dql-side{display:flex;flex-direction:column;gap:10px;min-width:260px;flex:1}',
      '.dql-field{display:flex;flex-direction:column;gap:4px}',
      '.dql-label{font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dql-url{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;word-break:break-all;padding:8px 10px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;white-space:pre-wrap}',
      '.dql-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.dql-btn{font-size:12px;padding:6px 12px;border-radius:8px;border:none;cursor:pointer;background:var(--dsw-alias-interactive-bg,#3a8ee6);color:var(--dsw-alias-interactive-fg,#ffffff)}',
      '.dql-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#2f7fd4)}',
      '.dql-btn.ghost{background:transparent;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1)}',
      '.dql-btn.ghost:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dql-btn:disabled{opacity:.5;cursor:default}',
      '.dql-note{font-size:12px;line-height:1.7;color:var(--dsw-alias-label-tertiary)}',
      '.dql-warn{display:flex;flex-direction:column;gap:6px;font-size:12px;line-height:1.7;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;color:var(--dsw-alias-state-warn-primary,#d97706);background:var(--dsw-alias-bg-layer-2)}',
      '.dql-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-state-ok-primary,#16a34a)}',
      '.dql-meta{font-size:12px;color:var(--dsw-alias-label-secondary)}',
    ].join('\n')
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + CSS_ID + '"]') === null) {
      var tag = document.createElement('style')
      tag.type = 'text/css'
      tag.dataset.pluginCss = CSS_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    // ── 二维码绘制（canvas，白底黑块 + 4 模块静区） ─────────────────────────

    function drawQr(canvas, rows, size) {
      var n = rows.length
      if (n === 0) return
      var margin = 4
      var total = n + margin * 2
      var cellPx = Math.max(2, Math.floor(size / total))
      var side = cellPx * total
      var dpr = typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
        && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
      canvas.width = Math.round(side * dpr)
      canvas.height = Math.round(side * dpr)
      canvas.style.width = side + 'px'
      canvas.style.height = side + 'px'
      var ctx2d = canvas.getContext('2d')
      if (!ctx2d) return
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx2d.fillStyle = '#ffffff'
      ctx2d.fillRect(0, 0, side, side)
      ctx2d.fillStyle = '#000000'
      for (var r = 0; r < n; r++) {
        var line = rows[r]
        for (var c = 0; c < n; c++) {
          if (line.charAt(c) === '1') {
            ctx2d.fillRect((margin + c) * cellPx, (margin + r) * cellPx, cellPx, cellPx)
          }
        }
      }
    }

    // ── 剪贴板 ─────────────────────────────────────────────────────────────

    function legacyCopy(text) {
      var ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch (error) { /* 忽略 */ }
      document.body.removeChild(ta)
    }

    function copyText(text) {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(function () { legacyCopy(text) })
      }
      try { legacyCopy(text) } catch (error) { /* 忽略 */ }
      return Promise.resolve()
    }

    // ── 面板组件 ───────────────────────────────────────────────────────────

    function QrPanel() {
      var t = useMemo(makeT, [])
      var state = useMemo(readState, [])
      var [size, setSize] = useState(220)
      var [copied, setCopied] = useState(false)
      var canvasRef = React.useRef(null)

      useEffect(function () {
        if (canvasRef.current && state && state.status === 'ok' && state.rows && state.rows.length > 0) {
          drawQr(canvasRef.current, state.rows, size)
        }
      }, [state, size])

      var onCopy = useCallback(function () {
        if (!state || !state.url) return
        copyText(state.url).then(function () {
          setCopied(true)
          setTimeout(function () { setCopied(false) }, 1500)
        })
      }, [state])

      if (state === null) {
        return el('div', { className: 'dql' },
          el('div', { className: 'dql-warn' }, t('noState')))
      }

      var tFn = t

      if (state.status !== 'ok') {
        var warnLines = state.status === 'not-bound' ? tFn('warnNotBound')
          : state.status === 'no-lan-ip' ? tFn('warnNoIp')
          : tFn('warnNoAuth')
        return el('div', { className: 'dql' },
          el('div', { className: 'dql-head' },
            el('div', { className: 'dql-title' }, tFn('title')),
            el('div', { className: 'dql-sub' }, tFn('subtitle'))),
          el('div', { className: 'dql-warn' }, warnLines.map(function (line, index) {
            return el('div', { key: index }, line)
          })),
          el('div', { className: 'dql-row' },
            el('button', { className: 'dql-btn ghost', onClick: function () { window.location.reload() } }, tFn('refresh'))))
      }

      var overrideNote = state.source === 'override'
        ? (state.overrideTrusted ? tFn('overrideTrusted') : tFn('overrideUntrusted'))
        : null
      var ipText = state.ip || '—'
      var portText = state.port ? String(state.port) : '—'

      return el('div', { className: 'dql' },
        el('div', { className: 'dql-head' },
          el('div', { className: 'dql-title' }, tFn('title')),
          el('div', { className: 'dql-sub' }, tFn('subtitle'))),
        el('div', { className: 'dql-row' }, el('span', { className: 'dql-status' }, tFn('statusOk'))),
        el('div', { className: 'dql-body' },
          el('div', { className: 'dql-qr' },
            el('canvas', { ref: canvasRef, className: 'dql-canvas' }),
            el('div', { className: 'dql-size' },
              el('button', { className: 'dql-btn ghost', onClick: function () { setSize(Math.max(140, size - 20)) } }, tFn('sizeSmaller')),
              el('span', {}, size + 'px'),
              el('button', { className: 'dql-btn ghost', onClick: function () { setSize(Math.min(360, size + 20)) } }, tFn('sizeLarger')))),
          el('div', { className: 'dql-side' },
            el('div', { className: 'dql-field' },
              el('div', { className: 'dql-label' }, tFn('urlLabel')),
              el('div', { className: 'dql-url' }, state.url || '')),
            el('div', { className: 'dql-row' },
              el('button', { className: 'dql-btn', onClick: onCopy, disabled: !state.url }, copied ? tFn('copied') : tFn('copy')),
              el('button', { className: 'dql-btn ghost', onClick: function () { window.location.reload() } }, tFn('refresh'))),
            el('div', { className: 'dql-meta' },
              tFn('ipLabel') + ': ' + ipText + ' · ' + tFn('portLabel') + ': ' + portText +
              (state.updatedAt ? ' · ' + new Date(state.updatedAt).toLocaleString() : '')),
            overrideNote !== null ? el('div', { className: 'dql-warn' }, overrideNote) : null,
            el('div', { className: 'dql-note' }, tFn('security')))))
    }

    // ── 插件主体 ───────────────────────────────────────────────────────────

    var inject = ['slots']

    function apply(ctx) {
      try {
        var slots = ctx.get('slots')
        if (slots === undefined || typeof slots.inject !== 'function' || typeof slots.register !== 'function') return
        // settings.section 由宿主声明后才会真正注册（slots.inject 会等待声明）。
        slots.inject('settings.section', function () {
          return slots.register({
            name: 'settings.section',
            id: 'dsh-qr-launcher',
            order: 80,
            label: function () { return (makeT())('sectionLabel') },
            inject: function () { return {} },
          }, QrPanel)
        })
      } catch (error) {
        console.error('[dsh-qr-launcher] client apply failed', error)
      }
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})