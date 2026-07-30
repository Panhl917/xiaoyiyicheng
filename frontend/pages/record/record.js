// 录音页
const api = require('../../utils/api');

Page({
  data: {
    title: '',
    recordMode: 'record', // record | upload
    isRecording: false,
    recordTime: 0,
    audioFile: null,
    audioFileName: '',
    processing: false,
    processStep: 0,
    processPercent: 0,
    canSubmit: false,
    recorderManager: null,
    tempFilePath: '',
    timer: null,
  },

  onLoad() {
    // 初始化录音管理器
    try {
      this.data.recorderManager = wx.getRecorderManager();
      const recorder = this.data.recorderManager;

      recorder.onStart(() => {
        console.log('录音开始');
      });

      recorder.onStop((res) => {
        console.log('录音结束', res);
        this.setData({
          isRecording: false,
          tempFilePath: res.tempFilePath,
          audioFileName: `录音_${this.formatDate(new Date())}.aac`,
          canSubmit: true,
        });
        clearInterval(this.data.timer);
      });

      recorder.onError((err) => {
        console.error('录音失败:', err);
        this.setData({ isRecording: false });
        wx.showToast({ title: '录音失败', icon: 'none' });
        clearInterval(this.data.timer);
      });
    } catch (e) {
      console.warn('录音管理器初始化失败:', e);
    }
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      recordMode: mode,
      canSubmit: false,
      audioFile: null,
      audioFileName: '',
      tempFilePath: '',
    });
    if (this.data.isRecording) {
      this.stopRecording();
    }
  },

  // 开始/停止录音
  toggleRecord() {
    if (this.data.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  },

  startRecording() {
    const recorder = this.data.recorderManager;
    if (!recorder) {
      wx.showToast({ title: '录音功能不可用', icon: 'none' });
      return;
    }

    // 请求权限
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.setData({
          isRecording: true,
          recordTime: 0,
          canSubmit: false,
        });

        // 计时器
        this.data.timer = setInterval(() => {
          this.setData({ recordTime: this.data.recordTime + 1 });
        }, 1000);

        recorder.start({
          duration: 600000, // 最多10分钟
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 24000,
          format: 'aac',
        });
      },
      fail: () => {
        wx.showModal({
          title: '需要录音权限',
          content: '请在设置中开启录音权限',
          showCancel: false,
        });
      },
    });
  },

  stopRecording() {
    const recorder = this.data.recorderManager;
    if (recorder) {
      recorder.stop();
    }
  },

  // 选择音频文件
  chooseAudio() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['mp3', 'wav', 'm4a', 'aac', 'ogg'],
      success: (res) => {
        const file = res.tempFiles[0];
        this.setData({
          audioFile: file,
          audioFileName: file.name,
          tempFilePath: file.path,
          canSubmit: true,
        });
      },
      fail: () => {
        // 也支持从相册选择媒体
        wx.chooseMedia({
          count: 1,
          mediaType: ['audio'],
          sourceType: ['album'],
          success: (res) => {
            const file = res.tempFiles[0];
            this.setData({
              audioFile: file,
              audioFileName: file.name || '音频文件',
              tempFilePath: file.tempFilePath,
              canSubmit: true,
            });
          },
        });
      },
    });
  },

  // 提交并处理
  submitAndProcess() {
    if (!this.data.canSubmit || !this.data.tempFilePath) {
      wx.showToast({ title: '请先录音或选择音频', icon: 'none' });
      return;
    }

    this.setData({ processing: true, processStep: 0, processPercent: 0 });

    this.updateProcess(1, 15, '创建记录...');

    // 1. 创建会议
    api.createRecording(this.data.title)
      .then((recording) => {
        const recId = recording.id;
        this.updateProcess(2, 35, '上传音频...');

        // 2. 上传音频（云存储 + 后端下载，支持大文件）
        return api.uploadAudio(recId, this.data.tempFilePath).then(() => recId);
      })
      .then((recId) => {
        this.updateProcess(3, 50, '识别文字中（长录音较慢）...');

        // 3. 语音转文字（异步，轮询状态）
        return api.transcribe(recId).then(() => recId);
      })
      .then((recId) => this.pollStatus(recId, 'transcribed', '识别文字'))
      .then((recId) => {
        this.updateProcess(4, 80, '生成摘要中...');

        // 4. 生成摘要（异步，轮询状态）
        return api.summarize(recId).then(() => recId);
      })
      .then((recId) => this.pollStatus(recId, 'summarized', '生成摘要'))
      .then((recId) => {
        this.updateProcess(4, 100, '处理完成！');

        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/detail/detail?id=${recId}`,
          });
        }, 800);
      })
      .catch((err) => {
        console.error('处理失败:', err);
        this.setData({ processing: false });
        wx.showToast({ title: err.message || '处理失败', icon: 'none' });
      });
  },

  // 轮询记录状态直到达到目标状态
  pollStatus(recId, targetStatus, label) {
    return new Promise((resolve, reject) => {
      const maxTries = 120; // 最多约 6 分钟（长录音可能更久）
      let tries = 0;
      const poll = () => {
        tries += 1;
        api.getRecording(recId)
          .then((rec) => {
            const status = rec.status;
            if (status === targetStatus) {
              resolve(recId);
            } else if (status === 'failed') {
              reject(new Error(`${label}失败：${rec.error || '未知错误'}`));
            } else if (tries >= maxTries) {
              reject(new Error(`${label}超时，请稍后在详情页重试`));
            } else {
              setTimeout(poll, 3000);
            }
          })
          .catch(reject);
      };
      poll();
    });
  },

  updateProcess(step, percent, text) {
    this.setData({ processStep: step, processPercent: percent });
  },

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}${m}${d}_${h}${min}`;
  },

  onUnload() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
    if (this.data.isRecording) {
      const recorder = this.data.recorderManager;
      if (recorder) recorder.stop();
    }
  },
});
