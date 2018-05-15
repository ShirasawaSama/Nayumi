import { join } from 'path'
import { Linter } from 'eslint'
import { Browser } from 'puppeteer'
import { createPool } from 'generic-pool'

const PATH = 'file:///' + join(__dirname, '../web/linter.html')
const getErrors = (errors: Linter.LintMessage[]) => JSON.stringify(errors.map(err => ({
  from: { line: err.line - 1, ch: err.column - 1 },
  to: { line: err.endLine - 1, ch: err.endColumn - 1 }
})))
export default (browser: Browser) => createPool<(code: string, errors: Linter.LintMessage[]) => Promise<Buffer>>({
  async create () {
    const page = await browser.newPage()
    await page.goto(PATH)
    const html = await page.$('html')
    return (code: string, errors: Linter.LintMessage[]) => page
      .evaluate('window.update(' + JSON.stringify(code) + ',' + getErrors(errors) + ')')
      .then(() => new Promise(resolve => setTimeout(resolve, 500)))
      .then(() => html.screenshot())
  },
  destroy () { return null }
}, { max: 5, min: 1 })
