/**
 * 局域网 IPv4 探测与选择（宿主侧，纯函数，便于测试）。
 *
 * 候选池与 DSH 自身的 /api 信任栅栏保持一致：当 webserver 绑定
 * 0.0.0.0 时，DSH 的 Web 运行时会把「全部非内部 IPv4 地址」写入
 * trustedHosts。因此本插件也从同一集合挑选展示 IP（FR-10 排除
 * 127.0.0.1 与虚拟网卡：虚拟网卡仅作为最后的兜底候选）。
 */
import { networkInterfaces } from 'node:os'

/** 排除的默认链路本地/隧道保留段。 */
const NOT_PRIVATE = [
	/^127\./u, // loopback（内部接口已排除，这里再兜一道）
	/^169\.254\./u, // link-local
	/^100\.64\./u, // CGNAT 共享地址段
	/^0\./u,
	/^255\./u,
]

/** 典型家庭/办公局域网网段即会被视为“更像是局域网 IP”。 */
const LIKELY_LAN = [
	/^192\.168\./u,
	/^10\./u,
	/^172\.(1[6-9]|2[0-9]|3[01])\./u,
]

/** 常见虚拟网卡/隧道接口名前缀（大小写不敏感）。 */
const VIRTUAL_IFACE = [
	/^vmnet/i, /^vnic/i, /^docker/i, /^veth/i, /^vEthernet/i,
	/^tun/i, /^tap/i, /^tailscale/i, /^wg/i, /^utun/i, /^zt/i, /^ppp/i,
	/^bridge/i, /^vmbr/i, /^virbr/i,
]

/** 非内部 IPv4 地址是否落在“更像是局域网”的私有网段。 */
export function isLikelyLanAddress(address) {
	for (const pattern of LIKELY_LAN) {
		if (pattern.test(address)) return true
	}
	return false
}

/** IPv4 字面量校验（用于 DSH_QR_IP 覆盖）。 */
export function isIpv4Literal(value) {
	if (typeof value !== 'string') return false
	const parts = value.split('.')
	if (parts.length !== 4) return false
	for (const part of parts) {
		if (!/^\d{1,3}$/u.test(part)) return false
		const n = Number(part)
		if (n < 0 || n > 255) return false
	}
	return true
}

/** 接口名是否像虚拟网卡/隧道。 */
export function isVirtualIfaceName(name) {
	for (const pattern of VIRTUAL_IFACE) {
		if (pattern.test(name)) return true
	}
	return false
}

/** 收集所有「非内部 IPv4」候选（与 DSH Web 运行时的 lanAddresses 同源）。 */
export function listLanCandidates() {
	const candidates = []
	const faces = networkInterfaces()
	for (const [name, infos] of Object.entries(faces)) {
		if (!Array.isArray(infos)) continue
		for (const info of infos) {
			if (info === undefined || info.family !== 'IPv4' || info.internal) continue
			candidates.push({ name, address: info.address })
		}
	}
	return candidates
}

/** 一个候选的排序分数：越小越优先。虚拟网卡 >2；非“像局域网”>1；其余 0。 */
function scoreOf(candidate) {
	let score = 0
	if (candidate.virtual) score += 4
	if (!candidate.likely) score += 1
	return score
}

/**
 * 从候选池中挑选展示用局域网 IP。
 * @param candidates - [{ name, address }]，来自 listLanCandidates()。
 * @param override - DSH_QR_IP 环境变量值（可为空）。
 * @returns
 *   - ip / source: 选中的地址与来源（'override' | 'detect' | ''）
 *   - overrideTrusted: 覆盖值是否出现在候选池中（决定是否仍可访问 /api）
 *   - overrideError: 覆盖值非法时的错误文案
 */
export function pickLanIp(candidates, override) {
	const trimmed = typeof override === 'string' ? override.trim() : ''
	if (trimmed !== '') {
		if (!isIpv4Literal(trimmed)) {
			return { ip: '', source: '', overrideTrusted: false, overrideError: `DSH_QR_IP 不是合法的 IPv4 地址: ${trimmed}` }
		}
		const inPool = candidates.some((candidate) => candidate.address === trimmed)
		return {
			ip: trimmed,
			source: 'override',
			overrideTrusted: inPool,
			overrideError: inPool ? '' : `DSH_QR_IP=${trimmed} 不在当前网卡地址列表中，扫码后 /api 可能被信任栅栏拒绝（建议改为实际网卡地址）`,
		}
	}
	if (candidates.length === 0) {
		return { ip: '', source: '', overrideTrusted: false, overrideError: '' }
	}
	// 先按「虚拟/非典型」降序打分，再保持 OS 枚举顺序稳定（同分取先出现的）。
	const ranked = candidates
		.map((candidate) => ({
			...candidate,
			virtual: isVirtualIfaceName(candidate.name),
			likely: isLikelyLanAddress(candidate.address),
		}))
		.sort((a, b) => scoreOf(a) - scoreOf(b))
	return { ip: ranked[0].address, source: 'detect', overrideTrusted: true, overrideError: '' }
}