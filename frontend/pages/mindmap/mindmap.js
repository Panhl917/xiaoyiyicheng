// 思维导图页
const api = require('../../utils/api');

Page({
  data: {
    recordingId: '',
    mindmapData: null,
    hasChanges: false,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ recordingId: options.id });
      this.loadMindmap();
    }
  },

  loadMindmap() {
    wx.showLoading({ title: '加载中...' });
    api.getRecording(this.data.recordingId)
      .then((data) => {
        if (data.mindmap_data) {
          this.setData({ mindmapData: data.mindmap_data });
        } else {
          // 还没有思维导图数据，生成
          return api.generateMindmap(this.data.recordingId);
        }
      })
      .then((data) => {
        if (data) {
          this.setData({ mindmapData: data });
        }
        wx.hideLoading();
      })
      .catch((err) => {
        wx.hideLoading();
        console.error(err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  onMindmapChange(e) {
    this.setData({
      mindmapData: e.detail.data,
      hasChanges: true,
    });
  },

  // 保存思维导图
  saveMindmap() {
    wx.showLoading({ title: '保存中...' });
    api.updateRecording(this.data.recordingId, {
      mindmap_data: this.data.mindmapData,
    })
      .then(() => {
        this.setData({ hasChanges: false });
        wx.hideLoading();
        wx.showToast({ title: '保存成功', icon: 'success' });
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
  },

  // 重新生成
  regenerate() {
    wx.showLoading({ title: '重新生成中...', mask: true });
    api.generateMindmap(this.data.recordingId)
      .then((data) => {
        this.setData({ mindmapData: data, hasChanges: false });
        wx.hideLoading();
        wx.showToast({ title: '生成完成', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: '生成失败', icon: 'none' });
      });
  },
});
