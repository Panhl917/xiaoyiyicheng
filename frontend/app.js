const config = require('./config.js');

App({
  onLaunch() {
    // 检查后端配置（域名在 config.js 中设置）
    this.globalData = {
      apiBaseUrl: config.API_BASE_URL,
    };

    // 尝试连接后端
    this.checkConnection();
  },

  checkConnection() {
    const { apiBaseUrl } = this.globalData;
    wx.request({
      url: `${apiBaseUrl}/api/health`,
      method: 'GET',
      success: (res) => {
        console.log('[连接成功] 后端服务已连接:', res.data);
        this.globalData.connected = true;
      },
      fail: (err) => {
        console.warn('[连接失败]', err);
        this.globalData.connected = false;
        wx.showModal({
          title: '连接后端失败',
          content: '请确认：\n1. 后端已启动: cd D:\\meeting-mini-app\\backend && python main.py\n2. 项目设置→本地设置→勾选"不校验合法域名"',
          showCancel: false,
        });
      }
    });
  },

  // 全局请求方法
  request(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const { apiBaseUrl } = this.globalData;
      wx.request({
        url: `${apiBaseUrl}${url}`,
        method,
        data,
        header: method === 'POST' && !(data instanceof ArrayBuffer)
          ? { 'Content-Type': 'application/json' }
          : {},
        success: (res) => resolve(res.data),
        fail: (err) => reject(err),
      });
    });
  },
});
