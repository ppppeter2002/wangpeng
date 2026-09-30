const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    classes: [],
    classId: '',
    form: {
      subject: '',
      title: '',
      description: '',
      dueAt: ''
    },
    assignments: [],
    submitting: false
  },

  async onLoad(options) {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) {
      wx.switchTab({ url: '/pages/login/login' })
      return
    }
    try {
      const data = await request('GET', '/teacher/classes/' + uid)
      const list = data.classes || []
      let initClassId = options.classId || (list.length > 0 ? list[0].id : '')
      this.setData({ classes: list, classId: initClassId })
      if (initClassId) this.loadAssignments(initClassId)
    } catch (err) {
      wx.showToast({ title: err.message || '加载班级失败', icon: 'none' })
    }
  },

  onClassPick(e) {
    const idx = e.detail.value
    const c = this.data.classes[idx]
    if (c) {
      this.setData({ classId: c.id, 'form.subject': c.subject || '' })
      this.loadAssignments(c.id)
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ ['form.' + field]: e.detail.value })
  },

  async loadAssignments(classId) {
    try {
      const data = await request('GET', '/assignment/' + classId + '/list')
      this.setData({ assignments: data.assignments || [] })
    } catch (err) {
      this.setData({ assignments: [] })
    }
  },

  async submit() {
    const { subject, title, description, dueAt } = this.data.form
    const classId = this.data.classId
    if (!classId || !subject || !title) {
      wx.showToast({ title: '请填写班级/科目/标题', icon: 'none' })
      return
    }
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中' })
    try {
      await request('POST', '/assignment/create', {
        classId,
        subject,
        teacherId: uid,
        title,
        description: description || undefined,
        dueAt: dueAt || undefined
      })
      wx.hideLoading()
      wx.showToast({ title: '已布置', icon: 'success' })
      this.setData({ 'form.title': '', 'form.description': '', 'form.dueAt': '' })
      this.loadAssignments(classId)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '布置失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  viewSubmissions(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/teacher/submissions?assignmentId=' + id })
  }
})
