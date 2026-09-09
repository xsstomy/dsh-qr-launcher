/**
 * 终端渲染与状态组合测试。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import jsQR from 'jsqr'
import { renderAnsiQr, composeTerminalBlock, messages } from '../lib/terminal.js'
import { computeQrState, withQrPayload, STATUS_NO_LAN_IP } from '../lib/state.js'
import { buildQr } from '../lib/qr.js'
import { POOL, assertQrDecodes } from './helpers.mjs'

/** 把紧凑半块渲染输出的 ANSI 文本还原为半模块像素图（模拟终端实际呈现）。 */
function compactRenderToRgba(ansiOut, scale = 6) {
	// 去掉行尾/行间，逐字符解析：'█'=上黑下黑、'▀'=上黑下白、'▄'=上白下黑、' '=上白下白。
	const visible = ansiOut.replace(/\u001b\[40;47m/gu, '').replace(/\u001b\[0m/gu, '').replace(/\u001b\[[0-9;]*m/gu, '').trimEnd()
	const rows = visible.split('\n')
	const width = rows[0].length
	const height = rows.length * 2 // 每行两个半模块
	const sizeW = width * scale
	const sizeH = height * scale
	const data = new Uint8ClampedArray(sizeW * sizeH * 4)
	for (let i = 0; i < sizeW * sizeH; i++) {
		data[i * 4] = 255
		data[i * 4 + 1] = 255
		data[i * 4 + 2] = 255
		data[i * 4 + 3] = 255
	}
	const paint = (row, col, dark) => {
		if (!dark) return
		for (let y = 0; y < scale; y++) {
			for (let x = 0; x < scale; x++) {
				const at = ((row * scale + y) * sizeW + col * scale + x) * 4
				data[at] = 0
				data[at + 1] = 0
				data[at + 2] = 0
				data[at + 3] = 255
			}
		}
	}
	for (let r = 0; r < rows.length; r++) {
		for (let c = 0; c < rows[r].length; c++) {
			const ch = rows[r].charAt(c)
			const topDark = ch === '█' || ch === '▀'
			const bottomDark = ch === '█' || ch === '▄'
			paint(r * 2, c, topDark)
			paint(r * 2 + 1, c, bottomDark)
		}
	}
	return { data, width: sizeW, height: sizeH }
}

test('renderAnsiQr：紧凑半块输出（宽=模块数+静区、高≈一半）', () => {
	const qr = buildQr('http://192.168.3.47:3080/?token=abc')
	const out = renderAnsiQr(qr.rows)
	const lines = out.replace(/\n$/u, '').split('\n')
	const expectedRows = Math.ceil((qr.cellCount + 8) / 2) // margin=4 两侧 → +8；每行两模块
	assert.equal(lines.length, expectedRows)
	assert.ok(out.includes('\u001b[40;47m'), '应包含前景黑/背景白转义')
	assert.ok(out.includes('\u001b[0m'), '应包含重置转义')
	// 宽度即字符数（一模块一字符），不应出现两空格方案的大宽度。
	const widthPattern = lines[expectedRows - 1].replace(/\u001b\[[0-9;]*m/gu, '')
	assert.equal(widthPattern.length, qr.cellCount + 8)
	// 空输入返回空。
	assert.equal(renderAnsiQr([]), '')
})

test('renderAnsiQr：紧凑渲染可被 jsQR 解码（含静区）', () => {
	const url = 'http://192.168.3.47:3080/?token=abcdefghijklmnopqrstuvwxyz'
	const qr = buildQr(url)
	const out = renderAnsiQr(qr.rows, 4)
	const { data, width, height } = compactRenderToRgba(out, 6)
	const found = jsQR(data, width, height)
	assert.ok(found !== null, 'compact ANSI QR should decode via jsQR')
	assert.equal(found.data, url)
})

test('composeTerminalBlock：ok 时包含二维码与明文 URL', () => {
	const base = computeQrState('0.0.0.0', 3080, POOL, '', true)
	const url = 'http://192.168.3.47:3080/?token=abcdefghijklmnopqrstuvwxyz'
	const state = withQrPayload(base, url, buildQr)
	const block = composeTerminalBlock(state)
	assert.ok(block.includes(url))
	assert.ok(block.includes('\u001b[40;47m'))
	assert.ok(block.includes('192.168.3.47'))
})

test('composeTerminalBlock：not-bound 时给出安装提示且无二维码', () => {
	const state = computeQrState('127.0.0.1', 3080, POOL, '', true)
	const block = composeTerminalBlock(state)
	assert.ok(!block.includes('\u001b[40;47m'))
	assert.ok(block.includes('dsh-lan-access'))
})

test('composeTerminalBlock：no-lan-ip 给出检查网络提示', () => {
	const state = computeQrState('0.0.0.0', 3080, [], '', true)
	assert.equal(state.status, STATUS_NO_LAN_IP)
	const block = composeTerminalBlock(state)
	assert.ok(block.includes('局域网 IP'))
})

test('messages：默认中文、显式 en 英文', () => {
	assert.equal(messages(undefined).header.includes('局域网'), true)
	assert.equal(messages('en').header.includes('LAN access'), true)
})

test('导出矩阵可被 jsQR 解码（与 encode 测试互通）', () => {
	assertQrDecodes('http://192.168.3.47:3080/?token=zzzz9876543210')
})