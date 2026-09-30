const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    me: null,
    rank: null,
    leaderboard: [],
    showChat: false
  },

  onShow() {
    this.loadMe()
  },

  async loadMe() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) {
      wx.switchTab({ url: '/pages/login/login' })
      return
    }
    try {
      const me = await request('GET', '/wx/me?userId=' + uid)
      this.setData({ me, rank: me.rank || null })
      this.loadLeaderboard()
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' })
    }
  },

  async loadLeaderboard() {
    try {
      const data = await request('GET', '/rank/leaderboard')
      this.setData({ leaderboard: (data.leaderboard || []).slice(0, 10) })
    } catch (e) { /* ignore */ }
  },

  async initRank() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) {
      wx.switchTab({ url: '/pages/login/login' })
      return
    }
    try {
      wx.showLoading({ title: '初始化中...' })
      const res = await request('POST', '/rank/init', { studentId: uid })
      wx.hideLoading()
      this.setData({ rank: { tier: res.tier, score: res.score } })
      wx.showToast({ title: '段位已初始化', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message, icon: 'none' })
    }
  },

  goPromotion() {
    wx.navigateTo({ url: '/pages/test/test' })
  },

  goPK() {
    wx.navigateTo({ url: '/pages/pk/pk' })
  },

  goChat() {
    wx.navigateTo({ url: '/pages/chat/chat' })
  },

  toggleChat() {
    this.setData({ showChat: !this.data.showChat })
  }
})
