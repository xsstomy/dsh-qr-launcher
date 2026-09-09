/**
 * 二维码状态（宿主侧，纯函数）。
 *
 * computeQrState 只依据 webserver 的绑定 host/port、网卡候选与
 * DSH_QR_* 环境变量推导状态；认证 URL 由外部提供（connection 服务），
 * 因此不依赖任何运行时对象，可被单元测试直接调用。
 */
import { pickLanIp } from './net.js'

/** 状态：一切正常，可扫码。 */
export const STATUS_OK = 'ok'
/** Web GUI 仅监听本机（未绑定 0.0.0.0），手机无法访问。 */
export const STATUS_NOT_BOUND = 'not-bound'
/** 已绑定局域网但未探测到可用 IPv4。 */
export const STATUS_NO_LAN_IP = 'no-lan-ip'
/** connection 服务尚未提供带 token 的 URL。 */
export const STATUS_NO_AUTH = 'no-auth'

/**
 * 推导 QR 状态。
 * @param host - webserver 实际绑定 host（'127.0.0.1' | '0.0.0.0'）。
 * @param port - webserver 实际监听端口。
 * @param candidates - 网卡候选（listLanCandidates() 结果）。
 * @param override - DSH_QR_IP 环境变量原始值（可能含空白）。
 * @param authAvailable - 是否能拿到带 token 的认证 URL。
 * @returns 状态对象；ip/url/rows 仅在 status==='ok' 时非空。
 */
export function computeQrState(host, port, candidates, override, authAvailable) {
	const bound = host === '0.0.0.0'
	const picked = bound
		? pickLanIp(candidates, override)
		: { ip: '', source: '', overrideTrusted: true, overrideError: '' }

	const base = {
		v: 1,
		updatedAt: Date.now(),
		host,
		port,
		bound,
		ip: picked.ip,
		source: picked.source,
		override: typeof override === 'string' ? override.trim() : '',
		overrideTrusted: picked.overrideTrusted,
		overrideError: picked.overrideError,
		url: '',
		cellCount: 0,
		rows: [],
	}

	let status
	if (!bound) {
		status = STATUS_NOT_BOUND
	} else if (!authAvailable) {
		status = STATUS_NO_AUTH
	} else if (picked.ip === '') {
		status = STATUS_NO_LAN_IP
	} else {
		status = STATUS_OK
	}
	base.status = status
	return base
}

/**
 * 状态为 OK 后，注入二维码矩阵（由宿主在拿到认证 URL 后调用）。
 * 返回新对象，避免在多次 index 注入之间共享同一个 rows 引用。
 * @param state - computeQrState 的结果。
 * @param url - 完整认证 URL（http://ip:port/?token=...）。
 * @param buildQrFn - buildQr 函数。
 * @returns 携带 rows 的新状态对象；内容过长会把 status 置为 no-auth。
 */
export function withQrPayload(state, url, buildQrFn) {
	const next = { ...state, url, status: STATUS_OK, cellCount: 0, rows: [] }
	const qr = buildQrFn(url)
	if (qr === null) {
		next.status = STATUS_NO_AUTH
		next.launchError = '二维码内容过长，已跳过生成'
		return next
	}
	next.cellCount = qr.cellCount
	next.rows = qr.rows
	return next
}