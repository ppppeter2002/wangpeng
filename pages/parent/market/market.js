const request = require('../../../utils/request.js')
const app = getApp()

Page({
  data: {
    listings: [],
    loading: true,
    walletLoading: false,
    walletBalance: 0,
    walletTotalEarned: 0,
    signupBonusGranted: 0
  },

  onShow() {
    this.loadWallet()
    this.loadListings()
  },

  getUserId() {
    return app.globalData.userId || wx.getStorageSync('uid')
  },

  async loadWallet() {
    const uid = this.getUserId()
    if (!uid) {
      this.setData({
        walletLoading: false,
        walletBalance: 0,
        walletTotalEarned: 0,
        signupBonusGranted: 0
      })
      return
    }

    this.setData({ walletLoading: true })
    try {
      const data = await request('GET', `/commission/wallet?userId=${encodeURIComponent(uid)}`)
      this.setData({
        walletBalance: data.balance || 0,
        walletTotalEarned: data.totalEarned || 0,
        signupBonusGranted: data.signupBonusGranted || 0,
        walletLoading: false
      })
    } catch (err) {
      this.setData({ walletLoading: false })
      wx.showToast({ title: err.message || '钱包加载失败', icon: 'none' })
    }
  },

  async loadListings() {
    this.setData({ loading: true })
    try {
      const data = await request('GET', '/market/listings')
      this.setData({ listings: data.listings || [], loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  async buy(e) {
    const marketId = e.currentTarget.dataset.id
    const uid = this.getUserId()
    if (!uid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.showModal({
      title: '购买确认',
      content: '确定花费佣金购买此教案？',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '购买中' })
        try {
          const r = await request('POST', '/market/buy', {
            marketId,
            buyerId: uid
          })
          wx.hideLoading()
          wx.showToast({ title: '购买成功 余额 ' + r.remainingBalance, icon: 'success' })
          this.loadWallet()
          this.loadListings()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '购买失败', icon: 'none' })
        }
      }
    })
  },

  async demoTopup() {
    const uid = this.getUserId()
    if (!uid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    wx.showLoading({ title: '充值中' })
    try {
      const data = await request('POST', '/commission/topup', {
        userId: uid,
        amount: 500
      })
      wx.hideLoading()
      this.setData({
        walletBalance: data.balance || 0,
        walletTotalEarned: data.totalEarned || 0,
        signupBonusGranted: 0
      })
      wx.showToast({ title: '已充值 +500', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '充值失败', icon: 'none' })
    }
  }
})
