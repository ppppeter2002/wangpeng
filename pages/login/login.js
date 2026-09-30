const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    role: 'student',
    loading: false
  },

  selectRole(e) {
    this.setData({ role: e.currentTarget.dataset.role })
  },

  onLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })

    wx.login({
      success: async (res) => {
        if (!res.code) {
          wx.showToast({ title: '登录失败', icon: 'none' })
          this.setData({ loading: false })
          return
        }
        try {
          const r = await request('POST', '/wx/login', {
            code: res.code,
            role: this.data.role
          })
          wx.setStorageSync('uid', r.userId)
          wx.setStorageSync('role', r.role)
          app.globalData.userId = r.userId
          app.globalData.role = r.role
          app.globalData.openid = r.openid

          wx.showToast({ title: '登录成功', icon: 'success' })
          setTimeout(() => {
            const url = r.role === 'parent'
              ? '/pages/parent/index'
              : r.role === 'teacher'
                ? '/pages/teacher/index'
                : '/pages/student/index'
            wx.switchTab({ url })
          }, 500)
        } catch (err) {
          wx.showToast({ title: err.message || '登录失败', icon: 'none' })
        } finally {
          this.setData({ loading: false })
        }
      },
      fail: () => {
        wx.showToast({ title: 'wx.login 失败', icon: 'none' })
        this.setData({ loading: false })
      }
    })
  }
})
