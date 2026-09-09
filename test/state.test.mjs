/**
 * 局域网 IP 选择与状态推导测试。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickLanIp, isIpv4Literal, isLikelyLanAddress, isVirtualIfaceName } from '../lib/net.js'
import { computeQrState, withQrPayload, STATUS_OK, STATUS_NOT_BOUND, STATUS_NO_LAN_IP, STATUS_NO_AUTH } from '../lib/state.js'
import { buildQr } from '../lib/qr.js'
import { POOL } from './helpers.mjs'

test('isIpv4Literal / isLikelyLanAddress / isVirtualIfaceName 基础判定', () => {
	assert.equal(isIpv4Literal('192.168.1.1'), true)
	assert.equal(isIpv4Literal('999.1.1.1'), false)
	assert.equal(isIpv4Literal('192.168.1'), false)
	assert.equal(isIpv4Literal(''), false)
	assert.equal(isIpv4Literal('192.168.1.1.2'), false)
	assert.ok(isLikelyLanAddress('192.168.3.47'))
	assert.ok(isLikelyLanAddress('10.0.0.1'))
	assert.ok(isLikelyLanAddress('172.20.0.1'))
	assert.ok(!isLikelyLanAddress('169.254.1.1'))
	assert.ok(!isLikelyLanAddress('100.64.0.1'))
	assert.ok(isVirtualIfaceName('vmnet8'))
	assert.ok(isVirtualIfaceName('utun3'))
	assert.ok(isVirtualIfaceName('docker0'))
	assert.ok(!isVirtualIfaceName('en0'))
	assert.ok(!isVirtualIfaceName('eth0'))
})

test('自动选择：优先真实网卡（en0）而非虚拟/隧道', () => {
	const picked = pickLanIp(POOL, '')
	assert.equal(picked.ip, '192.168.3.47')
	assert.equal(picked.source, 'detect')
	assert.equal(picked.overrideTrusted, true)
	assert.equal(picked.overrideError, '')
})

test('自动选择：只有虚拟网卡时降级使用（兜底）', () => {
	const picked = pickLanIp([{ name: 'utun3', address: '10.77.1.4' }], '')
	assert.equal(picked.ip, '10.77.1.4')
})

test('自动选择：无候选时返回空', () => {
	const picked = pickLanIp([], '')
	assert.equal(picked.ip, '')
})

test('覆盖：合法且在候选池中视为可信', () => {
	const picked = pickLanIp(POOL, '172.16.254.1')
	assert.equal(picked.ip, '172.16.254.1')
	assert.equal(picked.source, 'override')
	assert.equal(picked.overrideTrusted, true)
	assert.equal(picked.overrideError, '')
})

test('覆盖：合法但不在候选池中给出告警', () => {
	const picked = pickLanIp(POOL, '192.168.9.9')
	assert.equal(picked.ip, '192.168.9.9')
	assert.equal(picked.overrideTrusted, false)
	assert.ok(picked.overrideError.length > 0)
})

test('覆盖：非法地址直接拒绝', () => {
	const picked = pickLanIp(POOL, 'not-an-ip')
	assert.equal(picked.ip, '')
	assert.ok(picked.overrideError.length > 0)
})

test('computeQrState：未绑定 0.0.0.0 时为 not-bound', () => {
	const state = computeQrState('127.0.0.1', 3080, POOL, '', true)
	assert.equal(state.status, STATUS_NOT_BOUND)
	assert.equal(state.url, '')
})

test('computeQrState：已绑定但无候选时为 no-lan-ip', () => {
	const state = computeQrState('0.0.0.0', 3080, [], '', true)
	assert.equal(state.status, STATUS_NO_LAN_IP)
})

test('computeQrState：认证不可用且其余正常时为 no-auth', () => {
	const state = computeQrState('0.0.0.0', 3080, POOL, '', false)
	assert.equal(state.status, STATUS_NO_AUTH)
})

test('computeQrState：一切正常时为 ok', () => {
	const state = computeQrState('0.0.0.0', 3080, POOL, '', true)
	assert.equal(state.status, STATUS_OK)
	assert.equal(state.ip, '192.168.3.47')
	assert.equal(state.host, '0.0.0.0')
	assert.equal(state.port, 3080)
	assert.equal(state.source, 'detect')
})

test('withQrPayload：注入矩阵与 URL', () => {
	const base = computeQrState('0.0.0.0', 3080, POOL, '', true)
	const url = 'http://192.168.3.47:3080/?token=abcdefghijklmnopqrstuvwxyz'
	const state = withQrPayload(base, url, buildQr)
	assert.equal(state.status, STATUS_OK)
	assert.equal(state.url, url)
	assert.ok(state.cellCount > 0)
	assert.equal(state.rows.length, state.cellCount)
	assert.notEqual(state, base) // 返回新对象
})

test('withQrPayload：内容过长回落为 no-auth', () => {
	const base = computeQrState('0.0.0.0', 3080, POOL, '', true)
	const state = withQrPayload(base, 'a'.repeat(600), buildQr)
	assert.equal(state.status, STATUS_NO_AUTH)
	assert.equal(state.rows.length, 0)
})