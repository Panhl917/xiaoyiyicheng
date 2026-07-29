// 会议详情页
const api = require('../../utils/api');

Page({
  data: {
    recordingId: '',
    recording: {
      title: '',
      transcript: '',
      summary: '',
      key_points: [],
      mindmap_data: null,
      knowledge_graph_data: null,
    },
    hasAudio: false,
    audioUrl: '',
    isPlaying: false,
    audioCurrent: 0,
    audioDuration: 0,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ recordingId: options.id });
      this.loadDetail();
    }
  },

  loadDetail() {
    wx.showLoading({ title: '加载中...' });
    api.getRecording(this.data.recordingId)
      .then((data) => {
        this.setData({ recording: data });
        wx.hideLoading();
        this.initAudio(data);
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
        console.error(err);
      });
  },

  initAudio(data) {
    if (!data.audio_file) {
      this.setData({ hasAudio: false });
      return;
    }
    const app = getApp();
    const base = app.globalData.apiBaseUrl || 'http://localhost:8000';
    const url = `${base}/api/recordings/${this.data.recordingId}/audio`;
    const ctx = this.audioCtx;
    if (ctx) {
      ctx.destroy();
    }
    const audio = wx.createInnerAudioContext();
    audio.src = url;
    audio.onPlay(() => this.setData({ isPlaying: true }));
    audio.onPause(() => this.setData({ isPlaying: false }));
    audio.onStop(() => this.setData({ isPlaying: false }));
    audio.onEnded(() => this.setData({ isPlaying: false, audioCurrent: 0 }));
    audio.onTimeUpdate(() => {
      this.setData({
        audioCurrent: Math.floor(audio.currentTime || 0),
        audioDuration: Math.floor(audio.duration || 0),
      });
    });
    audio.onError((e) => {
      console.error('音频播放失败', e);
      wx.showToast({ title: '音频播放失败', icon: 'none' });
    });
    this.audioCtx = audio;
    this.setData({ hasAudio: true, audioUrl: url, audioCurrent: 0, audioDuration: 0 });
  },

  togglePlay() {
    if (!this.audioCtx) return;
    if (this.data.isPlaying) {
      this.audioCtx.pause();
    } else {
      this.audioCtx.play();
    }
  },

  onUnload() {
    if (this.audioCtx) {
      this.audioCtx.destroy();
      this.audioCtx = null;
    }
  },


  // 编辑标题
  onTitleEdit(e) {
    this.setData({
      'recording.title': e.detail.value,
    });
  },

  // 编辑文稿
  onTranscriptEdit(e) {
    this.setData({
      'recording.transcript': e.detail.value,
    });
  },

  // 编辑摘要
  onSummaryEdit(e) {
    this.setData({
      'recording.summary': e.detail.value,
    });
  },

  // 编辑关键要点
  onKeyPointEdit(e) {
    const index = e.currentTarget.dataset.index;
    const key = `recording.key_points[${index}]`;
    this.setData({ [key]: e.detail.value });
  },

  // 复制标题
  copyTitle() {
    wx.setClipboardData({
      data: this.data.recording.title || '',
      success: () => wx.showToast({ title: '已复制主题', icon: 'success' }),
    });
  },

  // 复制文稿
  copyTranscript() {
    wx.setClipboardData({
      data: this.data.recording.transcript || '',
      success: () => wx.showToast({ title: '已复制文稿', icon: 'success' }),
    });
  },

  // 复制摘要
  copySummary() {
    wx.setClipboardData({
      data: this.data.recording.summary || '',
      success: () => wx.showToast({ title: '已复制摘要', icon: 'success' }),
    });
  },

  // 复制全部关键要点
  copyAllKeyPoints() {
    const list = this.data.recording.key_points || [];
    if (list.length === 0) {
      wx.showToast({ title: '没有要点', icon: 'none' });
      return;
    }
    const text = list.map((p, i) => `${i + 1}. ${p}`).join('\n');
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制全部要点', icon: 'success' }),
    });
  },

  // 保存修改
  saveChanges() {
    wx.showLoading({ title: '保存中...' });
    const { recordingId, recording } = this.data;
    api.updateRecording(recordingId, {
      title: recording.title,
      transcript: recording.transcript,
      summary: recording.summary,
      key_points: recording.key_points,
    })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '保存成功', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
  },

  // 语音转文字
  processTranscribe() {
    wx.showLoading({ title: '转写中...', mask: true });
    api.transcribe(this.data.recordingId)
      .then((data) => {
        wx.hideLoading();
        this.loadDetail();
        wx.showToast({ title: '转写完成', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: '转写失败', icon: 'none' });
      });
  },

  // 生成摘要
  processSummarize() {
    wx.showLoading({ title: '生成摘要中...', mask: true });
    api.summarize(this.data.recordingId)
      .then((data) => {
        wx.hideLoading();
        this.loadDetail();
        wx.showToast({ title: '摘要生成完成', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: '生成失败', icon: 'none' });
      });
  },

  // 思维导图
  processMindmap() {
    wx.showLoading({ title: '生成中...', mask: true });
    api.generateMindmap(this.data.recordingId)
      .then(() => {
        wx.hideLoading();
        wx.navigateTo({
          url: `/pages/mindmap/mindmap?id=${this.data.recordingId}`,
        });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: '生成失败', icon: 'none' });
      });
  },

  // 知识图谱
  processKnowledgeGraph() {
    wx.showLoading({ title: '生成中...', mask: true });
    api.generateKnowledgeGraph(this.data.recordingId)
      .then(() => {
        wx.hideLoading();
        wx.navigateTo({
          url: `/pages/knowledge/knowledge?id=${this.data.recordingId}`,
        });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: '生成失败', icon: 'none' });
      });
  },

  // 分享
  share() {
    wx.showShareMenu({
      withShareTicket: true,
    });
  },

  onPullDownRefresh() {
    this.loadDetail();
    wx.stopPullDownRefresh();
  },
});
