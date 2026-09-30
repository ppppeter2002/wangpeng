const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    me: null,
    children: [],
    loading: true
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
      let children = []
      try {
        const childrenData = await request('GET', '/parent/children/' + uid)
        children = childrenData.children || []
      } catch (e) { /* 非家长角色，忽略 */ }
      this.setData({
        me,
        children,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  goChildren() {
    wx.navigateTo({ url: '/pages/parent/children' })
  },

  goGrades() {
    wx.navigateTo({ url: '/pages/parent/grades' })
  },

  goNotifications() {
    wx.navigateTo({ url: '/pages/parent/notifications' })
  },

  goMarket() {
    wx.navigateTo({ url: '/pages/parent/market' })
  }
})