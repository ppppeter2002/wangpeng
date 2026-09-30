// 封装 wx.request -> 后端 API
// BASE 切换说明：
//   - 自有域名生产（当前）：  https://api.bbbpeter2025.top/api
//   - 开发期本机：          http://192.168.0.100:3000/api  （开发者工具 + 真机同网段）
//   - 临时公网：            https://xxxx.trycloudflare.com/api  （quick tunnel）
// 切换方式：在 app.js 启动时设置 app.globalData.baseUrl，或改下面默认值。
const app = getApp()
const BASE = (app && app.globalData && app.globalData.baseUrl) || 'https://api.bbbpeter2025.top/api'

module.exports = function request(method, path, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE + path,
      method: method,
      data: data || {},
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(new Error((res.data && res.data.error) || `HTTP ${res.statusCode}`))
        }
      },
      fail: reject
    })
  })
}
