const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    listings: [],
    loading: true
  },

  onShow() {
    this.loadListings()
  },

  async loadListings() {
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
    const uid = app.globalData.userId || wx.getStorageSync('uid')
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
          this.loadListings()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '购买失败', icon: 'none' })
        }
      }
    })
  }
})
