/**
 * 知识图谱画布组件 - 分类分区排列版
 */
Component({
  properties: {
    graphData: {
      type: Object,
      value: null,
      observer: 'onDataChange',
    },
  },

  data: {
    showNodeDialog: false,
    editLabel: '',
    editIsNew: false,
    editTypeIndex: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    scaleText: '100%',
    nodeTypes: ['person', 'topic', 'project', 'time', 'decision'],
    typeColors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F5A623', '#9B59B6'],
  },

  lifetimes: {
    created() {
      this.nodes = [];
      this.edges = [];
      this.ctx = null;
      this.isDragging = false;
      this.dragNodeId = null;
      this.lastTapTime = 0;
      this.lastDist = 0;
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.canvasWidth = 0;
      this.canvasHeight = 0;
      this._dpr = 1;
      this._pendingData = null;
      this._scale = 1;
      this._offsetX = 0;
      this._offsetY = 0;
      this._lastScaleText = '100%';
    },

    ready() {
      const query = this.createSelectorQuery();
      query.select('#graphCanvas')
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

          this._offsetX = this.canvasWidth / 2;
          this._offsetY = this.canvasHeight / 2;
          this.setData({ scaleText: '100%', scale: 1 });

          if (this._pendingData) {
            this.nodes = JSON.parse(JSON.stringify(this._pendingData.nodes));
            this.edges = JSON.parse(JSON.stringify(this._pendingData.edges || []));
            this._pendingData = null;
            this._classifyLayout();
            this.render();
          } else if (this.properties.graphData) {
            this.nodes = JSON.parse(JSON.stringify(this.properties.graphData.nodes));
            this.edges = JSON.parse(JSON.stringify(this.properties.graphData.edges || []));
            this._classifyLayout();
            this.render();
          }
        });
    },
  },

  methods: {
    onDataChange(newData) {
      if (!newData || !newData.nodes) return;

      if (!this.ctx) {
        this._pendingData = newData;
        this.nodes = JSON.parse(JSON.stringify(newData.nodes));
        this.edges = JSON.parse(JSON.stringify(newData.edges || []));
        return;
      }

      this.nodes = JSON.parse(JSON.stringify(newData.nodes));
      this.edges = JSON.parse(JSON.stringify(newData.edges || []));
      this._classifyLayout();
      this.render();
    },

    // ===== 分类分区布局 =====
    _classifyLayout() {
      const typeOrder = ['person', 'topic', 'project', 'time', 'decision'];
      const byType = {};
      typeOrder.forEach(t => byType[t] = []);
      this.nodes.forEach(n => {
        if (byType[n.type]) byType[n.type].push(n);
        else byType[n.type] = [n];
      });

      const cardW = 140, cardH = 56, gapX = 200, gapY = 80;
      const startX = -((typeOrder.length - 1) * gapX) / 2;
      const startY = -200;

      typeOrder.forEach((type, col) => {
        const arr = byType[type];
        if (!arr || arr.length === 0) return;
        const colX = startX + col * gapX;
        const totalH = (arr.length - 1) * gapY;
        const colStartY = -totalH / 2;
        arr.forEach((n, i) => {
          n.x = colX;
          n.y = colStartY + i * gapY;
        });
      });
    },

    // ===== 节点类型配置 =====
    _getNodeStyle(type) {
      const map = {
        person: { color: '#FF6B6B', icon: '👤', label: '人员' },
        topic:  { color: '#4ECDC4', icon: '📌', label: '主题' },
        project:{ color: '#45B7D1', icon: '📊', label: '项目' },
        time:   { color: '#F5A623', icon: '📅', label: '时间' },
        decision:{color: '#9B59B6', icon: '✅', label: '决策' },
      };
      return map[type] || { color: '#95A5A6', icon: '📌', label: '其他' };
    },

    // ===== 缩放 =====
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

    // ===== 渲染 =====
    render() {
      const ctx = this.ctx;
      if (!ctx) return;
      const scale = this._scale;
      const offsetX = this._offsetX;
      const offsetY = this._offsetY;
      const r = 30;

      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // 背景网格（仅绘制内容包围盒范围内，避免逐帧大量描边）
      if (this.nodes.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const n of this.nodes) {
          if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
          if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
        }
        const gx0 = Math.floor((minX - 80) / 40) * 40;
        const gx1 = Math.ceil((maxX + 80) / 40) * 40;
        const gy0 = Math.floor((minY - 80) / 40) * 40;
        const gy1 = Math.ceil((maxY + 80) / 40) * 40;
        ctx.strokeStyle = 'rgba(200,200,200,0.15)';
        ctx.lineWidth = 0.5;
        for (let gx = gx0; gx <= gx1; gx += 40) {
          ctx.beginPath(); ctx.moveTo(gx, gy0); ctx.lineTo(gx, gy1); ctx.stroke();
        }
        for (let gy = gy0; gy <= gy1; gy += 40) {
          ctx.beginPath(); ctx.moveTo(gx0, gy); ctx.lineTo(gx1, gy); ctx.stroke();
        }
      }

      // 绘制分类区域背景
      this._drawTypeZones(ctx);

      // 绘制边
      for (const edge of this.edges) {
        const s = this.nodes.find(n => n.id === edge.source);
        const t = this.nodes.find(n => n.id === edge.target);
        if (!s || !t) continue;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = 'rgba(120,120,120,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 箭头
        const angle = Math.atan2(t.y - s.y, t.x - s.x);
        const ax = t.x - (r + 5) * Math.cos(angle);
        const ay = t.y - (r + 5) * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 8 * Math.cos(angle - 0.4), ay - 8 * Math.sin(angle - 0.4));
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 8 * Math.cos(angle + 0.4), ay - 8 * Math.sin(angle + 0.4));
        ctx.strokeStyle = 'rgba(120,120,120,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 关系标签
        if (edge.label) {
          const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
          ctx.font = '11px "PingFang SC", sans-serif';
          const tw = ctx.measureText(edge.label).width;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          const bx = mx - tw / 2 - 6, by = my - 9;
          const bw = tw + 12, bh = 18, brr = 9;
          ctx.beginPath();
          ctx.moveTo(bx + brr, by);
          ctx.lineTo(bx + bw - brr, by);
          ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + brr);
          ctx.lineTo(bx + bw, by + bh - brr);
          ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - brr, by + bh);
          ctx.lineTo(bx + brr, by + bh);
          ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - brr);
          ctx.lineTo(bx, by + brr);
          ctx.quadraticCurveTo(bx, by, bx + brr, by);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(edge.label, mx, my);
        }
      }

      // 绘制节点
      for (const node of this.nodes) {
        const style = this._getNodeStyle(node.type);
        const x = node.x, y = node.y;

        // 外发光
        const grad = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.5);
        grad.addColorStop(0, style.color + '40');
        grad.addColorStop(1, style.color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.5, 0, 2 * Math.PI);
        ctx.fill();

        // 节点主体
        ctx.shadowColor = style.color + '40';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 3;

        const grad2 = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
        grad2.addColorStop(0, this._lighten(style.color, 30));
        grad2.addColorStop(1, style.color);
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // 图标
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(style.icon, x, y);

        // 标签
        ctx.fillStyle = style.color;
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const label = node.label || '';
        const lw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(x - lw / 2 - 6 + 6, y + r + 4);
        ctx.lineTo(x - lw / 2 - 6 + lw + 12 - 6, y + r + 4);
        ctx.quadraticCurveTo(x - lw / 2 - 6 + lw + 12, y + r + 4, x - lw / 2 - 6 + lw + 12, y + r + 4 + 6);
        ctx.lineTo(x - lw / 2 - 6 + lw + 12, y + r + 4 + 22 - 6);
        ctx.quadraticCurveTo(x - lw / 2 - 6 + lw + 12, y + r + 4 + 22, x - lw / 2 - 6 + lw + 12 - 6, y + r + 4 + 22);
        ctx.lineTo(x - lw / 2 - 6 + 6, y + r + 4 + 22);
        ctx.quadraticCurveTo(x - lw / 2 - 6, y + r + 4 + 22, x - lw / 2 - 6, y + r + 4 + 22 - 6);
        ctx.lineTo(x - lw / 2 - 6, y + r + 4 + 6);
        ctx.quadraticCurveTo(x - lw / 2 - 6, y + r + 4, x - lw / 2 - 6 + 6, y + r + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#444';
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(label, x, y + r + 7);
      }

      ctx.restore();
    },

    _drawTypeZones(ctx) {
      const typeOrder = ['person', 'topic', 'project', 'time', 'decision'];
      const typeLabels = { person: '人员', topic: '主题', project: '项目', time: '时间', decision: '决策' };
      const gapX = 200;
      const startX = -((typeOrder.length - 1) * gapX) / 2;

      typeOrder.forEach((type, col) => {
        const arr = this.nodes.filter(n => n.type === type);
        if (!arr || arr.length === 0) return;
        const style = this._getNodeStyle(type);
        const colX = startX + col * gapX;
        const minY = Math.min(...arr.map(n => n.y)) - 60;
        const maxY = Math.max(...arr.map(n => n.y)) + 60;
        const h = maxY - minY;

        ctx.fillStyle = style.color + '10';
        ctx.fillRect(colX - 90, minY, 180, h);
        ctx.strokeStyle = style.color + '30';
        ctx.lineWidth = 1;
        ctx.strokeRect(colX - 90, minY, 180, h);

        ctx.fillStyle = style.color + '80';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(typeLabels[type] + ' (' + arr.length + ')', colX, minY + 6);
      });
    },

    _lighten(hex, pct) {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.min(255, (num >> 16) + pct);
      const g = Math.min(255, ((num >> 8) & 0xFF) + pct);
      const b = Math.min(255, (num & 0xFF) + pct);
      return `rgb(${r},${g},${b})`;
    },

    // ===== 触摸交互 =====
    onTouchStart(e) {
      const t = e.touches;
      if (t.length === 2) { this.lastDist = this._getDist(t); return; }
      const touch = t[0];
      this.touchStartX = touch.x;
      this.touchStartY = touch.y;
      this.isDragging = false;
      this.lastTapTime = Date.now();

      const cx = (touch.x - this._offsetX) / this._scale;
      const cy = (touch.y - this._offsetY) / this._scale;
      this.dragNodeId = this._hitTest(cx, cy)?.id || null;
      this.dragFromNode = this.dragNodeId;
    },

    onTouchMove(e) {
      const t = e.touches;
      if (t.length === 2) {
        const d = this._getDist(t);
        if (this.lastDist > 0) {
          this._scale = Math.max(0.2, Math.min(3, this._scale * (d / this.lastDist)));
          this._updateScaleText(false);
          this.render();
        }
        this.lastDist = d;
        return;
      }
      if (t.length !== 1) return;
      const touch = t[0];
      const dx = touch.x - this.touchStartX;
      const dy = touch.y - this.touchStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.isDragging = true;
      if (!this.isDragging) return;

      if (this.dragNodeId) {
        const node = this.nodes.find(n => n.id === this.dragNodeId);
        if (node) { node.x += dx / this._scale; node.y += dy / this._scale; }
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
        this._dragMoved = true;
        this.isDragging = false;
        this.dragNodeId = null;
        this.dragFromNode = null;
        return;
      }

      const touch = e.changedTouches[0];
      const cx = (touch.x - this._offsetX) / this._scale;
      const cy = (touch.y - this._offsetY) / this._scale;
      const hit = this._hitTest(cx, cy);

      if (hit) {
        const now = Date.now();
        if (now - this.lastTapTime < 350) {
          this.showNodeEdit(hit);
        }
        this.lastTapTime = now;
      }
      this.dragNodeId = null;
      this.dragFromNode = null;
    },

    onLongPress(e) {
      const touch = e.touches[0];
      const cx = (touch.x - this._offsetX) / this._scale;
      const cy = (touch.y - this._offsetY) / this._scale;
      if (!this._hitTest(cx, cy)) {
        this.showNewNodeDialog(cx, cy);
      }
    },

    _getDist(t) {
      return Math.sqrt((t[0].x - t[1].x) ** 2 + (t[0].y - t[1].y) ** 2);
    },
    _hitTest(cx, cy) {
      const r = 30;
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        if ((cx - n.x) ** 2 + (cy - n.y) ** 2 <= r * r) return n;
      }
      return null;
    },

    // ===== 编辑 =====
    showNodeEdit(node) {
      this.setData({
        showNodeDialog: true,
        editLabel: node.label || '',
        editingNodeId: node.id,
        editIsNew: false,
      });
    },

    showNewNodeDialog(x, y) {
      this.setData({
        showNodeDialog: true,
        editLabel: '',
        editIsNew: true,
        editTypeIndex: 0,
        newNodeX: x,
        newNodeY: y,
      });
    },

    closeDialog() { this.setData({ showNodeDialog: false }); },
    stopPropagation() {},
    onLabelInput(e) { this.setData({ editLabel: e.detail.value }); },
    onTypeChange(e) { this.setData({ editTypeIndex: parseInt(e.detail.value) }); },

    confirmNodeEdit() {
      const { editLabel, editIsNew, editingNodeId, editTypeIndex, newNodeX, newNodeY } = this.data;
      if (editIsNew) {
        const type = this.data.nodeTypes[editTypeIndex] || 'topic';
        this.nodes.push({
          id: 'n_' + Date.now(),
          label: editLabel || '新节点',
          type,
          x: newNodeX || (Math.random() - 0.5) * 100,
          y: newNodeY || (Math.random() - 0.5) * 100,
        });
      } else {
        const node = this.nodes.find(n => n.id === editingNodeId);
        if (node) node.label = editLabel || node.label;
      }
      this.render();
      this.setData({ showNodeDialog: false });
      this._notifyChange();
    },

    deleteSelectedNode() {
      const { editingNodeId } = this.data;
      this.nodes = this.nodes.filter(n => n.id !== editingNodeId);
      this.edges = this.edges.filter(e => e.source !== editingNodeId && e.target !== editingNodeId);
      this.render();
      this.setData({ showNodeDialog: false });
      this._notifyChange();
    },

    addNewNode() {
      this.showNewNodeDialog((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200);
    },

    resetLayout() {
      this.nodes.forEach(n => { delete n.x; delete n.y; });
      this._classifyLayout();
      this.render();
      this._notifyChange();
    },

    _notifyChange() {
      this.triggerEvent('change', {
        data: {
          nodes: this.nodes.map(n => ({ id: n.id, label: n.label, type: n.type })),
          edges: this.edges,
        },
      });
    },
  },
});
