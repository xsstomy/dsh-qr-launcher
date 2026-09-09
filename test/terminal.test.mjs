/**
 * 终端渲染与状态组合测试。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderAnsiQr, composeTerminalBlock, messages } from '../lib/terminal.js'
import { computeQrState, withQrPayload, STATUS_NO_LAN_IP } from '../lib/state.js'
import { buildQr } from '../lib/qr.js'
import { POOL, assertQrDecodes } from './helpers.mjs'

test('renderAnsiQr：结构与颜色标记正确', () => {
	const qr = buildQr('http://192.168.3.47:3080/?token=abc')
	const out = renderAnsiQr(qr.rows)
	const lines = out.replace(/\n$/u, '').split('\n')
	// 顶部 4 行白色静区 + 矩阵行 + 底部 4 行。
	assert.equal(lines.length, qr.cellCount + 8)
	assert.ok(out.includes('\u001b[40m'), '应包含黑色背景转义')
	assert.ok(out.includes('\u001b[47m'), '应包含白色背景转义')
	// 空输入返回空。
	assert.equal(renderAnsiQr([]), '')
})

test('composeTerminalBlock：ok 时包含二维码与明文 URL', () => {
	const base = computeQrState('0.0.0.0', 3080, POOL, '', true)
	const url = 'http://192.168.3.47:3080/?token=abcdefghijklmnopqrstuvwxyz'
	const state = withQrPayload(base, url, buildQr)
	const block = composeTerminalBlock(state)
	assert.ok(block.includes(url))
	assert.ok(block.includes('\u001b[40m'))
	assert.ok(block.includes('192.168.3.47'))
})

test('composeTerminalBlock：not-bound 时给出安装提示且无二维码', () => {
	const state = computeQrState('127.0.0.1', 3080, POOL, '', true)
	const block = composeTerminalBlock(state)
	assert.ok(!block.includes('\u001b[40m'))
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