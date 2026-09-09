/**
 * 终端输出（宿主侧）。
 *
 * renderAnsiQr 采用与 qrcode-terminal 默认模式一致的方案：
 * 每个模块用两个空格 + 显式 ANSI 背景色（黑底/白底）绘制，
 * 与终端主题无关，任何终端上都是「黑块白底」的标准二维码。
 */

const BLACK_BG = '\u001b[40m'
const WHITE_BG = '\u001b[47m'
const RESET = '\u001b[0m'
const CYAN = '\u001b[36m'
const YELLOW = '\u001b[33m'
const DIM = '\u001b[2m'
const BOLD = '\u001b[1m'

const M = {
	zh: {
		header: '局域网访问（用手机扫一扫即可打开 DSH Web）',
		urlHint: '明文 URL（可复制/传输）：',
		warnNotBound: [
			'DSH Web 当前仅监听 127.0.0.1，手机无法访问，因此未生成局域网二维码。',
			'如需手机访问：安装 dsh-lan-access 插件（把 webserver 绑定到 0.0.0.0），或在自己的 cordis.patch.yml 中覆盖 webserver 行的 host 为 0.0.0.0。',
		],
		warnNoIp: [
			'未检测到局域网 IP，请检查网络（是否连接了 Wi-Fi/网线）。',
			'也可以设置 DSH_QR_IP=192.168.x.x 手动指定 IP。',
		],
		warnNoAuth: 'connection 认证服务不可用，无法生成带 token 的访问链接。',
		overrideNote: (ip, trusted) => trusted
			? `已按 DSH_QR_IP=${ip} 手动指定二维码 IP。`
			: `DSH_QR_IP=${ip} 不在当前网卡地址列表内，扫码后 /api 可能被信任栅栏拒绝（请改成实际网卡地址）。`,
		security: '安全提示：二维码包含访问令牌（token），任何人扫码即可访问本机 DSH；请仅在可信局域网内使用，勿在屏幕共享/录屏时暴露。',
		disableHint: '设置 DSH_QR_TERMINAL=0 可关闭终端二维码输出（Web 面板不受影响）。',
	},
	en: {
		header: 'LAN access — scan with your phone to open DSH Web',
		urlHint: 'Plain URL (copy / share):',
		warnNotBound: [
			'DSH Web currently listens on 127.0.0.1 only; phones cannot reach it, so no LAN QR code was printed.',
			'To enable phone access: install the dsh-lan-access plugin (binds the webserver to 0.0.0.0), or override the webserver row host to 0.0.0.0 in your own cordis.patch.yml.',
		],
		warnNoIp: [
			'No LAN IP detected — check your network (Wi-Fi / Ethernet connected?).',
			'You can also set DSH_QR_IP=192.168.x.x to provide one manually.',
		],
		warnNoAuth: 'Connection auth service unavailable; cannot build a tokenized access URL.',
		overrideNote: (ip, trusted) => trusted
			? `QR IP forced to DSH_QR_IP=${ip}.`
			: `DSH_QR_IP=${ip} is not among the current interface addresses; /api may be refused by the trust fence after scanning (use a real interface address).`,
		security: 'Security: the QR code embeds the access token — anyone scanning it gets access to this DSH instance. Use only on trusted LANs; do not expose during screen sharing or recording.',
		disableHint: 'Set DSH_QR_TERMINAL=0 to disable terminal QR output (the Web panel is unaffected).',
	},
}

/** 根据 DSH_QR_LANG 选择文案（默认中文；未知值回退中文）。 */
export function messages(lang) {
	return lang === 'en' ? M.en : M.zh
}

function repeat(str, count) {
	if (count <= 0) return ''
	return str.repeat(count)
}

/**
 * 渲染主题无关的紧凑 ANSI 二维码（半块合并，输出尺寸约为两空格方案的 1/4）。
 *
 * 每个模块 = 1 个字符列宽；每两个 QR 行合并为一行终端输出（U+2580/2584
 * 上下半块，NFC 半块 + 显式前景/背景色），因此：
 *   - 宽 → 一模块一字符（相比两空格减半）；
 *   - 高 → 两模块一终端行（减半）；
 *   - 颜色恒为黑(前景)白(背景)，与终端主题无关，任何主题都可扫。
 *
 * 字符映射（恒 \u001b[40;47m = 前景黑/背景白）：
 *   '11' → '█'（全块：顶黑底黑）   '10' → '▀'（上半块：上黑/露白底）
 *   '01' → '▄'（下半块：露白底/下黑） '00' → ' '（全白）
 * @param rows - '0'/'1' 字符串数组。
 * @param margin - 静区（模块数），默认 4（QR 规范最低要求）。
 * @returns 可直接写终端的字符串（约 ceil((n + 2*margin) / 2) 行）。
 */
export function renderAnsiQr(rows, margin = 4) {
	const n = rows.length
	if (n === 0) return ''
	const width = n + margin * 2
	const whiteRow = '0'.repeat(width)
	const padded = []
	for (let i = 0; i < margin; i++) padded.push(whiteRow)
	for (const row of rows) padded.push(row.padEnd(width, '0'))
	for (let i = 0; i < margin; i++) padded.push(whiteRow)
	const out = []
	const F = '[40;47m' // 前景黑、背景白（显式颜色，主题无关）
	const R = RESET
	for (let r = 0; r < padded.length; r += 2) {
		const top = padded[r]
		const bottom = padded[r + 1] ?? whiteRow
		let line = F
		for (let c = 0; c < width; c++) {
			const t = top.charAt(c) === '1' ? 1 : 0
			const b = bottom.charAt(c) === '1' ? 1 : 0
			const key = t * 2 + b
			line += key === 3 ? '█' : key === 2 ? '▀' : key === 1 ? '▄' : ' '
		}
		out.push(line + R)
	}
	return out.join('\n') + '\n'
}

/**
 * 组装终端信息块（标题 + 二维码/告警 + 明文 URL + 安全提示）。
 * @param state - computeQrState/withQrPayload 的结果。
 * @returns 整个信息块文本。
 */
export function composeTerminalBlock(state) {
	const lang = process.env?.DSH_QR_LANG
	const t = messages(lang)
	const out = []
	out.push('')
	out.push(DIM + '[' + RESET + BOLD + 'dsh-qr-launcher' + RESET + DIM + '] ' + RESET + CYAN + t.header + RESET)
	out.push('')
	if (state.status === 'ok') {
		out.push(renderAnsiQr(state.rows))
		if (state.source === 'override') {
			out.push(YELLOW + t.overrideNote(state.ip, state.overrideTrusted) + RESET)
		}
		out.push('')
		out.push(DIM + t.urlHint + RESET)
		out.push(CYAN + state.url + RESET)
		out.push('')
		out.push(DIM + t.security + RESET)
	} else {
		const warnLines = state.status === 'not-bound' ? t.warnNotBound
			: state.status === 'no-lan-ip' ? t.warnNoIp
			: state.status === 'no-auth' ? t.warnNoAuth
			: []
		for (const line of warnLines) out.push(DIM + line + RESET)
		if (state.overrideError !== '' && state.override !== '' && state.status !== 'not-bound') {
			out.push(YELLOW + state.overrideError + RESET)
		} else if (state.status === 'no-lan-ip' && state.override !== '' && state.overrideError === '') {
			out.push(YELLOW + t.overrideNote(state.override, state.overrideTrusted) + RESET)
		}
		out.push('')
		out.push(DIM + t.disableHint + RESET)
	}
	out.push('')
	return out.join('\n')
}