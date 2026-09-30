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
    fileName: '',
    fileBase64: '',
    fileMimeType: '',
    inputMode: 'text',
    submitting: false,
    result: null
  },

  onLoad() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    this.setData({ teacherId: uid || '' })
  },

  onTextInput(e) {
    this.setData({ text: e.detail.value, inputMode: 'text', fileName: '', fileBase64: '', fileMimeType: '' })
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

  readFileAsBase64(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: reject
      })
    })
  },

  inferMimeType(fileName) {
    const ext = (fileName.split('.').pop() || '').toLowerCase()
    if (ext === 'pdf') return 'application/pdf'
    if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (ext === 'md') return 'text/markdown'
    if (ext === 'txt') return 'text/plain'
    if (ext === 'png') return 'image/png'
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
    if (ext === 'webp') return 'image/webp'
    return 'application/octet-stream'
  },

  onChooseDocument() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['txt', 'md', 'pdf', 'docx'],
      success: async (res) => {
        const file = res.tempFiles[0]
        if (file.size > 5 * 1024 * 1024) {
          wx.showToast({ title: '文件超过 5MB', icon: 'none' })
          return
        }
        const ext = (file.name.split('.').pop() || '').toLowerCase()
        if (ext === 'txt' || ext === 'md') {
          wx.getFileSystemManager().readFile({
            filePath: file.path,
            encoding: 'utf8',
            success: (r) => {
              this.setData({
                text: r.data,
                inputMode: 'text',
                fileName: '',
                fileBase64: '',
                fileMimeType: ''
              })
              wx.showToast({ title: '已加载 ' + file.name, icon: 'success' })
            },
            fail: () => {
              wx.showToast({ title: '读取失败', icon: 'none' })
            }
          })
          return
        }
        try {
          const fileBase64 = await this.readFileAsBase64(file.path)
          this.setData({
            inputMode: 'file',
            fileName: file.name,
            fileBase64,
            fileMimeType: this.inferMimeType(file.name),
            text: ''
          })
          wx.showToast({ title: '已选中 ' + file.name, icon: 'success' })
        } catch (err) {
          wx.showToast({ title: '读取失败', icon: 'none' })
        }
      },
      fail: () => {}
    })
  },

  onChooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const filePath = res.tempFilePaths[0]
        try {
          const fileBase64 = await this.readFileAsBase64(filePath)
          const fileName = filePath.split('/').pop().split('\\').pop()
          this.setData({
            inputMode: 'file',
            fileName,
            fileBase64,
            fileMimeType: this.inferMimeType(fileName),
            text: ''
          })
          wx.showToast({ title: '已载入图片 OCR', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: '读取失败', icon: 'none' })
        }
      },
      fail: () => {}
    })
  },

  clearSelectedFile() {
    this.setData({
      inputMode: 'text',
      fileName: '',
      fileBase64: '',
      fileMimeType: '',
      result: null
    })
  },

  async onSubmit() {
    if (this.data.inputMode === 'file') {
      if (!this.data.fileBase64 || !this.data.fileName) {
        wx.showToast({ title: '请先选择文件', icon: 'none' })
        return
      }
    } else if (!this.data.text || this.data.text.trim().length === 0) {
      wx.showToast({ title: '请先粘贴或上传文本', icon: 'none' })
      return
    }
    if (!this.data.teacherId) {
      wx.showToast({ title: '未登录', icon: 'none' })
      return
    }

    this.setData({ submitting: true, result: null })
    try {
      let res
      if (this.data.inputMode === 'file') {
        const body = {
          fileName: this.data.fileName,
          fileBase64: this.data.fileBase64,
          mimeType: this.data.fileMimeType,
          subject: this.data.subject,
          teacherId: this.data.teacherId
        }
        if (this.data.gradeLevel !== null) body.gradeLevel = this.data.gradeLevel
        if (this.data.chapter) body.chapter = this.data.chapter
        res = await request('POST', '/bank/ingest-file', body)
      } else {
        const body = {
          text: this.data.text,
          subject: this.data.subject,
          teacherId: this.data.teacherId
        }
        if (this.data.gradeLevel !== null) body.gradeLevel = this.data.gradeLevel
        if (this.data.chapter) body.chapter = this.data.chapter
        res = await request('POST', '/bank/ingest-text', body)
      }
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
