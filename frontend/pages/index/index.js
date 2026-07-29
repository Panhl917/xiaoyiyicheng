// 首页 - 会议列表
const api = require('../../utils/api');

Page({
  data: {
    recordings: [],
    loading: true,
    statusText: {
      'created': '未处理',
      'uploaded': '已上传',
      'transcribed': '已转文字',
      'summarized': '已总结',
    },
  },

  onShow() {
    this.loadRecordings();
  },

  // 加载会议列表
  loadRecordings() {
    this.setData({ loading: true });
    api.getRecordings()
      .then((data) => {
        this.setData({ recordings: data, loading: false });
      })
      .catch((err) => {
        console.error('加载失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  // 跳转到录音页
  goToRecord() {
    wx.navigateTo({ url: '/pages/record/record' });
  },

  // 跳转到详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // 删除会议
  deleteRecording(e) {
    const id = e.currentTarget.dataset.id;
    const recordings = this.data.recordings;
    const recording = recordings.find(r => r.id === id);
    const name = recording ? recording.title : '这个会议';

    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          api.deleteRecording(id)
            .then(() => {
              wx.showToast({ title: '已删除', icon: 'success' });
              this.loadRecordings();
            })
            .catch(() => {
              wx.showToast({ title: '删除失败', icon: 'none' });
            });
        }
      },
    });
  },

  // 格式化日期
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${min}`;
  },

  loadMore() {
    // 分页 - 简单实现
  },

  onPullDownRefresh() {
    this.loadRecordings();
    wx.stopPullDownRefresh();
  },
});
