const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    plans: [],
    loading: true
  },

  onShow() {
    this.loadPlans()
  },

  async loadPlans() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) {
      wx.switchTab({ url: '/pages/login/login' })
      return
    }
    try {
      const data = await request('GET', '/teacher/plans/' + uid)
      this.setData({ plans: data.plans || [], loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  async publishPlan(e) {
    const id = e.currentTarget.dataset.id
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    wx.showLoading({ title: '发布中' })
    try {
      await request('POST', '/lesson-plan/publish', { lessonPlanId: id, authorId: uid })
      wx.hideLoading()
      wx.showToast({ title: '已发布', icon: 'success' })
      this.loadPlans()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '发布失败', icon: 'none' })
    }
  },

  async listOnMarket(e) {
    const id = e.currentTarget.dataset.id
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    wx.showModal({
      title: '上架到教案市场',
      editable: true,
      placeholderText: '请输入价格（正整数）',
      success: async (res) => {
        if (!res.confirm) return
        const price = Number(res.content)
        if (!Number.isInteger(price) || price <= 0) {
          wx.showToast({ title: '价格必须是正整数', icon: 'none' })
          return
        }
        wx.showLoading({ title: '上架中' })
        try {
          await request('POST', '/market/list', { lessonPlanId: id, sellerId: uid, price })
          wx.hideLoading()
          wx.showToast({ title: '已上架', icon: 'success' })
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '上架失败', icon: 'none' })
        }
      }
    })
  }
})
