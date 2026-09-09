/**
 * 二维码编码回路测试：把 buildQr 的矩阵按白底黑块栅格化，
 * 用 jsQR 解出内容并与输入 URL 比对。
 */
import { test } from 'node:test'
import { buildQr } from '../lib/qr.js'
import { assertQrDecodes } from './helpers.mjs'

test('QR 解码回路：典型局域网访问 URL', () => {
	assertQrDecodes('http://192.168.3.47:3080/?token=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abc')
})

test('QR 解码回路：较长 IP 与不同端口', () => {
	assertQrDecodes('http://10.0.0.200:8088/?token=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR')
})

test('QR 解码回路：短 URL 依然正确', () => {
	assertQrDecodes('http://192.168.1.1:3080')
})

test('buildQr：空内容与超长内容返回 null', () => {
	if (buildQr('') !== null) throw new Error('empty should be null')
	if (buildQr(null) !== null) throw new Error('null should be null')
	if (buildQr(undefined) !== null) throw new Error('undefined should be null')
	if (buildQr('a'.repeat(513)) !== null) throw new Error('too long should be null')
})