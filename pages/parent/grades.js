const request = require('../../utils/request.js')
const app = getApp()

Page({
  data: {
    studentId: '',
    grades: [],
    loading: true
  },

  onLoad(options) {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    const sid = options.studentId || ''
    this.setData({ studentId: sid })
    if (!sid) {
      // 没指定学生 → 拉家长所有孩子默认第一个
      this.pickDefaultStudent(uid)
    } else {
      this.loadGrades(sid)
    }
  },

  async pickDefaultStudent(parentId) {
    try {
      const data = await request('GET', '/parent/children/' + parentId)
      const list = data.children || []
      if (list.length === 0) {
        wx.showToast({ title: '请先绑定学生', icon: 'none' })
        this.setData({ loading: false })
        return
      }
      this.setData({ studentId: list[0].studentId })
      this.loadGrades(list[0].studentId)
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  async loadGrades(studentId) {
    try {
      const data = await request('GET', '/assignment/student/' + studentId + '/grades')
      this.setData({ grades: data.grades || [], loading: false })
    } catch (err) {
      this.setData({ loading: false, grades: [] })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  }
})
