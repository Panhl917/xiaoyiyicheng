/**
 * API 请求工具
 * 封装了与后端的所有交互
 */

const getBaseUrl = () => {
  const app = getApp();
  return app.globalData.apiBaseUrl || 'http://localhost:8000';
};

// 通用请求
const request = (url, method = 'GET', data = null, isForm = false) => {
  return new Promise((resolve, reject) => {
    const header = {};
    if (method === 'POST' && !isForm) {
      header['Content-Type'] = 'application/json';
    }
    wx.request({
      url: `${getBaseUrl()}${url}`,
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
      fail: (err) => {
        reject(new Error('网络请求失败，请检查后端服务是否启动'));
      },
    });
  });
};

// 上传文件
const uploadFile = (url, filePath, formData = {}) => {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${getBaseUrl()}${url}`,
      filePath,
      name: 'file',
      formData,
      success: (res) => {
        try {
          resolve(JSON.parse(res.data));
        } catch {
          resolve(res.data);
        }
      },
      fail: (err) => reject(err),
    });
  });
};

// ===== 会议记录 API =====

// 获取会议列表
const getRecordings = () => request('/api/recordings');

// 创建会议
const createRecording = (title = '') => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getBaseUrl()}/api/recordings`,
      method: 'POST',
      header: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: { title },
      success: (res) => resolve(res.data),
      fail: reject,
    });
  });
};

// 获取会议详情
const getRecording = (id) => request(`/api/recordings/${id}`);

// 更新会议
const updateRecording = (id, data) => request(`/api/recordings/${id}`, 'PUT', data);

// 删除会议
const deleteRecording = (id) => request(`/api/recordings/${id}`, 'DELETE');

// 上传音频
const uploadAudio = (id, filePath) => uploadFile(`/api/recordings/${id}/upload`, filePath);

// 语音转文字
const transcribe = (id) => request(`/api/recordings/${id}/transcribe`, 'POST');

// 生成摘要
const summarize = (id) => request(`/api/recordings/${id}/summarize`, 'POST');

// 生成思维导图
const generateMindmap = (id) => request(`/api/recordings/${id}/mindmap`, 'POST');

// 生成知识图谱
const generateKnowledgeGraph = (id) => request(`/api/recordings/${id}/knowledge-graph`, 'POST');

module.exports = {
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
