const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    assignmentId: '',
    submissions: [],
    loading: true,
    gradingId: '',
    gradeForm: {
      studentId: '',
      score: '',
      feedback: ''
    }
  },

  onLoad(options) {
    const id = options.assignmentId || ''
    this.setData({ assignmentId: id })
    if (id) this.loadSubmissions(id)
  },

  async loadSubmissions(assignmentId) {
    try {
      const data = await request('GET', '/assignment/' + assignmentId + '/submissions')
      this.setData({ submissions: data.submissions || [], loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  startGrade(e) {
    const sid = e.currentTarget.dataset.sid
    this.setData({
      gradingId: sid,
      'gradeForm.studentId': sid,
      'gradeForm.score': '',
      'gradeForm.feedback': ''
    })
  },

  cancelGrade() {
    this.setData({ gradingId: '' })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ ['gradeForm.' + field]: e.detail.value })
  },

  async submitGrade() {
    const { studentId, score, feedback } = this.data.gradeForm
    const scoreNum = Number(score)
    if (!Number.isFinite(scoreNum) || scoreNum < 0) {
      wx.showToast({ title: '分数必须是非负数字', icon: 'none' })
      return
    }
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    wx.showLoading({ title: '批改中' })
    try {
      await request('POST', '/assignment/' + this.data.assignmentId + '/grade', {
        teacherId: uid,
        studentId,
        score: scoreNum,
        feedback: feedback || undefined
      })
      wx.hideLoading()
      wx.showToast({ title: '已批改', icon: 'success' })
      this.setData({ gradingId: '' })
      this.loadSubmissions(this.data.assignmentId)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '批改失败', icon: 'none' })
    }
  }
})
