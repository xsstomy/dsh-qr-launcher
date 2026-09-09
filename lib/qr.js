/**
 * QR 矩阵生成（宿主侧）。
 *
 * 封装 vendor/qrcode 下由 qrcode-terminal 项目打包的
 * Kazuhiko Arase QR Code 生成器（MIT），固定使用与 qrcode-terminal
 * 相同的自动版本 + 纠错级别 L + 8-bit 字节模式，保证：
 *   - 终端 ASCII 二维码与参考实现行为一致（可被手机正常扫描）；
 *   - Web 面板注入的矩阵与终端用的是同一套编码结果。
 *
 * 零运行时依赖：全部代码已内置于本包。
 */
import QRCode from '../vendor/qrcode/index.js'

/** qrcode-terminal 使用的默认纠错级别（L）。 */
export const QR_ERROR_CORRECTION_LEVEL = 1 // QRErrorCorrectLevel.L

/** 生成 QR 时允许的最大内容长度（字节），防止把终端/页面撑爆。 */
export const QR_MAX_TEXT_LENGTH = 512

/**
 * 构建一个 QR 矩阵。
 * @param text - 要编码的文本（本插件为完整局域网访问 URL）。
 * @returns 模块数 cellCount 与逐行 '0'/'1' 字符串 rows；内容过长时返回 null。
 */
export function buildQr(text) {
	if (typeof text !== 'string' || text.length === 0) return null
	if (text.length > QR_MAX_TEXT_LENGTH) return null
	const qr = new QRCode(-1, QR_ERROR_CORRECTION_LEVEL)
	qr.addData(text)
	qr.make()
	const cellCount = qr.getModuleCount()
	const rows = new Array(cellCount)
	for (let r = 0; r < cellCount; r++) {
		let line = ''
		for (let c = 0; c < cellCount; c++) {
			line += qr.isDark(r, c) ? '1' : '0'
		}
		rows[r] = line
	}
	return { cellCount, rows }
}