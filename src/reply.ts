import { inspect } from 'util'
import { Safeify } from 'safeify'
import { Browser } from 'puppeteer'
import { CLIEngine } from 'eslint'
import * as escape from 'markdown-escape'
import getLinter from './linter'
import getCodeImage from './codeImage'

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

const TYPE = Symbol('Type')

const eslint = new CLIEngine({})
const eslintFixer = new CLIEngine({ fix: true })
export default (bot: any, browser: Browser) => {
  const vm = new Safeify({
    quantity: 4,
    timeout: 1000,
    asyncTimeout: 1000
  })
  const linter = getLinter(browser)
  const codeImage = getCodeImage(browser)
  const types: { [command: string]: (ctx: any, code: string) => void } = {
    async code (ctx, code) {
      ctx.replyWithPhoto({ source: await (await codeImage.acquire())(code) })
    },
    async lint (ctx, code) {
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
    },
    async run (ctx, code) {
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
      const log = escape(result.join('\n').replace(REP, 'nayumi'))
      await ctx.reply(`@${ctx.message.from.username}\n代码执行完毕啦(=゜ω゜)ノ:\n\n` +
        (log.length > 800 ? log.slice(0, 800) + '...' : log))
    },
    async fix (ctx, code) {
      const fixed = eslintFixer.executeOnText(code).results[0].output
      await ctx.replyWithPhoto({ source: await (await codeImage.acquire())(fixed) })
      await ctx.replyWithMarkdown(`@${ctx.message.from.username}\n代码修复完毕啦(=゜ω゜)ノ:\n\n` +
        '```javascript\n' + fixed + '\n```')
    }
  }

  Object.keys(types).forEach(command => bot.command(command, ctx => {
    ctx.session[TYPE] = command
    return ctx.reply('喵~ 接下来需要您发送您的代码片段咯(๑´∀`๑)!')
  }))
  bot.on('message', (ctx, next) => next().then(() => {
    const type = types[ctx.session[TYPE]]
    if (type && !ctx.session.hasSent && ctx.message) {
      ctx.session[TYPE] = null
      ctx.session.hasSent = true
      const code = ctx.message.text
      type(ctx, code.endsWith('\n') ? code : code + '\n')
    }
  }))
}
