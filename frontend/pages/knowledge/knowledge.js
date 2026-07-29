// 知识图谱页
const api = require('../../utils/api');

Page({
  data: {
    recordingId: '',
    graphData: null,
    hasChanges: false,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ recordingId: options.id });
      this.loadGraph();
    }
  },

  loadGraph() {
    wx.showLoading({ title: '加载中...' });
    api.getRecording(this.data.recordingId)
      .then((data) => {
        if (data.knowledge_graph_data) {
          this.setData({ graphData: data.knowledge_graph_data });
        } else {
          return api.generateKnowledgeGraph(this.data.recordingId);
        }
      })
      .then((data) => {
        if (data) {
          this.setData({ graphData: data });
        }
        wx.hideLoading();
      })
      .catch((err) => {
        wx.hideLoading();
        console.error(err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  onGraphChange(e) {
    this.setData({
      graphData: e.detail.data,
      hasChanges: true,
    });
  },

  saveGraph() {
    wx.showLoading({ title: '保存中...' });
    api.updateRecording(this.data.recordingId, {
      knowledge_graph_data: this.data.graphData,
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

  regenerate() {
    wx.showLoading({ title: '重新生成中...', mask: true });
    api.generateKnowledgeGraph(this.data.recordingId)
      .then((data) => {
        this.setData({ graphData: data, hasChanges: false });
        wx.hideLoading();
        wx.showToast({ title: '生成完成', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: '生成失败', icon: 'none' });
      });
  },
});
