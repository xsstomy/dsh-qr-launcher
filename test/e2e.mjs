/**
 * 端到端验证（DOM 探针版）：进入设置页「二维码访问」面板并断言 canvas 渲染。
 * 用法：node test/e2e.mjs <auth-url> [png]
 */
import { chromium } from 'playwright-core'

const url = process.argv[2]
if (!url) { console.error('usage: node test/e2e.mjs <auth-url> [png]'); process.exit(2) }
const png = process.argv[3] ?? '/tmp/qr-panel.png'

const browser = await chromium.launch({
	executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	headless: true,
	args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (msg) => {
	if (msg.type() === 'error') console.log('[console.error]', msg.text().slice(0, 400))
})
page.on('pageerror', (error) => console.log('[pageerror]', String(error).slice(0, 400)))

async function probeUi() {
	return page.evaluate(() => {
		const out = { buttons: [], nav: [], slots: [] }
		for (const el of document.querySelectorAll('button')) {
			const label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim()
			if (label) out.buttons.push({ label: label.slice(0, 40), slot: el.closest('[data-slot]')?.getAttribute('data-slot') ?? null })
		}
		for (const el of document.querySelectorAll('[data-slot]')) {
			const t = (el.textContent || '').trim().slice(0, 60)
			out.slots.push({ slot: el.getAttribute('data-slot'), text: t })
		}
		out.nav = [...document.querySelectorAll('nav *')].slice(0, 40).map((el) => (el.textContent || '').trim().slice(0, 30))
		return out
	})
}

async function clickByText(text) {
	return page.evaluate((t) => {
		const cands = [...document.querySelectorAll('[role="menuitem"], [role="tab"], [role="button"], a, button, [data-slot] > *')]
		for (const node of cands) {
			const full = (node.textContent || '').trim()
			const own = [...node.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()
			if (!full || (full !== t && own !== t)) continue
			if (node.offsetParent === null && node.getClientRects().length === 0) continue
			node.click()
			return { matched: full.slice(0, 60), tag: node.tagName, slot: node.closest('[data-slot]')?.getAttribute('data-slot') ?? null }
		}
		return null
	}, text)
}

console.log('goto', url)
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(9000)

let ui = await probeUi()
console.log('--- initial buttons (filtered) ---')
console.log(JSON.stringify(ui.buttons.filter((b) => /设置|Settings/.test(b.label)), null, 0))
console.log('--- initial slots ---')
console.log(JSON.stringify(ui.slots.slice(0, 24), null, 0))

// 点开设置：直接点真正的触发器元素
const didOpen = await page.click('[data-slot="settings.trigger"]', { timeout: 8000 }).then(() => true).catch((e) => { console.log('click failed:', String(e).slice(0, 200)); return false })
console.log('clicked settings.trigger:', didOpen)
await page.waitForTimeout(3500)
ui = await probeUi()
console.log('--- after open settings: slots (filtered) ---')
console.log(JSON.stringify(ui.slots.filter((s) => /settings/.test(s.slot)), null, 0))
console.log('--- after open settings: buttons (filtered) ---')
console.log(JSON.stringify(ui.buttons.filter((b) => /二维码|QR|设置|模型|通用|费用/.test(b.label)), null, 0))

const qr = await clickByText('二维码访问')
console.log('click 二维码访问 ->', JSON.stringify(qr))
await page.waitForTimeout(3000)

const probe = await page.evaluate(() => {
	const canvas = document.querySelector('.dql canvas') || document.querySelector('canvas.dql-canvas')
	const urlEl = document.querySelector('.dql-url')
	return {
		canvas: canvas ? { w: canvas.width, h: canvas.height, css: canvas.style.width } : null,
		urlText: urlEl ? urlEl.textContent.slice(0, 140) : null,
		hasCopiedBtn: [...document.querySelectorAll('button')].some((b) => /复制链接|Copy URL/.test(b.textContent || '')),
		bodyHasLanIp: (document.body.innerText || '').includes('192.168.3.47'),
		sectionText: (document.body.innerText || '').match(/手机扫一扫[^\n]*/)?.[0] ?? null,
	}
})
console.log('FINAL probe:', JSON.stringify(probe, null, 2))

await page.screenshot({ path: png, fullPage: true })
console.log('screenshot:', png)
await browser.close()
process.exit(probe.canvas && probe.urlText && probe.bodyHasLanIp ? 0 : 1)