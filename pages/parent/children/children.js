const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    children: [],
    loading: true,
    bindPhone: ''
  },

  onShow() {
    this.loadChildren()
  },

  async loadChildren() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) {
      wx.switchTab({ url: '/pages/login/login' })
      return
    }
    try {
      const data = await request('GET', '/parent/children/' + uid)
      this.setData({ children: data.children || [], loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  onPhoneInput(e) {
    this.setData({ bindPhone: e.detail.value })
  },

  async doBind() {
    const phone = this.data.bindPhone.trim()
    if (!phone) {
      wx.showToast({ title: '请输入学生手机号', icon: 'none' })
      return
    }
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    wx.showLoading({ title: '绑定中' })
    try {
      const r = await request('POST', '/parent/bind', {
        parentId: uid,
        studentPhone: phone
      })
      wx.hideLoading()
      wx.showToast({ title: '已绑定 ' + (r.studentName || ''), icon: 'success' })
      this.setData({ bindPhone: '' })
      this.loadChildren()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '绑定失败', icon: 'none' })
    }
  },

  viewGrades(e) {
    const studentId = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/parent/grades?studentId=' + studentId })
  }
})
