import axios from 'axios'

export default (name: string) => axios
  .get('https://registry.npm.taobao.org/' + name)
  .then(({ data: { error, readme, homepage, repository } }) => {
    if (error) return false
    const r: string = readme || ''
    const usage = []
    let i = 0
    let j = 0
    let t = 0
    let state = false
    while (t < 3 && ~(i = r.indexOf('```', i))) {
      i += 3
      if (state) {
        state = false
        usage.push(r.substring(j, i - 3).trimLeft())
        i += 3
        t++
      } else {
        let key = r[i]
        if (key === 'j' || key === 't') {
          if (r[(j = i + 1)] === 's') {
            state = true
            j++
          } else if (((key = r.substr(i, 10)), key === 'javascript' || key === 'typescript')) {
            j = i + 10
            state = true
          }
        }
      }
    }
    return {
      usage,
      homepage,
      repository: (typeof repository === 'string' ? repository : repository ? repository.url : '')
        .match(/https?:\/\/.+?$/)
    } as { usage: string[], homepage: string | undefined, repository: string }
  })
