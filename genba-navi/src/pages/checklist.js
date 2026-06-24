import { state } from '../store.js';
import { generateChecklist } from '../utils/ai.js';
import { toast } from '../utils/toast.js';

let activeTemplate = null;

export function renderChecklist(container) {
  const templates = state.checklistTemplates;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">検査チェックリスト</div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="ai-gen-btn">🤖 AIでリスト生成</button>
        <button class="btn btn-secondary btn-sm" id="export-btn">📄 帳票出力</button>
        <button class="btn btn-primary btn-sm" id="new-template-btn">+ テンプレ追加</button>
      </div>
    </div>
    <div class="checklist-layout">
      <div class="checklist-master">
        <div class="sidebar-header"><div class="sidebar-header-title">テンプレート</div></div>
        <div id="template-list">
          ${templates.map(t => `
          <div class="pin-list-item template-item" data-id="${t.id}">
            <div>
              <div class="pin-list-label">${t.name}</div>
              <div class="pin-list-sub">${t.items.length}項目</div>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <div class="checklist-body" id="checklist-body">
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">テンプレートを選択</div>
          <div class="empty-state-body">左のリストから検査テンプレートを選ぶか<br>AIで自動生成してください</div>
        </div>
      </div>
    </div>

    <div id="ai-gen-modal" class="modal-backdrop">
      <div class="modal">
        <div class="modal-title">🤖 AIチェックリスト生成</div>
        <div class="form-group">
          <label class="form-label">図面・箇所名</label>
          <input class="form-input" id="gen-drawing" placeholder="例：1F 躯体工事、外壁防水">
        </div>
        <div class="form-group">
          <label class="form-label">工種</label>
          <select class="form-select" id="gen-worktype">
            <option>躯体工事</option>
            <option>設備工事</option>
            <option>防水工事</option>
            <option>仕上工事</option>
            <option>外構工事</option>
            <option>解体工事</option>
          </select>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="gen-cancel">キャンセル</button>
          <button class="btn btn-primary" id="gen-start">生成する</button>
        </div>
      </div>
    </div>
  `;

  // Template list click
  container.querySelectorAll('.template-item').forEach(el => {
    el.onclick = () => {
      container.querySelectorAll('.template-item').forEach(x => x.style.background = '');
      el.style.background = 'var(--c-primary-light)';
      activeTemplate = state.checklistTemplates.find(t => t.id === el.dataset.id);
      renderChecklistBody(activeTemplate, container);
    };
  });

  // AI gen
  container.querySelector('#ai-gen-btn').onclick = () => {
    container.querySelector('#ai-gen-modal').classList.add('open');
    container.querySelector('#gen-drawing').focus();
  };
  container.querySelector('#gen-cancel').onclick = () => container.querySelector('#ai-gen-modal').classList.remove('open');
  container.querySelector('#gen-start').onclick = async () => {
    const drawing = container.querySelector('#gen-drawing').value.trim();
    const worktype = container.querySelector('#gen-worktype').value;
    if (!drawing) { toast('図面・箇所名を入力してください', 'warning'); return; }

    const btn = container.querySelector('#gen-start');
    btn.innerHTML = '<span class="spinner"></span> 生成中...';
    btn.disabled = true;

    try {
      const result = await generateChecklist(drawing, worktype);
      const newTemplate = {
        id: `ct${Date.now()}`,
        name: `${drawing}（AI生成）`,
        items: result.items.map((item, i) => ({ id: `ai_i${i}`, ...item }))
      };
      state.checklistTemplates.push(newTemplate);
      toast('チェックリストを生成しました', 'success');
      container.querySelector('#ai-gen-modal').classList.remove('open');
      renderChecklist(container);
      // auto-select new template
      setTimeout(() => {
        const el = container.querySelector(`[data-id="${newTemplate.id}"]`);
        if (el) el.click();
      }, 100);
    } catch(e) {
      // fallback
      const fallback = {
        id: `ct${Date.now()}`, name: `${drawing}（AI生成）`,
        items: [
          { id: 'f1', category: '一般', label: '施工図と現場の照合', required: true },
          { id: 'f2', category: '一般', label: '材料確認・承認書確認', required: true },
          { id: 'f3', category: '品質', label: '施工精度の確認', required: true },
          { id: 'f4', category: '品質', label: '養生状態の確認', required: false },
          { id: 'f5', category: '安全', label: '安全設備・仮設の確認', required: true },
        ]
      };
      state.checklistTemplates.push(fallback);
      toast('AI接続なし：標準テンプレートを生成しました', 'warning');
      container.querySelector('#ai-gen-modal').classList.remove('open');
      renderChecklist(container);
    }
    btn.innerHTML = '生成する';
    btn.disabled = false;
  };

  // Export
  container.querySelector('#export-btn').onclick = () => {
    if (!activeTemplate) { toast('先にテンプレートを選択してください', 'warning'); return; }
    exportToPDF(activeTemplate);
  };

  // New template
  container.querySelector('#new-template-btn').onclick = () => {
    const name = prompt('テンプレート名を入力してください:');
    if (!name) return;
    const t = { id: `ct${Date.now()}`, name, items: [] };
    state.checklistTemplates.push(t);
    renderChecklist(container);
    toast(`「${name}」を作成しました`, 'success');
  };
}

function renderChecklistBody(template, container) {
  if (!state.checklistResults[template.id]) state.checklistResults[template.id] = {};
  const results = state.checklistResults[template.id];

  const categories = [...new Set(template.items.map(i => i.category))];
  const done = template.items.filter(i => results[i.id] && results[i.id] !== 'none').length;
  const ngCount = template.items.filter(i => results[i.id] === 'ng').length;

  const body = container.querySelector('#checklist-body');
  body.innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-size:16px;font-weight:600">${template.name}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">${template.items.length}項目中 ${done}項目完了 ${ngCount > 0 ? `· <span style="color:var(--c-danger)">NG ${ngCount}件</span>` : ''}</div>
      </div>
      <div style="flex:1;min-width:200px">
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(done/template.items.length*100)}%;background:${ngCount>0?'var(--c-danger)':'var(--c-primary)'}"></div></div>
      </div>
      <span class="badge ${done===template.items.length?'badge-ok':ngCount>0?'badge-danger':'badge-gray'}">${done===template.items.length?'✅ 完了':ngCount>0?`NG ${ngCount}件`:`${done}/${template.items.length}`}</span>
    </div>

    ${categories.map(cat => `
    <div class="checklist-category">
      <div class="checklist-category-title">${cat}</div>
      ${template.items.filter(i => i.category === cat).map(item => `
      <div class="checklist-item ${results[item.id]==='ok'?'checked':results[item.id]==='ng'?'ng':''}" data-item-id="${item.id}">
        <div class="checklist-checkbox">${results[item.id]==='ok'?'✓':results[item.id]==='ng'?'✕':''}</div>
        <div class="checklist-item-label">
          ${item.label}
          ${item.required?'<span style="color:var(--c-danger);font-size:11px"> *必須</span>':''}
        </div>
        <div class="checklist-item-status">
          <button class="status-btn status-ok ${results[item.id]==='ok'?'active':''}" data-val="ok">OK</button>
          <button class="status-btn status-ng ${results[item.id]==='ng'?'active':''}" data-val="ng">NG</button>
          <button class="status-btn status-na ${results[item.id]==='na'?'active':''}" data-val="na">N/A</button>
        </div>
      </div>`).join('')}
    </div>`).join('')}

    <div style="margin-top:16px;padding:14px;background:var(--bg2);border-radius:var(--radius)">
      <div style="font-size:12px;font-weight:600;margin-bottom:6px">現場メモ</div>
      <textarea class="form-textarea" id="checklist-notes" placeholder="総合所見・特記事項" style="min-height:60px">${results.__notes||''}</textarea>
    </div>
  `;

  // Status buttons
  body.querySelectorAll('.status-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const item = btn.closest('[data-item-id]');
      const itemId = item.dataset.itemId;
      const val = btn.dataset.val;
      results[itemId] = results[itemId] === val ? undefined : val;
      renderChecklistBody(template, container);
    };
  });

  // Notes
  body.querySelector('#checklist-notes').oninput = (e) => {
    results.__notes = e.target.value;
  };
}

function exportToPDF(template) {
  const results = state.checklistResults[template.id] || {};
  const lines = [
    `検査チェックリスト: ${template.name}`,
    `出力日: ${new Date().toLocaleDateString('ja-JP')}`,
    '='.repeat(40),
    '',
  ];
  template.items.forEach((item, i) => {
    const status = results[item.id] === 'ok' ? '✓ OK' : results[item.id] === 'ng' ? '✕ NG' : results[item.id] === 'na' ? '— N/A' : '□ 未入力';
    lines.push(`${i+1}. [${status}] ${item.label}`);
  });
  if (results.__notes) { lines.push('', '現場メモ:', results.__notes); }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `checklist_${template.name}_${new Date().toISOString().slice(0,10)}.txt`;
  a.click(); URL.revokeObjectURL(url);
  toast('帳票を出力しました', 'success');
}
