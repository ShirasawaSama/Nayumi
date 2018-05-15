import { join } from 'path'
import { Browser } from 'puppeteer'
import { createPool } from 'generic-pool'

const PATH = 'file:///' + join(__dirname, '../web/codeImage.html')
export default (browser: Browser) => createPool<(code: string) => Promise<Buffer>>({
  async create () {
    const page = await browser.newPage()
    await page.goto(PATH)
    const html = await page.$('html')
    return (code: string) => page
      .evaluate('window.update(' + JSON.stringify(code) + ')')
      .then(() => html.screenshot())
  },
  destroy () { return null }
}, { max: 5, min: 1 })
