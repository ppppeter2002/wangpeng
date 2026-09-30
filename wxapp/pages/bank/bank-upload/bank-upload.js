const request = require('../../../utils/request.js')
const app = getApp()

Page({
  data: {
    text: '',
    teacherId: '',
    subjects: ['数学', '语文', '英语', '物理', '化学', '综合'],
    subjectIdx: 0,
    subject: '数学',
    gradeLevels: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    gradeIdx: -1,
    gradeLevel: null,
    chapter: '',
    submitting: false,
    result: null
  },

  onLoad() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    this.setData({ teacherId: uid || '' })
  },

  onTextInput(e) {
    this.setData({ text: e.detail.value })
  },

  onSubjectChange(e) {
    const idx = Number(e.detail.value)
    this.setData({ subjectIdx: idx, subject: this.data.subjects[idx] })
  },

  onGradeChange(e) {
    const idx = Number(e.detail.value)
    this.setData({
      gradeIdx: idx,
      gradeLevel: idx >= 0 ? Number(this.data.gradeLevels[idx]) : null
    })
  },

  onChapterInput(e) {
    this.setData({ chapter: e.detail.value })
  },

  onChooseTxt() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['txt', 'md'],
      success: (res) => {
        const file = res.tempFiles[0]
        if (file.size > 1024 * 1024) {
          wx.showToast({ title: '文件超过 1MB', icon: 'none' })
          return
        }
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: (r) => {
            this.setData({ text: r.data })
            wx.showToast({ title: '已加载 ' + file.name, icon: 'success' })
          },
          fail: () => {
            wx.showToast({ title: '读取失败', icon: 'none' })
          }
        })
      },
      fail: () => {}
    })
  },

  async onSubmit() {
    if (!this.data.text || this.data.text.trim().length === 0) {
      wx.showToast({ title: '请先粘贴或上传文本', icon: 'none' })
      return
    }
    if (!this.data.teacherId) {
      wx.showToast({ title: '未登录', icon: 'none' })
      return
    }
    this.setData({ submitting: true, result: null })
    try {
      const body = {
        text: this.data.text,
        subject: this.data.subject,
        teacherId: this.data.teacherId
      }
      if (this.data.gradeLevel !== null) body.gradeLevel = this.data.gradeLevel
      if (this.data.chapter) body.chapter = this.data.chapter
      const res = await request('POST', '/bank/ingest-text', body)
      this.setData({
        result: res,
        submitting: false
      })
      wx.showToast({ title: `入库 ${res.ingested} 道`, icon: 'success' })
    } catch (err) {
      this.setData({ submitting: false })
      wx.showToast({ title: err.message || '拆题失败', icon: 'none', duration: 3000 })
    }
  },

  goList() {
    wx.navigateTo({ url: '/pages/bank/bank-list/bank-list' })
  }
})
