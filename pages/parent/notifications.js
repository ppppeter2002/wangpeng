const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    notifications: [],
    loading: true
  },

  onShow() {
    this.loadList()
  },

  async loadList() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) {
      wx.switchTab({ url: '/pages/login/login' })
      return
    }
    try {
      const data = await request('GET', '/notification/list?userId=' + uid + '&limit=50')
      this.setData({ notifications: data.notifications || [], loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  async markRead(e) {
    const id = e.currentTarget.dataset.id
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    try {
      await request('POST', '/notification/read', { notificationId: id, userId: uid })
      this.loadList()
    } catch (err) {
      wx.showToast({ title: err.message || '标记失败', icon: 'none' })
    }
  },

  async markAllRead() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    try {
      await request('POST', '/notification/read-all', { userId: uid })
      wx.showToast({ title: '已全部标记', icon: 'success' })
      this.loadList()
    } catch (err) {
      wx.showToast({ title: err.message || '失败', icon: 'none' })
    }
  }
})
