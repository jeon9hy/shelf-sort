import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()

// Mimic the real photo layout: a big book title up top, plus the small two-line
// call-number label and a "0" barcode digit near the bottom of each spine.
const dataUrl = await page.evaluate(() => {
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 700
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'top'

  const columns = [
    { x: 60, title: '혼자 공부하는 머신러닝', top: '004.73', bottom: '박25ㄴ' },
    { x: 380, title: 'AI 지식', top: '004.73', bottom: '반44ㅍ' },
    { x: 660, title: '챗GPT 노마드의 탄생', top: '005.1', bottom: '박9' },
  ]
  for (const c of columns) {
    ctx.font = "bold 28px 'Malgun Gothic', sans-serif"
    ctx.fillText(c.title, c.x, 40)
    ctx.font = "bold 40px 'Malgun Gothic', sans-serif"
    ctx.fillText(c.top, c.x, 500)
    ctx.fillText(c.bottom, c.x, 560)
    ctx.font = "bold 32px 'Malgun Gothic', sans-serif"
    ctx.fillText('0', c.x + 40, 630)
  }
  return canvas.toDataURL('image/png')
})

const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')

const res = await fetch('https://gslib.vercel.app/api/recognize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: base64, format: 'png' }),
})
console.log('status:', res.status)
const body = await res.json()
console.log(JSON.stringify(body, null, 2))

await browser.close()
