/**
 * API 请求工具
 * 支持两种模式：
 * 1. 微信云托管内网调用 wx.cloud.callContainer（生产/真机，无需域名备案）
 * 2. 普通 wx.request HTTP 请求（本地调试）
 */

const config = require('../config.js');

const useCloudCall = () => {
  if (typeof wx.cloud === 'undefined') return false;
  return !!config.USE_CLOUD_CALL;
};

/**
 * 通用请求
 * @param {string} path 接口路径，如 /api/recordings
 * @param {string} method HTTP 方法
 * @param {object|ArrayBuffer|string} data 请求体
 * @param {object} options 额外选项 { header, dataType }
 */
const request = (path, method = 'GET', data = null, options = {}) => {
  return new Promise((resolve, reject) => {
    const header = options.header || {};

    if (useCloudCall()) {
      wx.cloud.callContainer({
        config: { env: config.CLOUD_ENV },
        path,
        method,
        data,
        header: {
          'X-WX-SERVICE': config.CLOUD_SERVICE,
          ...header,
        },
        dataType: options.dataType || 'json',
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject(new Error((res.data && res.data.detail) || `请求失败: ${res.statusCode}`));
          }
        },
        fail: (err) => reject(new Error(err.errMsg || '云托管调用失败')),
      });
    } else {
      // 本地调试 / 自定义域名模式
      if (method === 'POST' && data && !(data instanceof ArrayBuffer)) {
        header['Content-Type'] = header['Content-Type'] || 'application/json';
      }
      wx.request({
        url: `${config.API_BASE_URL}${path}`,
        method,
        data,
        header,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.detail || `请求失败: ${res.statusCode}`));
          }
        },
        fail: (err) => reject(new Error('网络请求失败')),
      });
    }
  });
};

/**
 * 上传音频文件
 * 先上传到微信云存储，再把临时下载 URL 传给后端，避免 callContainer 100KB 请求体限制
 */
const uploadAudio = (id, filePath) => {
  return new Promise((resolve, reject) => {
    const extMatch = filePath.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.aac';
    const cloudPath = `recordings/${id}${ext}`;

    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (uploadRes) => {
        const fileID = uploadRes.fileID;
        wx.cloud.getTempFileURL({
          fileList: [fileID],
          success: (urlRes) => {
            const tempFileURL = urlRes.fileList[0].tempFileURL;
            request(`/api/recordings/${id}/upload-url`, 'POST', { url: tempFileURL, ext })
              .then(resolve)
              .catch(reject);
          },
          fail: (err) => reject(new Error('获取音频下载链接失败: ' + err.errMsg)),
        });
      },
      fail: (err) => reject(new Error('上传音频到云存储失败: ' + err.errMsg)),
    });
  });
};

// ===== 会议记录 API =====

const getRecordings = () => request('/api/recordings');

const createRecording = (title = '') => request('/api/recordings', 'POST', { title });

const getRecording = (id) => request(`/api/recordings/${id}`);

const updateRecording = (id, data) => request(`/api/recordings/${id}`, 'PUT', data);

const deleteRecording = (id) => request(`/api/recordings/${id}`, 'DELETE');

const transcribe = (id) => request(`/api/recordings/${id}/transcribe`, 'POST');

const summarize = (id) => request(`/api/recordings/${id}/summarize`, 'POST');

const generateMindmap = (id) => request(`/api/recordings/${id}/mindmap`, 'POST');

const generateKnowledgeGraph = (id) => request(`/api/recordings/${id}/knowledge-graph`, 'POST');

module.exports = {
  request,
  getRecordings,
  createRecording,
  getRecording,
  updateRecording,
  deleteRecording,
  uploadAudio,
  transcribe,
  summarize,
  generateMindmap,
  generateKnowledgeGraph,
};
