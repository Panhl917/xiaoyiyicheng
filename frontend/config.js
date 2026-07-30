// ============================================================
// 接口配置
// ============================================================
//
// 部署到微信云托管（CloudBase）时，小程序走 wx.cloud.callContainer，
// 无需在小程序后台配置服务器域名，也无需已备案域名。
//
// 本地调试后端时：
//   USE_CLOUD_CALL 改为 false
//   API_BASE_URL 改为 'http://192.168.110.176:8000' 或 'http://localhost:8000'
//   并在开发者工具勾选「不校验合法域名」
//
module.exports = {
  // true：走云托管内网调用（生产/真机推荐）；false：走普通 HTTP 请求（本地调试）
  USE_CLOUD_CALL: true,
  // 微信云托管环境 ID（在云托管控制台左上角复制）
  CLOUD_ENV: 'prod-d1gtuikq0e55a4f4e',
  // 微信云托管服务名称
  CLOUD_SERVICE: 'flask-ozmc',
  // 普通 HTTP 模式用的后端地址（本地调试 / 自定义域名时使用）
  API_BASE_URL: 'https://flask-ozmc-288882-10-1460163005.sh.run.tcloudbase.com'
};
