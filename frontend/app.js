const config = require('./config.js');
const api = require('./utils/api.js');

App({
  onLaunch() {
    // 初始化云托管调用环境（必须，否则 wx.cloud.callContainer 不可用）
    if (config.USE_CLOUD_CALL && typeof wx.cloud !== 'undefined') {
      wx.cloud.init();
    }

    this.globalData = {
      apiBaseUrl: config.API_BASE_URL,
    };

    // 尝试连接后端
    this.checkConnection();
  },

  checkConnection() {
    api.request('/api/health')
      .then((res) => {
        console.log('[连接成功] 后端服务已连接:', res);
        this.globalData.connected = true;
      })
      .catch((err) => {
        console.warn('[连接失败]', err);
        this.globalData.connected = false;
        wx.showModal({
          title: '连接后端失败',
          content: '请确认：\n1. 云托管服务已启动\n2. 本地调试时 USE_CLOUD_CALL 设为 false 且后端已启动',
          showCancel: false,
        });
      });
  },
});
