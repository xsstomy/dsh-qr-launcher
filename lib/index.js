/**
 * dsh-qr-launcher — DSH 局域网访问二维码插件（宿主侧）。
 *
 * 职责：
 *   1. Web 服务就绪后，等待 Loader 树完全落定（与 web-app 的 URL 宣告同一
 *      时机），在终端打印「局域网访问二维码」（ANSI，主题无关）+ 明文 URL；
 *   2. 通过 webserver 的 tapIndex 钩子，在每个 index 响应里注入当前二维码
 *      状态（JSON），设置页「二维码访问」面板据此渲染；
 *   3. 局域网 IP 自动探测（排除虚拟网卡优先），支持 DSH_QR_IP 手动指定，
 *      支持 DSH_QR_TERMINAL=0 / DSH_QR_NO_TERMINAL=1 关闭终端输出。
 *
 * 零侵入：不动 DSH 官方任何文件；只作为独立 bundle patch + Loader 行存在。
 * 安全：注入的状态只出现在已认证的 index 响应中（浏览器身份校验先于页面
 * 下发），与 dsh web 在终端打印的 URL 属于同一暴露面。
 */
import { listLanCandidates } from './net.js'
import { buildQr } from './qr.js'
import { computeQrState, withQrPayload } from './state.js'
import { composeTerminalBlock } from './terminal.js'

/** Stable Cordis plugin name。 */
export const name = 'dsh-qr-launcher'

/** 需要先就绪的服务：webserver（绑定 host/port + index tap）、connection（token URL）。 */
export const inject = ['webServer', 'connection']

/** index 中注入的状态标签 id（也是幂等守卫）。 */
const STATE_TAG_ID = 'dsh-qr-launcher-state'

/** 每个 root 只宣告一次终端二维码（避免 HMR/重复加载叠加）。 */
const ANNOUNCED_ROOTS = new WeakSet()

/** 是否关闭终端二维码输出（DSH_QR_TERMINAL=0 或 DSH_QR_NO_TERMINAL=1）。 */
function terminalEnabled() {
	const value = process.env.DSH_QR_TERMINAL
	if (value === '0' || value === 'false' || value === 'no' || value === '') return false
	const noTerminal = process.env.DSH_QR_NO_TERMINAL
	if (noTerminal !== undefined && noTerminal !== '' && noTerminal !== '0') return false
	return true
}

function logError(message, error) {
	const detail = error instanceof Error ? error.message : String(error)
	console.error(`[dsh-qr-launcher] ${message}: ${detail}`)
}

/**
 * 生成当前二维码状态快照（每次请求实时采样，IP 变化页面刷新后即更新）。
 * @param ctx - 插件上下文（webServer/connection 已注入）。
 * @returns 完整状态（含 rows 矩阵，仅 status==='ok' 时）。
 */
function snapshot(ctx) {
	const webServer = ctx.webServer
	const candidates = listLanCandidates()
	const state = computeQrState(
		webServer.host,
		webServer.port,
		candidates,
		process.env.DSH_QR_IP ?? '',
		true,
	)
	if (state.status !== 'ok') return state
	const connection = ctx.connection
	if (typeof connection?.authenticatedUrl !== 'function') {
		state.status = 'no-auth'
		return state
	}
	const url = connection.authenticatedUrl(`http://${state.ip}:${Number(state.port) || 0}`)
	return withQrPayload(state, url, buildQr)
}

/** index tap：向 <head> 注入 JSON 状态脚本（含幂等守卫）。 */
function injectState(html, state) {
	if (typeof html !== 'string' || html.includes(`id="${STATE_TAG_ID}"`)) return html
	let json
	try {
		json = JSON.stringify(state).replace(/</gu, '\\u003c')
	} catch (error) {
		logError('状态序列化失败', error)
		return html
	}
	const tag = `<script id="${STATE_TAG_ID}" type="application/json" data-generated-by="dsh-qr-launcher">${json}</script>`
	if (html.includes('</head>')) return html.replace('</head>', `${tag}</head>`)
	return html + tag
}

/**
 * 挂载插件。
 * @param ctx - 插件上下文。
 */
export function apply(ctx) {
	try {
		const webServer = ctx.get('webServer')
		if (webServer === undefined || typeof webServer.tapIndex !== 'function') return

		// 1) 每个 index 响应注入状态（请求时实时采样）。
		const untap = webServer.tapIndex((html) => injectState(html, snapshot(ctx)))
		ctx.effect(() => () => {
			try { untap() } catch { /* 已卸载 */ }
		}, `dsh-qr-launcher: index tap`)

		// 2) Loader 树完全落定后，终端打印一次二维码。
		if (!terminalEnabled()) return
		const root = ctx.root ?? ctx
		if (ANNOUNCED_ROOTS.has(root)) return
		const announce = () => {
			try {
				if (ANNOUNCED_ROOTS.has(root)) return
				ANNOUNCED_ROOTS.add(root)
				console.log(composeTerminalBlock(snapshot(ctx)))
			} catch (error) {
				logError('终端二维码输出失败', error)
			}
		}
		const loader = ctx.get('loader')
		if (loader !== undefined && typeof loader.await === 'function') {
			loader.await().then(announce).catch(() => { /* 树启动失败则不打印 */ })
		} else {
			announce()
		}
	} catch (error) {
		logError('插件启动失败', error)
	}
}