import { state, emit } from '../store.js';
import { toast } from '../utils/toast.js';
import { searchByNL } from '../utils/ai.js';

let activeDrawing = null;
let addPinMode = false;
let activePinPopup = null;
let nextPinId = 100;

export function renderDrawings(container) {
  const drawings = state.drawings.filter(d => d.projectId === state.currentProject);

  container.innerHTML = `
    <div class="search-bar">
      <input class="search-input" id="nl-search" placeholder="🔍 「電気図面 3階」など自然言語で検索...">
      <button class="btn btn-primary btn-sm" id="nl-search-btn">AI検索</button>
      <button class="btn btn-secondary btn-sm" id="upload-drawing-btn">+ 図面追加</button>
    </div>
    <div class="drawing-layout">
      <div style="width:200px;flex-shrink:0;border-right:1px solid var(--border);background:var(--bg);display:flex;flex-direction:column;overflow:hidden">
        <div class="sidebar-header"><div class="sidebar-header-title">図面一覧</div></div>
        <div style="flex:1;overflow-y:auto" id="drawing-list">
          ${drawings.map(d=>`
          <div class="pin-list-item drawing-list-item" data-id="${d.id}">
            <div>
              <div class="pin-list-label">${d.name}</div>
              <div class="pin-list-sub">${d.type} · ${d.rev} · ピン ${d.pinCount}件</div>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <div class="drawing-canvas-area" id="drawing-canvas-area">
        <div id="drawing-placeholder" style="text-align:center;color:var(--text3)">
          <div style="font-size:40px;margin-bottom:12px">📐</div>
          <div style="font-size:14px;font-weight:500;color:var(--text2)">図面を選択してください</div>
          <div style="font-size:12px;margin-top:6px">左のリストから図面を選ぶか、PDFをアップロード</div>
        </div>
        <canvas id="pdf-canvas" style="display:none;max-width:100%;max-height:100%"></canvas>
        <div class="drawing-toolbar" style="display:none" id="drawing-toolbar">
          <button class="drawing-toolbar-btn" id="tool-select" title="選択">↖</button>
          <button class="drawing-toolbar-btn" id="tool-pin" title="ピン追加">📍</button>
          <button class="drawing-toolbar-btn" id="tool-pen" title="手書き">✏️</button>
          <button class="drawing-toolbar-btn" id="tool-zoom-in" title="拡大">＋</button>
          <button class="drawing-toolbar-btn" id="tool-zoom-out" title="縮小">－</button>
        </div>
        <div class="pin-overlay" id="pin-overlay"></div>
      </div>

      <div class="drawing-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-header-title">指摘リスト</div>
          <button class="btn btn-primary btn-sm" style="margin-left:auto;padding:3px 8px;font-size:11px" id="add-pin-btn">＋追加</button>
        </div>
        <div class="pin-list" id="pin-list">
          <div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">図面を選択すると<br>指摘リストが表示されます</div>
        </div>
      </div>
    </div>

    <div id="pin-modal" class="modal-backdrop">
      <div class="modal">
        <div class="modal-title" id="pin-modal-title">指摘を追加</div>
        <div class="form-group">
          <label class="form-label">指摘内容</label>
          <input class="form-input" id="pin-label-input" placeholder="例：ひび割れ、漏水痕など">
        </div>
        <div class="form-group">
          <label class="form-label">重要度</label>
          <select class="form-select" id="pin-severity-input">
            <option value="danger">🔴 緊急（要即時対応）</option>
            <option value="warn">🟡 注意（要経過観察）</option>
            <option value="ok">🟢 軽微（記録のみ）</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">詳細メモ</label>
          <textarea class="form-textarea" id="pin-memo-input" placeholder="場所・状況・寸法など"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">担当者</label>
          <input class="form-input" id="pin-assignee-input" placeholder="担当者名">
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="pin-modal-cancel">キャンセル</button>
          <button class="btn btn-primary" id="pin-modal-save">保存</button>
        </div>
      </div>
    </div>
  `;

  let pendingPinPos = null;

  // Drawing list click
  container.querySelectorAll('.drawing-list-item').forEach(el => {
    el.onclick = () => {
      container.querySelectorAll('.drawing-list-item').forEach(x => x.style.background = '');
      el.style.background = 'var(--c-primary-light)';
      const drawing = state.drawings.find(d => d.id === el.dataset.id);
      loadDrawing(drawing, container);
    };
  });

  // Add pin button
  container.querySelector('#add-pin-btn').onclick = () => {
    if (!activeDrawing) { toast('先に図面を選択してください', 'warning'); return; }
    addPinMode = true;
    container.querySelector('#tool-pin').classList.add('active');
    toast('図面上をタップしてピンを配置', 'default');
  };

  // Pin overlay click
  container.querySelector('#pin-overlay').onclick = (e) => {
    if (!addPinMode || !activeDrawing) return;
    const area = container.querySelector('#drawing-canvas-area');
    const rect = area.getBoundingClientRect();
    pendingPinPos = {
      x: ((e.clientX - rect.left) / rect.width * 100).toFixed(1),
      y: ((e.clientY - rect.top) / rect.height * 100).toFixed(1),
    };
    addPinMode = false;
    container.querySelector('#tool-pin').classList.remove('active');
    container.querySelector('#pin-modal').classList.add('open');
    container.querySelector('#pin-label-input').focus();
  };

  // Pin modal save
  container.querySelector('#pin-modal-save').onclick = () => {
    const label = container.querySelector('#pin-label-input').value.trim();
    if (!label) { toast('指摘内容を入力してください', 'warning'); return; }
    const newPin = {
      id: `p${nextPinId++}`,
      drawingId: activeDrawing.id,
      x: parseFloat(pendingPinPos?.x || 50),
      y: parseFloat(pendingPinPos?.y || 50),
      label,
      severity: container.querySelector('#pin-severity-input').value,
      memo: container.querySelector('#pin-memo-input').value,
      assignee: container.querySelector('#pin-assignee-input').value || '未定',
      status: 'open', photoCount: 0,
      date: new Date().toISOString().slice(0, 10),
    };
    state.pins.push(newPin);
    activeDrawing.pinCount = (activeDrawing.pinCount || 0) + 1;
    container.querySelector('#pin-modal').classList.remove('open');
    container.querySelector('#pin-label-input').value = '';
    container.querySelector('#pin-memo-input').value = '';
    container.querySelector('#pin-assignee-input').value = '';
    renderPins(activeDrawing, container);
    renderPinList(activeDrawing, container);
    toast('ピンを追加しました', 'success');
  };

  container.querySelector('#pin-modal-cancel').onclick = () => {
    container.querySelector('#pin-modal').classList.remove('open');
  };

  // Tool buttons
  container.querySelector('#tool-pin').onclick = () => {
    if (!activeDrawing) { toast('先に図面を選択してください', 'warning'); return; }
    addPinMode = !addPinMode;
    container.querySelector('#tool-pin').classList.toggle('active', addPinMode);
    if (addPinMode) toast('図面上をタップしてピンを配置', 'default');
  };

  // Zoom
  let scale = 1;
  container.querySelector('#tool-zoom-in').onclick = () => {
    scale = Math.min(scale * 1.3, 4);
    const c = container.querySelector('#pdf-canvas');
    c.style.transform = `scale(${scale})`;
    c.style.transformOrigin = 'center center';
  };
  container.querySelector('#tool-zoom-out').onclick = () => {
    scale = Math.max(scale / 1.3, 0.5);
    const c = container.querySelector('#pdf-canvas');
    c.style.transform = `scale(${scale})`;
    c.style.transformOrigin = 'center center';
  };

  // AI Search
  container.querySelector('#nl-search-btn').onclick = async () => {
    const query = container.querySelector('#nl-search').value.trim();
    if (!query) return;
    const btn = container.querySelector('#nl-search-btn');
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;
    try {
      const drawings = state.drawings.filter(d => d.projectId === state.currentProject);
      const result = await searchByNL(query, drawings);
      const matched = drawings.filter(d => result.matches.some(m => d.name.includes(m) || m.includes(d.name)));
      if (matched.length > 0) {
        container.querySelectorAll('.drawing-list-item').forEach(x => x.style.background = '');
        const first = matched[0];
        const el = container.querySelector(`[data-id="${first.id}"]`);
        if (el) { el.style.background = 'var(--c-primary-light)'; loadDrawing(first, container); }
        toast(`「${result.explanation}」— ${matched.length}件マッチ`, 'success');
      } else {
        toast('該当する図面が見つかりません', 'warning');
      }
    } catch(e) {
      // fallback: keyword search
      const q = query.toLowerCase();
      const drawings = state.drawings.filter(d => d.projectId === state.currentProject);
      const matched = drawings.filter(d => d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q));
      if (matched.length > 0) {
        const el = container.querySelector(`[data-id="${matched[0].id}"]`);
        if (el) { el.style.background = 'var(--c-primary-light)'; loadDrawing(matched[0], container); }
        toast(`「${query}」でキーワード検索: ${matched.length}件`, 'default');
      }
    }
    btn.innerHTML = 'AI検索';
    btn.disabled = false;
  };

  // Upload drawing
  container.querySelector('#upload-drawing-btn').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const newDrawing = {
        id: `d${Date.now()}`, name: file.name.replace(/\.[^.]+$/, ''),
        type: '建築', rev: 'Rev.1', projectId: state.currentProject,
        pinCount: 0, date: new Date().toISOString().slice(0,10),
        file
      };
      state.drawings.push(newDrawing);
      toast(`「${newDrawing.name}」を追加しました`, 'success');
      renderDrawings(container);
      // Auto-load
      setTimeout(() => {
        const el = container.querySelector(`[data-id="${newDrawing.id}"]`);
        if (el) { el.click(); }
      }, 100);
    };
    input.click();
  };
}

function loadDrawing(drawing, container) {
  activeDrawing = drawing;
  const placeholder = container.querySelector('#drawing-placeholder');
  const canvas = container.querySelector('#pdf-canvas');
  const toolbar = container.querySelector('#drawing-toolbar');

  placeholder.style.display = 'none';
  canvas.style.display = 'block';
  toolbar.style.display = 'flex';

  // Draw placeholder floor plan on canvas
  drawFloorPlan(canvas, drawing.name);
  renderPins(drawing, container);
  renderPinList(drawing, container);
}

function drawFloorPlan(canvas, name) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = '#f0ece4';
  ctx.fillRect(0, 0, w, h);

  const pad = 60;
  const fw = w - pad * 2;
  const fh = h - pad * 2;

  // Outer wall
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#e8e2d8';
  ctx.beginPath();
  ctx.rect(pad, pad, fw, fh);
  ctx.fill();
  ctx.stroke();

  // Inner walls
  ctx.strokeStyle = '#777';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad + fw * 0.5, pad);
  ctx.lineTo(pad + fw * 0.5, pad + fh * 0.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pad, pad + fh * 0.55);
  ctx.lineTo(pad + fw * 0.45, pad + fh * 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pad + fw * 0.55, pad + fh * 0.55);
  ctx.lineTo(pad + fw, pad + fh * 0.55);
  ctx.stroke();

  // Windows
  ctx.strokeStyle = '#7ab5cc';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(pad + fw * 0.15, pad);
  ctx.lineTo(pad + fw * 0.35, pad);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pad + fw * 0.65, pad);
  ctx.lineTo(pad + fw * 0.85, pad);
  ctx.stroke();

  // Room labels
  ctx.fillStyle = '#666';
  ctx.font = '13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('事務室', pad + fw * 0.25, pad + fh * 0.28);
  ctx.fillText('会議室', pad + fw * 0.75, pad + fh * 0.28);
  ctx.fillText('作業エリア', pad + fw * 0.25, pad + fh * 0.78);
  ctx.fillText('倉庫', pad + fw * 0.75, pad + fh * 0.78);

  // Drawing name
  ctx.fillStyle = '#999';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(name, pad + 6, pad + fh - 8);

  // North arrow
  ctx.fillStyle = '#aaa';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N ↑', pad + 6, pad + 18);
}

function renderPins(drawing, container) {
  const overlay = container.querySelector('#pin-overlay');
  const pins = state.pins.filter(p => p.drawingId === drawing.id);
  overlay.innerHTML = '';

  pins.forEach((pin, idx) => {
    const marker = document.createElement('div');
    marker.className = `pin-marker ${pin.severity}`;
    marker.style.left = pin.x + '%';
    marker.style.top = pin.y + '%';
    marker.textContent = idx + 1;
    marker.onclick = (e) => {
      e.stopPropagation();
      showPinPopup(pin, idx + 1, e, container);
    };
    overlay.appendChild(marker);
  });
}

function showPinPopup(pin, num, e, container) {
  if (activePinPopup) activePinPopup.remove();
  const popup = document.createElement('div');
  popup.className = 'pin-popup';

  const area = container.querySelector('#drawing-canvas-area');
  const rect = area.getBoundingClientRect();
  let left = e.clientX - rect.left + 14;
  let top = e.clientY - rect.top - 20;
  if (left + 230 > rect.width) left = e.clientX - rect.left - 234;
  if (top + 160 > rect.height) top = rect.height - 170;

  popup.style.left = left + 'px';
  popup.style.top = top + 'px';

  const sevLabel = { danger: '🔴 緊急', warn: '🟡 注意', ok: '🟢 軽微', pending: '🔵 確認中' };
  const statusLabel = { open: '未対応', in_progress: '対応中', closed: '完了' };

  popup.innerHTML = `
    <button class="pin-popup-close" id="popup-close">×</button>
    <div style="margin-bottom:6px"><span class="badge ${pin.severity==='danger'?'badge-danger':pin.severity==='warn'?'badge-warn':'badge-ok'}">${sevLabel[pin.severity]||pin.severity}</span></div>
    <div class="pin-popup-title">#${num} ${pin.label}</div>
    <div class="pin-popup-body">
      ${pin.memo}<br>
      <span style="color:var(--text3)">担当: ${pin.assignee} · 状態: ${statusLabel[pin.status]||pin.status}</span><br>
      <span style="color:var(--text3)">写真: ${pin.photoCount}枚 · ${pin.date}</span>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <button class="btn btn-secondary btn-sm" style="flex:1;font-size:11px" onclick="this.closest('.pin-popup').querySelector('#popup-close').click()">閉じる</button>
      <button class="btn btn-primary btn-sm" style="flex:1;font-size:11px" id="pin-status-btn">完了にする</button>
    </div>
  `;

  popup.querySelector('#popup-close').onclick = () => { popup.remove(); activePinPopup = null; };
  popup.querySelector('#pin-status-btn').onclick = () => {
    pin.status = pin.status === 'closed' ? 'open' : 'closed';
    toast(pin.status === 'closed' ? '指摘を完了にしました' : '指摘を未対応に戻しました', 'success');
    popup.remove();
    activePinPopup = null;
    renderPins(activeDrawing, container);
    renderPinList(activeDrawing, container);
  };

  container.querySelector('#pin-overlay').appendChild(popup);
  activePinPopup = popup;
}

function renderPinList(drawing, container) {
  const list = container.querySelector('#pin-list');
  const pins = state.pins.filter(p => p.drawingId === drawing.id);
  if (pins.length === 0) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">指摘事項なし</div>';
    return;
  }
  const colors = { danger: 'var(--c-danger)', warn: 'var(--c-warn)', ok: 'var(--c-ok)', pending: 'var(--c-purple)' };
  list.innerHTML = pins.map((p, i) => `
    <div class="pin-list-item" data-pin-id="${p.id}">
      <div class="pin-dot" style="background:${colors[p.severity]}"></div>
      <div style="flex:1;min-width:0">
        <div class="pin-list-label">#${i+1} ${p.label}</div>
        <div class="pin-list-sub">${p.memo.slice(0,30)}${p.memo.length>30?'…':''}</div>
        <div class="pin-list-sub">${p.assignee} · ${p.status==='closed'?'✅完了':'⏳未対応'}</div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.pin-list-item').forEach(el => {
    el.onclick = () => {
      const pin = state.pins.find(p => p.id === el.dataset.pinId);
      const marker = container.querySelector('.pin-overlay').children;
      const idx = state.pins.filter(p => p.drawingId === drawing.id).indexOf(pin);
      if (marker[idx]) marker[idx].click();
    };
  });
}
