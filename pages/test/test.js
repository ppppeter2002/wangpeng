const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    state: 'idle',         // idle | testing | result
    rank: null,
    test: null,            // { testId, fromTier, toTier, questions[] }
    curIdx: 0,             // 当前题号
    picks: [],             // 每题选中的答案
    submitting: false,
    result: null           // { score, correct, total, passed, upgraded, newTier }
  },

  onLoad() { this.loadRank() },

  async loadRank() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) { wx.redirectTo({ url: '/pages/login/login' }); return }
    try {
      const r = await request('GET', '/rank/my/' + uid)
      this.setData({ rank: r })
      if (!r || r.tier === '王者') {
        // 已是最高段，没法再晋级
        // 仍允许进入页面，但点开始时后端会 400
      }
    } catch (e) {
      // 段位未初始化
      this.setData({ rank: null })
    }
  },

  async startTest() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) return
    this.setData({ submitting: true })
    try {
      const t = await request('POST', '/rank/promotion-test/start', { studentId: uid })
      // 校验返回结构
      if (!t || !t.testId || !Array.isArray(t.questions)) {
        throw new Error('返回结构异常')
      }
      const picks = t.questions.map(() => null)
      this.setData({
        state: 'testing',
        test: t,
        curIdx: 0,
        picks,
        submitting: false
      })
    } catch (err) {
      wx.showToast({ title: err.message || '开始失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  pickOption(e) {
    const idx = e.currentTarget.dataset.idx
    const opt = e.currentTarget.dataset.opt
    const picks = this.data.picks.slice()
    picks[idx] = opt
    this.setData({ picks })
  },

  prevQ() { if (this.data.curIdx > 0) this.setData({ curIdx: this.data.curIdx - 1 }) },
  nextQ() {
    if (this.data.curIdx < (this.data.test.questions.length - 1)) {
      this.setData({ curIdx: this.data.curIdx + 1 })
    }
  },

  async submitTest() {
    const picks = this.data.picks
    const total = this.data.test.questions.length
    const answered = picks.filter((p) => p !== null).length
    if (answered < total) {
      wx.showModal({ title: '提示', content: `还有 ${total - answered} 题未作答，确定提交？`, success: (r) => {
        if (r.confirm) this.doSubmit()
      }})
    } else {
      this.doSubmit()
    }
  },

  async doSubmit() {
    this.setData({ submitting: true })
    try {
      const res = await request('POST', '/rank/promotion-test/submit', {
        testId: this.data.test.testId,
        answers: this.data.picks
      })
      this.setData({ state: 'result', result: res, submitting: false })
      this.loadRank()
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  retry() { this.setData({ state: 'idle', test: null, result: null, picks: [], curIdx: 0 }) }
})
