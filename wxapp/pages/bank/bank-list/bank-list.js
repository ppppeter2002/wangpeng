const request = require('../../../utils/request.js')
const app = getApp()

Page({
  data: {
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    // 筛选
    subject: '',
    source: '',
    gradeLevel: '',
    chapter: '',
    // 选项
    subjects: ['数学', '语文', '英语', '物理', '化学', '综合'],
    sources: ['manual', 'plan', 'assignment', 'doc'],
    gradeLevels: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    subjectIdx: -1,
    sourceIdx: -1,
    gradeIdx: -1,
    teacherId: ''
  },

  onLoad() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    this.setData({ teacherId: uid || '' })
    this.loadList(true)
  },

  async loadList(reset) {
    if (this.data.loading) return
    this.setData({ loading: true })
    const page = reset ? 1 : this.data.page
    const query = [`page=${page}`, `pageSize=${this.data.pageSize}`]
    if (this.data.subject) query.push(`subject=${encodeURIComponent(this.data.subject)}`)
    if (this.data.source) query.push(`source=${encodeURIComponent(this.data.source)}`)
    if (this.data.gradeLevel) query.push(`gradeLevel=${this.data.gradeLevel}`)
    if (this.data.chapter) query.push(`chapter=${encodeURIComponent(this.data.chapter)}`)
    try {
      const res = await request('GET', '/bank/list?' + query.join('&'))
      const newList = reset ? res.questions : this.data.list.concat(res.questions)
      this.setData({
        list: newList,
        total: res.total,
        page: res.page,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  onSubjectChange(e) {
    const idx = Number(e.detail.value)
    this.setData({
      subjectIdx: idx,
      subject: idx >= 0 ? this.data.subjects[idx] : '',
      list: []
    })
    this.loadList(true)
  },

  onSourceChange(e) {
    const idx = Number(e.detail.value)
    this.setData({
      sourceIdx: idx,
      source: idx >= 0 ? this.data.sources[idx] : '',
      list: []
    })
    this.loadList(true)
  },

  onGradeChange(e) {
    const idx = Number(e.detail.value)
    this.setData({
      gradeIdx: idx,
      gradeLevel: idx >= 0 ? this.data.gradeLevels[idx] : '',
      list: []
    })
    this.loadList(true)
  },

  onChapterInput(e) {
    this.setData({ chapter: e.detail.value })
  },

  onChapterSearch() {
    this.setData({ list: [] })
    this.loadList(true)
  },

  onReachBottom() {
    if (this.data.list.length < this.data.total) {
      this.setData({ page: this.data.page + 1 })
      this.loadList(false)
    }
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/bank/bank-upload/bank-upload' })
  }
})
