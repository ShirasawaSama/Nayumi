import * as Telegraf from 'telegraf'
import * as session from 'telegraf/session'
import * as HttpsProxy from 'https-proxy-agent'
import * as puppeteer from 'puppeteer'
import * as GenericPool from 'generic-pool'
import { Safeify } from 'safeify'
import { Linter, CLIEngine } from 'eslint'
import { inspect } from 'util'
import { join } from 'path'

const LEVEL = ['💬  ', '❕  ', '❗  ', '❌  ']
const PRINT = '__print__'
const CODE = `const console = (f => {
  let times = 0
  const fn = (t, args) => {
    if (times > 15) return
    times++
    const len = args.length
    for (let i = 0; i < len; i++) {
      const type = typeof a
      if (type === 'symbol') args[i] = '#%Symbol%#'
      else if (type === 'object' && args[i] instanceof Error) args[i] = args[i].name + ': ' + args[i].message
    }
    f(t, args)
  }
  return Object.freeze({
    log: (...args) => fn(0, args),
    info: (...args) => fn(1, args),
    warn: (...args) => fn(2, args),
    error: (...args) => fn(3, args)
  })
})(${PRINT}); delete ${PRINT};`
const REP = new RegExp(process.cwd().replace(/\\/g, '\\\\+'), 'gi')
const HELP = `喵✧٩(ˊωˋ)و✧~
快来试试使用 /code 和 /lint 生成代码截图吧, 也可以输入 /fix 来修复语法错误, 还可以使用 /run 来执行脚本哦!✨✨

作者: [Shirasawa](https://github.com/ShirasawaSama)
项目地址: [Github](https://github.com/ShirasawaSama/Nayumi)`

const vm = new Safeify({
  quantity: 4,
  timeout: 1000,
  asyncTimeout: 1000
})

const sendText = ctx => ctx.reply('喵~ 接下来需要您发送您的代码片段咯(๑´∀`๑)!')
const eslint = new CLIEngine({})
const eslintFix = new CLIEngine({ fix: true })

const getErrors = (errors: Linter.LintMessage[]) => JSON.stringify(errors.map(err => ({
  from: { line: err.line - 1, ch: err.column - 1 },
  to: { line: err.endLine - 1, ch: err.endColumn - 1 }
})))
puppeteer.launch().then(async browser => {
  const linter = GenericPool.createPool<(code: string, errors: Linter.LintMessage[]) => Promise<Buffer>>({
    async create () {
      const page = await browser.newPage()
      await page.goto('file:///' + join(__dirname, 'lint.html'))
      const html = await page.$('html')
      return (code: string, errors: Linter.LintMessage[]) => page
        .evaluate('window.update(' + JSON.stringify(code) + ',' + getErrors(errors) + ')')
        .then(() => new Promise(resolve => setTimeout(resolve, 500)))
        .then(() => html.screenshot())
    },
    destroy () { return null }
  }, { max: 5, min: 1 })
  const coder = GenericPool.createPool<(code: string) => Promise<Buffer>>({
    async create () {
      const page = await browser.newPage()
      await page.goto('file:///' + join(__dirname, 'index.html'))
      const html = await page.$('html')
      return (code: string) => page
        .evaluate('window.update(' + JSON.stringify(code) + ')')
        .then(() => html.screenshot())
    },
    destroy () { return null }
  }, { max: 5, min: 1 })

  const bot = new Telegraf(process.env.TOKEN,
    {
      username: 'NayumiBot',
      ...(process.env.AGENT ? { telegram: { agent: new HttpsProxy(process.env.AGENT) } } : {})
    }
  )

  bot.use(session()).use((ctx, next) => {
    ctx.replyRaw = ctx.reply
    ctx.reply = (...args) => ((ctx.session.hasSent = true), ctx.replyRaw(...args))
    return next().catch(e => {
      console.error(e)
      return ctx.replyRaw('发生错误了惹(๑ŏ ﹏ ŏ๑)~')
    })
  })

  bot.on('message', (ctx, next) => ((ctx.session.hasSent = false), next().then(async () => {
    const type = ctx.session.type
    if (type && !ctx.session.hasSent && ctx.message) {
      ctx.session.type = 0
      let code = ctx.message.text
      code = code.endsWith('\n') ? code : code + '\n'
      switch (type) {
        case 1:
          await ctx.replyWithPhoto({ source: await (await coder.acquire())(code) })
          break
        case 2:
          const errors = eslint.executeOnText(code).results[0].messages
          await ctx.replyWithPhoto({ source: await (await linter.acquire())(code, errors) })
          const len = errors.length
          if (len) {
            const times = Math.min(len, 10)
            let text = `@${ctx.message.from.username}\n❌  *总计 ${len} 个语法错误*(๑ŏ ﹏ ŏ๑).\n\n`
            for (let i = 0; i < len; i++) {
              const { message, ruleId, line, column } = errors[i]
              text += `${i}. *${ruleId}*: ${message} _(位于第 ${line} 行, 第 ${column} 列)_\n`
            }
            if (len !== times) text += `\n*还有 ${len - 15} 个语法错误未被列出...*`
            await ctx.replyWithMarkdown(text)
          } else {
            await ctx.reply(`@${ctx.message.from.username}\n✅  代码已检查完毕, 无语法错误哦(=゜ω゜)ノ`)
          }
          break
        case 3:
          const result: string[] = []
          try {
            await vm.run(CODE + ctx.message.text, {
              [PRINT] (t, args) {
                result.push(LEVEL[t] + args.map(a => a === '#%Symbol%#' ? '%Symbol%' : inspect(a)).join(' '))
              }
            })
          } catch (e) {
            result.push(LEVEL[3] + ((e ? e.name + ': ' + e.message : e) || 'Error: null'))
          }
          if (result.length > 14) result.push('...')
          const log = result.join('\n').replace(REP, 'nayumi')
          await ctx.reply(`@${ctx.message.from.username}\n代码执行完毕啦(=゜ω゜)ノ:\n\n` +
            (log.length > 800 ? log.slice(0, 800) + '...' : log))
          break
        case 4:
          const fixed = eslintFix.executeOnText(code).results[0].output
          await ctx.replyWithPhoto({ source: await (await coder.acquire())(fixed) })
          await ctx.replyWithMarkdown(`@${ctx.message.from.username}\n代码修复完毕啦(=゜ω゜)ノ:\n\n` +
            '```javascript\n' + fixed + '\n```')
          break
      }
    }
  })))
  bot.command(['/start', '/help'], ctx => ((ctx.session.type = 0),
    ctx.replyWithMarkdown(HELP)))

  bot.command('code', ctx => {
    ctx.session.type = 1
    return sendText(ctx)
  })

  bot.command('lint', ctx => {
    ctx.session.type = 2
    return sendText(ctx)
  })

  bot.command('run', ctx => {
    ctx.session.type = 3
    return sendText(ctx)
  })

  bot.command('fix', ctx => {
    ctx.session.type = 4
    return sendText(ctx)
  })

  bot.startPolling()
  bot.catch(console.error)
}).catch(console.error)
