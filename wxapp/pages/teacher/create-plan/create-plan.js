const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    classes: [],
    form: {
      classId: '',
      subject: '',
      title: '',
      content: ''
    },
    submitting: false
  },

  async onLoad() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) {
      wx.switchTab({ url: '/pages/login/login' })
      return
    }
    try {
      const data = await request('GET', '/teacher/classes/' + uid)
      this.setData({ classes: data.classes || [] })
    } catch (err) {
      wx.showToast({ title: err.message || '加载班级失败', icon: 'none' })
    }
  },

  onClassPick(e) {
    const idx = e.detail.value
    const c = this.data.classes[idx]
    if (c) {
      this.setData({ 'form.classId': c.id, 'form.subject': c.subject || '' })
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ ['form.' + field]: e.detail.value })
  },

  async submit() {
    const { classId, subject, title, content } = this.data.form
    if (!classId || !subject || !title || !content) {
      wx.showToast({ title: '请填写全部字段', icon: 'none' })
      return
    }
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中' })
    try {
      const r = await request('POST', '/lesson-plan/create', {
        authorId: uid,
        classId,
        subject,
        title,
        content
      })
      wx.hideLoading()
      wx.showToast({ title: '已创建 v' + r.version, icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '创建失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
