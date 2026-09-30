const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    classes: [],
    loading: true
  },

  onShow() {
    this.loadClasses()
  },

  async loadClasses() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) {
      wx.switchTab({ url: '/pages/login/login' })
      return
    }
    try {
      const data = await request('GET', '/teacher/classes/' + uid)
      this.setData({ classes: data.classes || [], loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  viewStudents(e) {
    const classId = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/teacher/assignments?classId=' + classId })
  }
})
