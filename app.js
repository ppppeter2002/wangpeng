App({
  globalData: {
    baseUrl: 'http://192.168.0.100:3000/api',
    userId: '',
    role: '',
    openid: ''
  },
  onLaunch() {
    const uid = wx.getStorageSync('uid')
    const role = wx.getStorageSync('role')
    if (uid) {
      this.globalData.userId = uid
      this.globalData.role = role
    }
  }
})
