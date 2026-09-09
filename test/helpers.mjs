/**
 * 测试公共资源：候选网卡池、矩阵栅格化与二维码解码断言（无 test 注册）。
 */
import assert from 'node:assert/strict'
import jsQR from 'jsqr'
import { buildQr } from '../lib/qr.js'

/** 模拟网卡候选（含虚拟/隧道接口）。 */
export const POOL = [
	{ name: 'en0', address: '192.168.3.47' },
	{ name: 'en1', address: '172.16.254.1' },
	{ name: 'utun3', address: '10.77.1.4' },
	{ name: 'bridge100', address: '192.168.77.1' },
]

/** 把 '0'/'1' 矩阵栅格化为 RGBA 位图（scale px/模块 + margin 静区）。 */
export function matrixToRgba(rows, scale = 4, margin = 4) {
	const n = rows.length
	const total = n + margin * 2
	const size = total * scale
	const data = new Uint8ClampedArray(size * size * 4)
	for (let i = 0; i < size * size; i++) {
		data[i * 4] = 255
		data[i * 4 + 1] = 255
		data[i * 4 + 2] = 255
		data[i * 4 + 3] = 255
	}
	for (let r = 0; r < n; r++) {
		const line = rows[r]
		for (let c = 0; c < n; c++) {
			if (line.charAt(c) !== '1') continue
			for (let y = 0; y < scale; y++) {
				for (let x = 0; x < scale; x++) {
					const at = (((margin + r) * scale + y) * size + (margin + c) * scale + x) * 4
					data[at] = 0
					data[at + 1] = 0
					data[at + 2] = 0
					data[at + 3] = 255
				}
			}
		}
	}
	return { data, size }
}

/** 生成二维码 → 栅格化 → jsQR 解码断言内容一致。 */
export function assertQrDecodes(input) {
	const qr = buildQr(input)
	assert.ok(qr !== null, `buildQr should succeed for ${input}`)
	assert.ok(Number.isInteger(qr.cellCount) && qr.cellCount > 0)
	assert.equal(qr.rows.length, qr.cellCount)
	for (const row of qr.rows) {
		assert.equal(row.length, qr.cellCount)
		assert.ok(/^[01]+$/u.test(row))
	}
	const { data, size } = matrixToRgba(qr.rows, 5, 4)
	const found = jsQR(data, size, size)
	assert.ok(found !== null, `jsQR should decode a rendered QR for ${input}`)
	assert.equal(found.data, input)
}