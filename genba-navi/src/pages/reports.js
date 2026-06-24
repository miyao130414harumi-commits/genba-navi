import { state } from '../store.js';
import { generateReport } from '../utils/ai.js';
import { toast } from '../utils/toast.js';

export function renderReports(container) {
  const reports = state.reports.filter(r => r.projectId === state.currentProject);
  const project = state.projects.find(p => p.id === state.currentProject);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">報告書</div>
      <div class="page-subtitle">${reports.length}件</div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" id="new-report-btn">🤖 AI報告書を生成</button>
      </div>
    </div>

    <div class="reports-grid" id="reports-grid">
      ${reports.length === 0 ? `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">報告書がありません</div>
          <div class="empty-state-body">「AI報告書を生成」ボタンで自動作成できます</div>
        </div>` :
        reports.map(r => reportCard(r)).join('')
      }
    </div>

    <div id="gen-modal" class="modal-backdrop">
      <div class="modal">
        <div class="modal-title">🤖 AI報告書生成</div>
        <div class="form-group">
          <label class="form-label">現場名</label>
          <input class="form-input" id="r-site" value="${project?.name||''}">
        </div>
        <div class="form-group">
          <label class="form-label">点検日</label>
          <input class="form-input" id="r-date" type="date" value="${new Date().toISOString().slice(0,10)}">
        </div>
        <div class="form-group">
          <label class="form-label">点検者</label>
          <input class="form-input" id="r-inspector" value="${state.user.name}">
        </div>
        <div class="form-group">
          <label class="form-label">報告種別</label>
          <select class="form-select" id="r-type">
            <option>定期点検</option><option>中間検査</option><option>完了検査</option><option>緊急点検</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">所見メモ（箇条書き可）</label>
          <textarea class="form-textarea" id="r-notes" placeholder="気づいたこと、測定値など"></textarea>
        </div>
        <div style="padding:10px;background:var(--c-primary-light);border-radius:var(--radius);font-size:12px;color:var(--c-primary-dark);margin-bottom:4px">
          📍 現在の指摘事項 ${state.pins.filter(p=>p.status==='open').length}件も自動で含めます
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="gen-cancel">キャンセル</button>
          <button class="btn btn-primary" id="gen-start">AIで生成</button>
        </div>
      </div>
    </div>

    <div id="report-view-modal" class="modal-backdrop">
      <div class="modal" style="max-width:640px">
        <div id="report-view-content"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="view-close">閉じる</button>
          <button class="btn btn-secondary btn-sm" id="view-copy">📋 コピー</button>
          <button class="btn btn-primary btn-sm" id="view-export">⬇ テキスト保存</button>
        </div>
      </div>
    </div>
  `;

  // New report
  container.querySelector('#new-report-btn').onclick = () => {
    container.querySelector('#gen-modal').classList.add('open');
    container.querySelector('#r-notes').focus();
  };
  container.querySelector('#gen-cancel').onclick = () => container.querySelector('#gen-modal').classList.remove('open');

  container.querySelector('#gen-start').onclick = async () => {
    const btn = container.querySelector('#gen-start');
    btn.innerHTML = '<span class="spinner"></span> 生成中...';
    btn.disabled = true;

    const params = {
      site: container.querySelector('#r-site').value,
      date: container.querySelector('#r-date').value,
      inspector: container.querySelector('#r-inspector').value,
      type: container.querySelector('#r-type').value,
      notes: container.querySelector('#r-notes').value,
      pins: state.pins.filter(p => p.status === 'open').slice(0, 10),
    };

    try {
      const result = await generateReport(params);
      const report = {
        id: `r${Date.now()}`, title: result.title, date: params.date,
        inspector: params.inspector, type: params.type, status: 'draft',
        projectId: state.currentProject, summary: result.overview,
        findings: result.sections.map(s => s.heading),
        aiGenerated: true, _full: result,
      };
      state.reports.push(report);
      toast('報告書を生成しました', 'success');
      container.querySelector('#gen-modal').classList.remove('open');
      renderReports(container);
    } catch(e) {
      const fallback = {
        id: `r${Date.now()}`, title: `${params.site} ${params.type}報告書`,
        date: params.date, inspector: params.inspector, type: params.type,
        status: 'draft', projectId: state.currentProject,
        summary: `${params.date}に${params.inspector}が${params.site}の${params.type}を実施した。`,
        findings: ['施工状況確認', '指摘事項記録', '対応方針決定'],
        aiGenerated: true,
      };
      state.reports.push(fallback);
      toast('AI接続なし：基本テンプレートで生成しました', 'warning');
      container.querySelector('#gen-modal').classList.remove('open');
      renderReports(container);
    }
    btn.innerHTML = 'AIで生成';
    btn.disabled = false;
  };

  // Report cards click
  container.querySelectorAll('.report-card').forEach(el => {
    el.onclick = () => {
      const report = state.reports.find(r => r.id === el.dataset.id);
      if (report) showReportView(report, container);
    };
  });

  // View modal close
  container.querySelector('#view-close').onclick = () => container.querySelector('#report-view-modal').classList.remove('open');
  container.querySelector('#view-copy').onclick = () => {
    const content = container.querySelector('#report-view-content');
    navigator.clipboard.writeText(content.innerText).then(() => toast('コピーしました', 'success'));
  };
  container.querySelector('#view-export').onclick = () => {
    const content = container.querySelector('#report-view-content');
    const blob = new Blob([content.innerText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `report_${new Date().toISOString().slice(0,10)}.txt`;
    a.click(); URL.revokeObjectURL(url);
    toast('保存しました', 'success');
  };
}

function reportCard(r) {
  const statusStyle = { complete: 'badge-ok', draft: 'badge-warn', review: 'badge-info' };
  const statusLabel = { complete: '完了', draft: '下書き', review: 'レビュー中' };
  return `
    <div class="report-card" data-id="${r.id}">
      <div class="report-card-header">
        <div>
          <div class="report-card-title">${r.title}</div>
          <div class="report-card-meta">${r.date} · ${r.inspector} · ${r.type}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          <span class="badge ${statusStyle[r.status]||'badge-gray'}">${statusLabel[r.status]||r.status}</span>
          ${r.aiGenerated?'<span class="badge badge-info">AI生成</span>':''}
        </div>
      </div>
      <div class="report-card-body">${r.summary}</div>
      <div class="report-card-footer">
        ${r.findings.map(f=>`<span class="badge badge-gray">${f}</span>`).join('')}
      </div>
    </div>
  `;
}

function showReportView(report, container) {
  const full = report._full;
  const content = container.querySelector('#report-view-content');
  content.innerHTML = `
    <div style="margin-bottom:16px">
      <h2 style="font-size:18px;font-weight:600;color:var(--c-primary);margin-bottom:8px">${report.title}</h2>
      <div style="display:flex;gap:16px;font-size:12px;color:var(--text3);background:var(--bg2);padding:10px;border-radius:var(--radius)">
        <span>📍 ${report.inspector}</span>
        <span>📅 ${report.date}</span>
        <span>🔖 ${report.type}</span>
        ${report.aiGenerated?'<span>🤖 AI生成</span>':''}
      </div>
    </div>
    <div style="font-size:13px;line-height:1.8;color:var(--text2)">
      <p style="margin-bottom:12px">${report.summary}</p>
      ${full ? full.sections.map(s=>`
        <h3 style="font-size:14px;font-weight:600;margin:14px 0 6px;color:var(--text)">${s.heading}</h3>
        <p>${s.body}</p>
      `).join('') : report.findings.map(f=>`<p>・${f}</p>`).join('')}
      ${full?.conclusion?`<p style="margin-top:12px;padding:10px;background:var(--c-primary-light);border-radius:var(--radius);color:var(--c-primary-dark)">${full.conclusion}</p>`:''}
    </div>
  `;
  container.querySelector('#report-view-modal').classList.add('open');
}
