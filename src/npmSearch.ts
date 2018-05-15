import 'echarts/theme/macarons'
import axios from 'axios'
import { createCanvas, registerFont } from 'canvas'
import * as charts from 'echarts'
import { join } from 'path'

registerFont(join(__dirname, '../web/font/ttf/deng.ttf'), { family: 'deng' })
registerFont(join(__dirname, '../web/font/ttf/FiraCode-Regular.ttf'), { family: 'FiraCode' })
const ctx = createCanvas(700, 600)
const chart = charts.init(ctx, 'macarons')
;(charts as any).setCanvasCreator(() => ctx)
const label = {
  normal: {
    show: true
  }
}
chart.setOption({
  animation: false,
  tooltip: {},
  textStyle: { fontFamily: 'FiraCode,deng' },
  legend: {
    data: ['下载量', '质量', '维护度']
  },
  grid: {
    left: '4%',
    right: '5%',
    bottom: '4%',
    containLabel: true
  },
  xAxis: [{
    type: 'category',
    axisLabel: {
      interval: 0,
      rotate: 20
    }
  }],
  yAxis: [{
    max: 100,
    type: 'value'
  }]
}, true)
const dom = chart.getDom() as any

export default (query: string, agent) => axios
  .get('https://api.npms.io/v2/search?size=10&q=' + query + '+not:deprecated', { httpsAgent: agent })
  .then(({ data: { results, total } }) => {
    chart.setOption({
      series: [
        {
          label,
          name: '下载量',
          type: 'bar',
          stack: '分数',
          data: results.map(result => result.score.detail.popularity * 33 | 0)
        },
        {
          label,
          name: '质量',
          type: 'bar',
          stack: '分数',
          data: results.map(result => result.score.detail.quality * 33 | 0)
        },
        {
          label,
          name: '维护度',
          type: 'bar',
          stack: '分数',
          data: results.map(result => result.score.detail.maintenance * 33 | 0)
        }
      ],
      xAxis: [{ data: results.map(result => result.package.name) }]
    })
    return { source: dom.toBuffer() as Buffer, results, total }
  })
