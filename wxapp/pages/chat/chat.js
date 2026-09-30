const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    me: null,
    rank: null,
    messages: [],
    input: '',
    loading: false,
    scrollTop: 0
  },

  onLoad() {
    this.loadMe()
  },

  async loadMe() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    try {
      const me = await request('GET', '/wx/me?userId=' + uid)
      this.setData({ me })
      // 拉段位卡片
      try {
        const r = await request('GET', '/rank/my/' + uid)
        this.setData({ rank: r })
      } catch (e) { /* 学生可能还没初始化段位 */ }
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  onInput(e) { this.setData({ input: e.detail.value }) },

  async send() {
    const text = (this.data.input || '').trim()
    if (!text || this.data.loading) return

    const uid = app.globalData.userId || wx.getStorageSync('uid')
    const userMsg = { role: 'user', content: text }
    const messages = this.data.messages.concat(userMsg)
    this.setData({ messages, input: '', loading: true })
    this.scrollBottom()

    try {
      // 把已有气泡转成 history（ai -> assistant，user -> user），只保留最近 6 轮
      const history = this.data.messages
        .filter((m) => m.role === 'user' || m.role === 'ai')
        .slice(-12)
        .map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))

      const r = await request('POST', '/chat/dialogue', {
        studentId: uid,
        message: text,
        history
      })
      const reply = (r && r.reply) || '老师这里暂时没回上，再问一次试试～'
      this.setData({
        messages: this.data.messages.concat({ role: 'ai', content: reply, source: r && r.source }),
        loading: false
      })
      this.scrollBottom()
    } catch (err) {
      this.setData({
        messages: this.data.messages.concat({ role: 'ai', content: '出错了：' + (err.message || '未知错误') }),
        loading: false
      })
      this.scrollBottom()
    }
  },

  scrollBottom() {
    // 触发滚到底部
    const that = this
    wx.createSelectorQuery().in(this).select('.chat-list').boundingClientRect((rect) => {
      if (rect) that.setData({ scrollTop: rect.height + 1000 })
    }).exec()
  }
})
