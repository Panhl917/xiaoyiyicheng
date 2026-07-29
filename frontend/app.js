const config = require('./config.js');
const api = require('./utils/api.js');

App({
  onLaunch() {
    // 初始化云托管调用环境（必须，否则 wx.cloud.callContainer 不可用）
    if (config.USE_CLOUD_CALL && typeof wx.cloud !== 'undefined') {
      try {
        wx.cloud.init({ env: config.CLOUD_ENV });
        console.log('[云托管] wx.cloud.init 成功，env=', config.CLOUD_ENV);
      } catch (e) {
        console.error('[云托管] wx.cloud.init 失败:', e);
      }
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
        console.error('[连接失败] 详细错误:', err);
        this.globalData.connected = false;
        wx.showModal({
          title: '连接后端失败',
          content: `失败原因：${err.message || '未知错误'}\n\n请确认：\n1. 云托管服务已启动\n2. 本地调试时 USE_CLOUD_CALL 设为 false`,
          showCancel: false,
        });
      });
  },
});
