const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    me: null,
    planCount: 0,
    classCount: 0,
    commissionBalance: 0,
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
      const [plansRes, classesRes] = await Promise.all([
        request('GET', '/teacher/plans/' + uid).catch(() => ({ plans: [] })),
        request('GET', '/teacher/classes/' + uid).catch(() => ({ classes: [] }))
      ])
      // 佣金可能未配置，失败时默认 0
      let balance = 0
      try {
        const wallet = await request('GET', '/commission/wallet?userId=' + uid)
        balance = (wallet && typeof wallet.balance === 'number') ? wallet.balance : 0
      } catch (e) { /* 钱包未开通 */ }
      this.setData({
        me,
        planCount: (plansRes.plans || []).length,
        classCount: (classesRes.classes || []).length,
        commissionBalance: balance,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  goPlans() {
    wx.navigateTo({ url: '/pages/teacher/plans' })
  },

  goCreatePlan() {
    wx.navigateTo({ url: '/pages/teacher/create-plan' })
  },

  goClasses() {
    wx.navigateTo({ url: '/pages/teacher/classes' })
  },

  goAssignments() {
    wx.navigateTo({ url: '/pages/teacher/assignments' })
  },

  goSubmissions() {
    wx.navigateTo({ url: '/pages/teacher/submissions' })
  }
})
