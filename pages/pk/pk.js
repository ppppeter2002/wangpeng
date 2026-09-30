const request = require('../../utils/request.js')
const app = getApp()

const POLL_INTERVAL = 3000   // 3s 轮询一次
const ROUND_TIME = 60        // 60s 倒计时

Page({
  data: {
    state: 'lobby',          // lobby | matching | in-round | wait-opponent | finished
    me: null,
    rank: null,
    lobby: [],               // waiting matches
    matchId: '',
    match: null,             // 当前 match status 对象
    round: 0,                // 当前轮次 1 or 2
    questions: [],
    curIdx: 0,
    picks: [],
    timeLeft: ROUND_TIME,
    submitting: false,
    mySide: '',              // 'A' or 'B'
    myScore: 0,
    oppScore: 0,
    pollTimer: null,
    countdownTimer: null,
    finalResult: null
  },

  onLoad() { this.loadMeAndLobby() },

  onUnload() { this.clearTimers() },

  loadMeAndLobby() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) { wx.redirectTo({ url: '/pages/login/login' }); return }
    Promise.all([
      request('GET', '/wx/me?userId=' + uid).catch(() => null),
      request('GET', '/rank/my/' + uid).catch(() => null),
      request('GET', '/pk/lobby').catch(() => ({ lobby: [] }))
    ]).then(([me, rank, lb]) => {
      this.setData({
        me: me || null,
        rank: rank || null,
        lobby: (lb && lb.lobby) || []
      })
    })
  },

  refreshLobby() {
    request('GET', '/pk/lobby').then((lb) => {
      this.setData({ lobby: (lb && lb.lobby) || [] })
    }).catch(() => {})
  },

  // 1. 快速匹配
  async quickMatch() {
    const uid = app.globalData.userId || wx.getStorageSync('uid')
    if (!uid) return
    if (!this.data.rank) {
      wx.showToast({ title: '请先初始化段位', icon: 'none' })
      return
    }
    this.setData({ state: 'matching' })
    try {
      const r = await request('POST', '/pk/match', { studentId: uid })
      if (r.matched) {
        // 已匹配到对手
        this.setData({
          matchId: r.matchId,
          mySide: r.studentAId === uid ? 'A' : 'B'
        })
        this.startMatch()
      } else {
        // 进入 waiting，轮询 lobby，如果自己 matchId 不在 waiting 列表里了，说明对手加入了
        this.setData({ matchId: r.matchId, mySide: 'A' })
        this.startMatchingPoll()
      }
    } catch (err) {
      wx.showToast({ title: err.message || '匹配失败', icon: 'none' })
      this.setData({ state: 'lobby' })
    }
  },

  // 轮询大厅，看自己 matchId 是否已不在 waiting（即 matched）
  startMatchingPoll() {
    const tid = setInterval(async () => {
      try {
        const lb = await request('GET', '/pk/lobby')
        const stillWaiting = (lb.lobby || []).some((m) => m.matchId === this.data.matchId)
        if (!stillWaiting) {
          // 已被匹配
          clearInterval(tid)
          this.setData({ pollTimer: null })
          this.startMatch()
        }
      } catch (e) { /* ignore */ }
    }, POLL_INTERVAL)
    this.setData({ pollTimer: tid })
  },

  cancelMatch() {
    if (this.data.pollTimer) { clearInterval(this.data.pollTimer) }
    this.setData({ state: 'lobby', matchId: '', pollTimer: null })
  },

  // 2. 进入对局，拉第1轮题
  async startMatch() {
    try {
      const r = await request('POST', '/pk/start', { matchId: this.data.matchId })
      const picks = r.questions.map(() => null)
      this.setData({
        state: 'in-round',
        round: 1,
        questions: r.questions,
        curIdx: 0,
        picks,
        timeLeft: ROUND_TIME
      })
      this.startCountdown()
    } catch (err) {
      wx.showToast({ title: err.message || '开始对局失败', icon: 'none' })
    }
  },

  startCountdown() {
    if (this.data.countdownTimer) clearInterval(this.data.countdownTimer)
    const tid = setInterval(() => {
      if (this.data.timeLeft <= 0) {
        clearInterval(tid)
        this.setData({ countdownTimer: null })
        // 时间到自动提交当前答案
        this.submitAnswers(true)
        return
      }
      this.setData({ timeLeft: this.data.timeLeft - 1 })
    }, 1000)
    this.setData({ countdownTimer: tid })
  },

  pickOption(e) {
    const idx = e.currentTarget.dataset.idx
    const opt = e.currentTarget.dataset.opt
    const picks = this.data.picks.slice()
    picks[idx] = opt
    this.setData({ picks })
  },

  prevQ() { if (this.data.curIdx > 0) this.setData({ curIdx: this.data.curIdx - 1 }) },
  nextQ() { if (this.data.curIdx < this.data.questions.length - 1) this.setData({ curIdx: this.data.curIdx + 1 }) },

  // 3. 提交本轮答案
  async submitAnswers(timeout) {
    if (this.data.submitting) return
    if (this.data.countdownTimer) {
      clearInterval(this.data.countdownTimer)
      this.setData({ countdownTimer: null })
    }
    this.setData({ submitting: true })
    try {
      const uid = app.globalData.userId || wx.getStorageSync('uid')
      const r = await request('POST', '/pk/answer', {
        matchId: this.data.matchId,
        studentId: uid,
        round: this.data.round,
        answers: this.data.picks
      })
      // bothDone=true 表示对手已交，可进入下一轮；false 等待对手
      this.setData({
        myScore: this.data.mySide === 'A' ? r.score : this.data.myScore,
        oppScore: this.data.mySide === 'B' ? r.score : this.data.oppScore
      })
      // 注：score 是本轮得分，需要刷新总分；从 /pk/match/:matchId 拉一次最新分
      const status = await request('GET', '/pk/match/' + this.data.matchId)
      const myLatest = this.data.mySide === 'A' ? status.scoreA : status.scoreB
      const oppLatest = this.data.mySide === 'A' ? status.scoreB : status.scoreA
      this.setData({ match: status, myScore: myLatest, oppScore: oppLatest })

      if (r.bothDone) {
        // 双方都已提交
        if (this.data.round === 1) {
          this.enterNextRound()
        } else {
          this.finishMatch()
        }
      } else {
        // 等对手提交
        this.setData({ state: 'wait-opponent', submitting: false })
        this.startOpponentPoll()
      }
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  // 轮询对局状态，等对手提交
  startOpponentPoll() {
    const tid = setInterval(async () => {
      try {
        const status = await request('GET', '/pk/match/' + this.data.matchId)
        const r = status.rounds.find((x) => x.round === this.data.round)
        if (!r) return
        const oppDone = this.data.mySide === 'A' ? r.bDone : r.aDone
        const myLatest = this.data.mySide === 'A' ? status.scoreA : status.scoreB
        const oppLatest = this.data.mySide === 'A' ? status.scoreB : status.scoreA
        this.setData({ match: status, myScore: myLatest, oppScore: oppLatest })
        if (oppDone) {
          clearInterval(tid)
          this.setData({ pollTimer: null })
          if (this.data.round === 1) {
            this.enterNextRound()
          } else {
            this.finishMatch()
          }
        }
      } catch (e) { /* ignore */ }
    }, POLL_INTERVAL)
    this.setData({ pollTimer: tid })
  },

  // 4. 进入第二轮（抢答）
  async enterNextRound() {
    try {
      const r = await request('POST', '/pk/next-round', { matchId: this.data.matchId })
      const picks = r.questions.map(() => null)
      this.setData({
        state: 'in-round',
        round: 2,
        questions: r.questions,
        curIdx: 0,
        picks,
        timeLeft: ROUND_TIME,
        submitting: false
      })
      this.startCountdown()
    } catch (err) {
      wx.showToast({ title: err.message || '进入下一轮失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  // 5. 结算
  async finishMatch() {
    try {
      const r = await request('POST', '/pk/finish', { matchId: this.data.matchId })
      const uid = app.globalData.userId || wx.getStorageSync('uid')
      const isWinner = r.winnerId === uid
      const isDraw = r.winnerId === null
      this.setData({
        state: 'finished',
        finalResult: {
          winnerId: r.winnerId,
          isWinner,
          isDraw,
          scoreA: r.scoreA,
          scoreB: r.scoreB,
          delta: r.winnerScoreDelta,
          myScore: this.data.myScore,
          oppScore: this.data.oppScore
        },
        submitting: false
      })
    } catch (err) {
      wx.showToast({ title: err.message || '结算失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  // 收尾
  clearTimers() {
    if (this.data.pollTimer) clearInterval(this.data.pollTimer)
    if (this.data.countdownTimer) clearInterval(this.data.countdownTimer)
  },

  backToLobby() {
    this.clearTimers()
    this.setData({
      state: 'lobby',
      matchId: '',
      match: null,
      round: 0,
      questions: [],
      picks: [],
      curIdx: 0,
      myScore: 0,
      oppScore: 0,
      timeLeft: ROUND_TIME,
      finalResult: null,
      pollTimer: null,
      countdownTimer: null
    })
    this.refreshLobby()
  }
})
