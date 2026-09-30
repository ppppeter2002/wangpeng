const request = require('../../utils/request.js')

Component({
  properties: {},
  data: {
    messages: [],
    input: '',
    loading: false
  },
  methods: {
    onInput(e) { this.setData({ input: e.detail.value }) },
    close() { this.triggerEvent('close') },

    async send() {
      const text = this.data.input.trim()
      if (!text || this.data.loading) return

      const userMsg = { role: 'user', content: text }
      const messages = this.data.messages.concat(userMsg)
      this.setData({ messages, input: '', loading: true })

      try {
        // 调 AI 出题接口（单轮，把用户输入当 topic）
        const r = await request('POST', '/ai/generate', {
          subject: '综合',
          topic: text,
          difficulty: 3,
          count: 1,
          mode: 'promotion'
        })
        let reply = ''
        if (r.questions && r.questions.length > 0) {
          const q = r.questions[0]
          reply = `【题目】${q.question}\n`
          if (q.options) {
            q.options.forEach((opt, i) => { reply += `${opt}\n` })
          }
          reply += `【答案】${q.answer}\n`
          if (q.explanation) reply += `【解析】${q.explanation}`
        } else {
          reply = 'AI 没有返回题目，请换个知识点试试。'
        }
        this.setData({ messages: this.data.messages.concat({ role: 'ai', content: reply }) })
      } catch (err) {
        this.setData({
          messages: this.data.messages.concat({ role: 'ai', content: '出错了：' + (err.message || '未知错误') })
        })
      } finally {
        this.setData({ loading: false })
      }
    }
  }
})
