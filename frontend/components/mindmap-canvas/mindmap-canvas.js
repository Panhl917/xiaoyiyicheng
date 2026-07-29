/**
 * 思维导图画布组件 - 美化+缩放+可编辑
 * 特色：分支配色 / 平滑贝塞尔连线 / 渐变根节点发光 / 多行文字 / 柔和阴影
 */
const NODE_W = 196;   // 节点宽度
const H_GAP = 64;     // 层级水平间距
const V_GAP = 18;     // 同级垂直间距
const LINE_H = 20;    // 文字行高
const MIN_H = 50;     // 节点最小高度
const FONT_SIZE = 13;

// 分支色相（每个一级分支一种，后代继承）
const BRANCH_HUES = [212, 168, 28, 280, 0, 190, 150, 330];

// 根节点配色
const ROOT_COLORS = {
  fillTop: '#6A5CFF',
  fillBottom: '#3D7EFF',
  border: '#3D7EFF',
  accent: '#6A5CFF',
  text: '#FFFFFF',
  connector: 'rgba(106,92,255,0.45)',
};

Component({
  properties: {
    mindmapData: {
      type: Object,
      value: null,
      observer: 'onDataChange',
    },
  },

  data: {
    showEditDialog: false,
    showContextMenu: false,
    editNodeText: '',
    editingNodeId: '',
    editNodeIsNew: false,
    contextMenuX: 0,
    contextMenuY: 0,
    scale: 1,
    offsetX: 50,
    offsetY: 70,
    scaleText: '100%',
  },

  lifetimes: {
    ready() {
      this.nodes = [];
      this.ctx = null;
      this.isDragging = false;
      this.dragNodeId = null;
      this.lastTapTime = 0;
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.lastDist = 0;
      this.canvasWidth = 0;
      this.canvasHeight = 0;
      this._dpr = 1;
      this._nextY = 0;
      this._scale = 1;
      this._offsetX = 50;
      this._offsetY = 70;
      this._lastScaleText = '100%';

      const query = this.createSelectorQuery();
      query.select('#mindmapCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) return;
          const canvas = res[0].node;
          const dpr = wx.getSystemInfoSync().pixelRatio;
          this.canvasWidth = res[0].width;
          this.canvasHeight = res[0].height;
          this._dpr = dpr;

          canvas.width = this.canvasWidth * dpr;
          canvas.height = this.canvasHeight * dpr;
          this.ctx = canvas.getContext('2d');
          this.ctx.scale(dpr, dpr);

          this.setData({ scaleText: '100%', scale: 1 });

          if (this.properties.mindmapData) {
            this.onDataChange(this.properties.mindmapData);
          }
        });
    },
  },

  methods: {
    // ===== 缩放控制 =====
    zoomIn() {
      this._scale = Math.min(this._scale * 1.3, 3);
      this._updateScaleText(true);
      this.render();
    },
    zoomOut() {
      this._scale = Math.max(this._scale / 1.3, 0.2);
      this._updateScaleText(true);
      this.render();
    },

    _updateScaleText(force) {
      const txt = Math.round(this._scale * 100) + '%';
      const now = Date.now();
      if (!force && txt === this._lastScaleText && now - (this._lastScaleTs || 0) < 120) return;
      this._lastScaleText = txt;
      this._lastScaleTs = now;
      this.setData({ scaleText: txt });
    },

    // ===== 数据变化 =====
    onDataChange(newData) {
      if (newData) {
        this.buildLayout(newData);
        this.render();
      }
    },

    // ===== 布局（整洁树 + 动态高度 + 分支配色） =====
    buildLayout(root) {
      // 1. 保留手动拖拽位置
      const manual = {};
      this.nodes.forEach(n => {
        if (n._manual) manual[n.id] = { x: n._x, y: n._y };
      });

      // 2. 预处理文字/高度、分配分支颜色
      this._prepareText(root);
      this._assignBranchColors(root);

      // 3. 整洁树布局
      this.nodes = [];
      this._nextY = 0;
      this._layoutTree(root, 0);

      // 4. 扁平化
      this._flattenNodes(root);

      // 5. 恢复手动位置
      this.nodes.forEach(n => {
        if (manual[n.id]) {
          n._x = manual[n.id].x;
          n._y = manual[n.id].y;
          n._manual = true;
        }
      });
    },

    _prepareText(node) {
      const maxW = NODE_W - 32;
      node._lines = this._wrapText(node.text || '', maxW);
      node._h = Math.max(MIN_H, 16 + node._lines.length * LINE_H);
      if (node.children) node.children.forEach(c => this._prepareText(c));
    },

    _wrapText(text, maxW) {
      const ctx = this.ctx;
      if (!ctx) {
        // 兜底：按字符数估算（约每个中文 13px）
        const maxC = Math.max(1, Math.floor(maxW / FONT_SIZE));
        const lines = [];
        for (let i = 0; i < text.length; i += maxC) lines.push(text.substr(i, maxC));
        return lines.slice(0, 3);
      }
      const fs = FONT_SIZE;
      ctx.font = `600 ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`;
      const lines = [];
      let remaining = text;
      while (remaining.length && lines.length < 3) {
        let lo = 1, hi = remaining.length, best = 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (ctx.measureText(remaining.slice(0, mid)).width <= maxW) { best = mid; lo = mid + 1; }
          else hi = mid - 1;
        }
        if (best >= remaining.length) { lines.push(remaining); remaining = ''; }
        else { lines.push(remaining.slice(0, best)); remaining = remaining.slice(best); }
      }
      if (remaining.length && lines.length) lines[lines.length - 1] += '…';
      return lines.length ? lines : [''];
    },

    _assignBranchColors(root) {
      root._hue = 'root';
      if (root.children) {
        root.children.forEach((c, i) => this._setHue(c, BRANCH_HUES[i % BRANCH_HUES.length]));
      }
    },
    _setHue(node, hue) {
      node._hue = hue;
      if (node.children) node.children.forEach(c => this._setHue(c, hue));
    },

    _layoutTree(node, level) {
      node._level = level;
      node._w = NODE_W;
      node._x = level * (NODE_W + H_GAP);
      if (!node.children || node.children.length === 0) {
        node._y = this._nextY + node._h / 2;
        this._nextY += node._h + V_GAP;
      } else {
        node.children.forEach(c => this._layoutTree(c, level + 1));
        const first = node.children[0];
        const last = node.children[node.children.length - 1];
        node._y = (first._y + last._y) / 2;
      }
    },

    _flattenNodes(node) {
      this.nodes.push(node);
      if (node.children) node.children.forEach(c => this._flattenNodes(c));
    },

    // 由节点 hue 取得配色
    _getColors(node) {
      if (node._hue === 'root') return ROOT_COLORS;
      const h = node._hue;
      return {
        fill: `hsl(${h}, 78%, 96%)`,
        border: `hsl(${h}, 58%, 56%)`,
        accent: `hsl(${h}, 64%, 50%)`,
        text: '#27384D',
        connector: `hsla(${h}, 60%, 55%, 0.55)`,
      };
    },

    _roundRect(ctx, x, y, w, h, r) {
      const p = new Path2D();
      p.moveTo(x + r, y);
      p.lineTo(x + w - r, y);
      p.arcTo(x + w, y, x + w, y + r, r);
      p.lineTo(x + w, y + h - r);
      p.arcTo(x + w, y + h, x + w - r, y + h, r);
      p.lineTo(x + r, y + h);
      p.arcTo(x, y + h, x, y + h - r, r);
      p.lineTo(x, y + r);
      p.arcTo(x, y, x + r, y, r);
      p.closePath();
      return p;
    },

    // ===== 渲染 =====
    render() {
      const ctx = this.ctx;
      if (!ctx) return;
      const scale = this._scale;
      const offsetX = this._offsetX;
      const offsetY = this._offsetY;

      // 背景（屏幕空间）
      const bgGrad = ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
      bgGrad.addColorStop(0, '#F7F9FC');
      bgGrad.addColorStop(1, '#EAF0F7');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

      // 背景柔光装饰
      ctx.save();
      ctx.globalAlpha = 0.35;
      this._softBlob(ctx, this.canvasWidth * 0.18, this.canvasHeight * 0.2, 220, 'rgba(106,92,255,0.20)');
      this._softBlob(ctx, this.canvasWidth * 0.85, this.canvasHeight * 0.82, 260, 'rgba(61,126,255,0.16)');
      ctx.restore();

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // 1. 连线
      this.nodes.forEach(node => {
        if (!node.children) return;
        node.children.forEach(child => {
          const colors = this._getColors(child);
          const sx = node._x + node._w / 2, sy = node._y;
          const ex = child._x - child._w / 2, ey = child._y;
          const cx = (sx + ex) / 2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.bezierCurveTo(cx, sy, cx, ey, ex, ey);
          ctx.strokeStyle = colors.connector;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          // 末端连接点
          ctx.beginPath();
          ctx.arc(ex, ey, 3.2, 0, 2 * Math.PI);
          ctx.fillStyle = colors.accent;
          ctx.fill();
        });
      });

      // 2. 节点
      this.nodes.forEach(node => {
        const colors = this._getColors(node);
        const isRoot = node._hue === 'root';
        const w = node._w, h = node._h;
        const x = node._x - w / 2, y = node._y - h / 2;
        const r = 14;

        // 阴影 + 填充
        ctx.save();
        if (isRoot) {
          ctx.shadowColor = 'rgba(106,92,255,0.45)';
          ctx.shadowBlur = 24;
          ctx.shadowOffsetY = 8;
        } else {
          ctx.shadowColor = 'rgba(20,30,60,0.14)';
          ctx.shadowBlur = 14;
          ctx.shadowOffsetY = 4;
        }
        const path = this._roundRect(ctx, x, y, w, h, r);
        if (isRoot) {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          g.addColorStop(0, ROOT_COLORS.fillTop);
          g.addColorStop(1, ROOT_COLORS.fillBottom);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = colors.fill;
        }
        ctx.fill(path);
        ctx.restore();

        // 边框
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = isRoot ? 2.5 : 1.5;
        ctx.stroke(path);

        // 左侧色条（非根节点）
        if (!isRoot) {
          ctx.save();
          ctx.clip(path);
          ctx.fillStyle = colors.accent;
          ctx.fillRect(x, y, 6, h);
          ctx.restore();
        }

        // 文字（多行居中）
        ctx.fillStyle = colors.text;
        ctx.font = `${isRoot ? 'bold 15px' : '600 13px'} "PingFang SC","Microsoft YaHei",sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const startY = node._y - (node._lines.length - 1) * LINE_H / 2;
        const tx = node._x + (isRoot ? 0 : 3);
        node._lines.forEach((ln, i) => {
          ctx.fillText(ln, tx, startY + i * LINE_H);
        });

        // 子节点数量徽标
        if (node.children && node.children.length > 0) {
          const bx = x + w - 10, by = y + 10;
          ctx.beginPath();
          ctx.arc(bx, by, 10, 0, 2 * Math.PI);
          ctx.fillStyle = isRoot ? ROOT_COLORS.accent : colors.accent;
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.children.length + '', bx, by);
        }
      });

      // 3. 无数据提示
      if (this.nodes.length === 0) {
        ctx.fillStyle = '#9aa6b8';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('暂无数据，请点击"添加节点"创建', 0, 0);
      }

      ctx.restore();
    },

    _softBlob(ctx, cx, cy, r, color) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fill();
    },

    // ===== 触摸交互(含双指缩放) =====
    onTouchStart(e) {
      const touches = e.touches;
      if (touches.length === 2) {
        this.lastDist = this._getDist(touches);
        return;
      }
      const touch = touches[0];
      this.touchStartX = touch.x;
      this.touchStartY = touch.y;
      this.isDragging = false;
      this.lastTapTime = Date.now();

      const cx = (touch.x - this._offsetX) / this._scale;
      const cy = (touch.y - this._offsetY) / this._scale;
      this.dragNodeId = this._hitTest(cx, cy)?.id || null;
    },

    onTouchMove(e) {
      const touches = e.touches;
      if (touches.length === 2) {
        const dist = this._getDist(touches);
        if (this.lastDist > 0) {
          this._scale = Math.max(0.2, Math.min(3, this._scale * (dist / this.lastDist)));
          this._updateScaleText(false);
          this.render();
        }
        this.lastDist = dist;
        return;
      }
      if (touches.length !== 1) return;
      const touch = touches[0];
      const dx = touch.x - this.touchStartX;
      const dy = touch.y - this.touchStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.isDragging = true;
      if (!this.isDragging) return;

      if (this.dragNodeId) {
        const node = this.nodes.find(n => n.id === this.dragNodeId);
        if (node) {
          node._x += dx / this._scale;
          node._y += dy / this._scale;
        }
      } else {
        this._offsetX += dx;
        this._offsetY += dy;
      }
      this.touchStartX = touch.x;
      this.touchStartY = touch.y;
      this.render();
    },

    onTouchEnd(e) {
      if (this.isDragging) {
        if (this.dragNodeId) {
          const node = this.nodes.find(n => n.id === this.dragNodeId);
          if (node) node._manual = true;
        }
        this.isDragging = false;
        this.dragNodeId = null;
        this._notifyChange();
        return;
      }
      const touch = e.changedTouches[0];
      const cx = (touch.x - this._offsetX) / this._scale;
      const cy = (touch.y - this._offsetY) / this._scale;
      const hit = this._hitTest(cx, cy);
      if (hit) {
        this.showEditDialog(hit);
      }
    },

    _getDist(touches) {
      const dx = touches[0].x - touches[1].x;
      const dy = touches[0].y - touches[1].y;
      return Math.sqrt(dx * dx + dy * dy);
    },

    _hitTest(cx, cy) {
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        const w = n._w || NODE_W, h = n._h || MIN_H;
        if (cx >= n._x - w / 2 && cx <= n._x + w / 2 &&
            cy >= n._y - h / 2 && cy <= n._y + h / 2) return n;
      }
      return null;
    },

    // ===== 编辑功能 =====
    showEditDialog(node) {
      this.setData({
        showEditDialog: true,
        editNodeText: node.text || '',
        editingNodeId: node.id,
        editNodeIsNew: false,
      });
    },

    showNewChildDialog() {
      this.setData({
        showEditDialog: true,
        editNodeText: '',
        editingNodeId: 'root',
        editNodeIsNew: true,
      });
    },

    closeEditDialog() { this.setData({ showEditDialog: false }); },
    stopPropagation() {},

    onEditInput(e) { this.setData({ editNodeText: e.detail.value }); },

    confirmEdit() {
      const { editingNodeId, editNodeText } = this.data;
      if (editingNodeId === 'root' && this.data.editNodeIsNew) {
        const root = this.properties.mindmapData;
        if (!root) return;
        root.children.push({
          id: 'n_' + Date.now(),
          text: editNodeText || '新节点',
          children: [],
        });
      } else {
        const node = this.findNodeById(editingNodeId);
        if (node) node.text = editNodeText || '未命名';
      }
      this.buildLayout(this.properties.mindmapData);
      this.render();
      this.setData({ showEditDialog: false });
      this._notifyChange();
    },

    addRootChild() { this.showNewChildDialog(); },

    deleteNode() {
      const { editingNodeId } = this.data;
      if (editingNodeId === 'root') { wx.showToast({ title: '不能删除根节点', icon: 'none' }); return; }
      const root = this.properties.mindmapData;
      this._removeNodeById(root, editingNodeId);
      this.buildLayout(root);
      this.render();
      this.setData({ showEditDialog: false });
      this._notifyChange();
    },

    _removeNodeById(node, id) {
      if (!node.children) return false;
      const idx = node.children.findIndex(c => c.id === id);
      if (idx >= 0) { node.children.splice(idx, 1); return true; }
      return node.children.some(c => this._removeNodeById(c, id));
    },

    findNodeById(id) { return this.nodes.find(n => n.id === id) || null; },

    resetView() {
      this.nodes.forEach(n => { n._manual = false; });
      this._scale = 1;
      this._offsetX = 50;
      this._offsetY = 70;
      this._updateScaleText(true);
      if (this.properties.mindmapData) {
        this.buildLayout(this.properties.mindmapData);
      }
      this.render();
    },

    collapseAll() {
      if (this.properties.mindmapData) {
        this.buildLayout(this.properties.mindmapData);
        this.render();
      }
    },

    _notifyChange() {
      this.triggerEvent('change', { data: JSON.parse(JSON.stringify(this.properties.mindmapData)) });
    },
  },
});
