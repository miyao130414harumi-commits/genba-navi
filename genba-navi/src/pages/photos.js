import { state } from '../store.js';
import { analyzePhoto } from '../utils/ai.js';
import { toast } from '../utils/toast.js';

export function renderPhotos(container) {
  const photos = state.photos;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">写真管理</div>
      <div class="page-subtitle">${photos.length}枚</div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" id="upload-photo-btn">📷 写真を追加・AI解析</button>
      </div>
    </div>

    <div style="display:flex;flex:1;overflow:hidden">
      <div style="flex:1;overflow-y:auto">
        <div style="padding:16px;display:flex;flex-direction:column;gap:16px">
          <div id="upload-area-wrap">
            <div class="drop-zone" id="drop-zone">
              <div class="drop-zone-icon">📷</div>
              <div class="drop-zone-label">写真をアップロード</div>
              <div class="drop-zone-sub">タップまたはドラッグ&ドロップ · AIが自動解析します</div>
            </div>
          </div>

          <div class="photo-grid" id="photo-grid" style="padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
            ${photos.map(ph => photoCard(ph)).join('')}
            ${photos.length === 0 ? '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:40px;font-size:13px">写真がまだありません</div>' : ''}
          </div>
        </div>
      </div>

      <div class="ai-panel">
        <div class="ai-panel-header">
          <span style="font-size:16px">🤖</span>
          <div class="ai-panel-title">AI解析パネル</div>
        </div>
        <div class="ai-panel-body" id="ai-panel-body">
          <div class="ai-message ai">写真をアップロードすると、AIが自動で解析します。不具合の種類・重要度・推奨対応を提示します。</div>
        </div>
      </div>
    </div>

    <input type="file" id="photo-file-input" accept="image/*" multiple style="display:none">
  `;

  const input = container.querySelector('#photo-file-input');
  const dropZone = container.querySelector('#drop-zone');

  container.querySelector('#upload-photo-btn').onclick = () => input.click();
  dropZone.onclick = () => input.click();

  dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('drag'); };
  dropZone.ondragleave = () => dropZone.classList.remove('drag');
  dropZone.ondrop = e => {
    e.preventDefault();
    dropZone.classList.remove('drag');
    handleFiles([...e.dataTransfer.files], container);
  };
  input.onchange = e => handleFiles([...e.target.files], container);
}

function photoCard(ph) {
  const sevColor = { high: 'var(--c-danger)', mid: 'var(--c-warn)', low: 'var(--c-ok)' };
  const sev = ph.aiAnalysis?.severity;
  return `
    <div class="photo-item" data-photo-id="${ph.id}" style="aspect-ratio:4/3;border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);cursor:pointer;position:relative;background:var(--bg2)">
      ${ph._objectUrl ? `<img src="${ph._objectUrl}" style="width:100%;height:100%;object-fit:cover">` :
        `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px">
          <span style="font-size:28px">🖼</span>
          <span style="font-size:11px;color:var(--text3)">${ph.label}</span>
        </div>`}
      ${sev?`<span class="badge photo-item-badge" style="background:${sevColor[sev]};color:#fff;font-size:9px">${sev==='high'?'重大':sev==='mid'?'注意':'軽微'}</span>`:''}
      <div style="position:absolute;bottom:0;left:0;right:0;padding:4px 6px;background:linear-gradient(transparent,rgba(0,0,0,0.55));color:#fff;font-size:10px">${ph.label}</div>
    </div>
  `;
}

async function handleFiles(files, container) {
  const aiBody = container.querySelector('#ai-panel-body');
  const grid = container.querySelector('#photo-grid');

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;

    // Create object URL for preview
    const url = URL.createObjectURL(file);
    const ph = {
      id: `ph${Date.now()}${Math.random()}`,
      drawingId: state.drawings[0]?.id,
      pinId: null, url: null, _objectUrl: url,
      date: new Date().toISOString().slice(0, 10),
      label: file.name.replace(/\.[^.]+$/, ''),
      aiAnalysis: null,
    };
    state.photos.push(ph);

    // Show in grid immediately
    const div = document.createElement('div');
    div.innerHTML = photoCard(ph);
    const card = div.firstElementChild;
    grid.insertBefore(card, grid.firstChild);

    // AI analysis
    const msgEl = document.createElement('div');
    msgEl.className = 'ai-message user';
    msgEl.textContent = `「${ph.label}」を解析中...`;
    aiBody.appendChild(msgEl);

    const loadEl = document.createElement('div');
    loadEl.className = 'ai-message ai';
    loadEl.innerHTML = '<span class="spinner dark"></span> AIが解析しています...';
    aiBody.appendChild(loadEl);
    aiBody.scrollTop = aiBody.scrollHeight;

    try {
      // Convert to base64
      const b64 = await fileToBase64(file);
      const result = await analyzePhoto(b64);
      ph.aiAnalysis = result;

      const sevColor = { high: 'var(--c-danger)', mid: 'var(--c-warn)', low: 'var(--c-ok)' };
      const sevLabel = { high: '重大', mid: '注意', low: '軽微' };
      loadEl.innerHTML = `
        <div style="margin-bottom:6px">
          <span class="badge" style="background:${sevColor[result.severity]||'#888'};color:#fff">${sevLabel[result.severity]||result.severity}</span>
          <span style="font-size:12px;font-weight:600;margin-left:6px">${result.category}</span>
        </div>
        <div style="font-size:12px;line-height:1.7">
          ${result.findings.map(f=>`・${f}`).join('<br>')}
        </div>
        <div style="margin-top:6px;font-size:11px;color:#534ab7;font-weight:500">→ ${result.recommend}</div>
      `;

      // Update card
      const updatedDiv = document.createElement('div');
      updatedDiv.innerHTML = photoCard(ph);
      card.replaceWith(updatedDiv.firstElementChild);
      toast('AI解析完了', 'success');
    } catch(e) {
      ph.aiAnalysis = { severity: 'mid', findings: ['解析完了（デモモード）'], category: '確認中', recommend: 'APIキー設定後に再解析', summary: 'デモ結果' };
      loadEl.innerHTML = `<div style="font-size:12px">解析完了（AI接続なし）<br>実際の使用時はAPIキー設定が必要です。</div>`;
    }
    aiBody.scrollTop = aiBody.scrollHeight;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.onload = () => {
        const max = 800;
        let w = img.width, h = img.height;
        if (w > max) { h = h * max / w; w = max; }
        if (h > max) { w = w * max / h; h = max; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75).split(',')[1]);
      };
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
