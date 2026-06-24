import { state, getCurrentProject } from '../store.js';
import { predictIssues } from '../utils/ai.js';
import { toast } from '../utils/toast.js';

export function renderDashboard(container) {
  const project = getCurrentProject();
  const openPins = state.pins.filter(p => p.status === 'open' && state.drawings.find(d => d.id === p.drawingId && d.projectId === state.currentProject));
  const dangerPins = openPins.filter(p => p.severity === 'danger');
  const totalDrawings = state.drawings.filter(d => d.projectId === state.currentProject).length;
  const totalReports = state.reports.filter(r => r.projectId === state.currentProject).length;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">${project.name}</div>
        <div class="page-subtitle">${project.location} — 進捗 ${project.progress}%</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="predict-btn">🤖 AIリスク予測</button>
        <button class="btn btn-primary btn-sm">+ 新規作業</button>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="stat-card" style="border-left: 3px solid var(--c-danger)">
        <div class="stat-value" style="color:var(--c-danger)">${dangerPins.length}</div>
        <div class="stat-label">緊急指摘（未対応）</div>
        <div class="stat-change down">要即時対応</div>
      </div>
      <div class="stat-card" style="border-left: 3px solid var(--c-warn)">
        <div class="stat-value" style="color:var(--c-warn)">${openPins.length}</div>
        <div class="stat-label">未対応指摘 合計</div>
        <div class="stat-change">全${state.pins.length}件中</div>
      </div>
      <div class="stat-card" style="border-left: 3px solid var(--c-primary)">
        <div class="stat-value" style="color:var(--c-primary)">${totalDrawings}</div>
        <div class="stat-label">登録図面数</div>
        <div class="stat-change up">最終更新 本日</div>
      </div>
      <div class="stat-card" style="border-left: 3px solid var(--c-purple)">
        <div class="stat-value" style="color:var(--c-purple)">${totalReports}</div>
        <div class="stat-label">報告書（今月）</div>
        <div class="stat-change up">↑ AI自動生成 ${state.reports.filter(r=>r.aiGenerated).length}件</div>
      </div>

      <div class="card" style="grid-column: 1/-1">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px">工事進捗</div>
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span>${project.name}</span><span style="color:var(--c-primary);font-weight:600">${project.progress}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${project.progress}%"></div></div>
        </div>
        ${state.projects.filter(p=>p.id !== state.currentProject).map(p=>`
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span style="color:var(--text3)">${p.name}</span><span style="color:var(--text3)">${p.progress}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${p.progress}%;background:var(--border2)"></div></div>
        </div>`).join('')}
      </div>

      <div class="card" style="grid-column: span 2">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="font-size:13px;font-weight:600">直近の指摘事項</div>
          <span class="badge badge-danger">${dangerPins.length} 緊急</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${openPins.slice(0,5).map(p=>`
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg2);border-radius:var(--radius)">
            <div class="pin-dot" style="background:${p.severity==='danger'?'var(--c-danger)':p.severity==='warn'?'var(--c-warn)':'var(--c-ok)'}"></div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500">${p.label}</div>
              <div style="font-size:11px;color:var(--text3)">${p.memo} — 担当: ${p.assignee}</div>
            </div>
            <span class="badge ${p.severity==='danger'?'badge-danger':p.severity==='warn'?'badge-warn':'badge-ok'}">${p.severity==='danger'?'緊急':p.severity==='warn'?'注意':'良好'}</span>
          </div>`).join('')}
        </div>
      </div>

      <div class="card" id="ai-prediction-card">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px">🤖 AIリスク予測</div>
        <div style="font-size:12px;color:var(--text3);line-height:1.7">
          「AIリスク予測」ボタンを押すと、現在の指摘事項をもとに将来発生しうるリスクをClaudeが分析します。
        </div>
      </div>
    </div>
  `;

  container.querySelector('#predict-btn').onclick = async () => {
    const card = container.querySelector('#ai-prediction-card');
    card.innerHTML = `<div style="font-size:13px;font-weight:600;margin-bottom:10px">🤖 AIリスク予測</div><div style="display:flex;align-items:center;gap:8px;color:var(--text3);font-size:12px"><span class="spinner dark"></span>分析中...</div>`;
    try {
      const result = await predictIssues(openPins);
      const sevColor = { high: 'var(--c-danger)', mid: 'var(--c-warn)', low: 'var(--c-ok)' };
      const sevLabel = { high: '高', mid: '中', low: '低' };
      card.innerHTML = `
        <div style="font-size:13px;font-weight:600;margin-bottom:10px">🤖 AIリスク予測結果</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${result.predictions.map(p=>`
          <div style="padding:8px 10px;background:var(--bg2);border-radius:var(--radius);border-left:3px solid ${sevColor[p.probability]}">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
              <span style="font-size:12px;font-weight:600">${p.risk}</span>
              <span style="font-size:10px;background:${sevColor[p.probability]};color:#fff;padding:1px 5px;border-radius:8px">リスク${sevLabel[p.probability]}</span>
            </div>
            <div style="font-size:11px;color:var(--text3)">${p.description}</div>
            <div style="font-size:11px;color:var(--c-primary);margin-top:3px">→ ${p.action}</div>
          </div>`).join('')}
        </div>
      `;
      toast('AIリスク予測が完了しました', 'success');
    } catch(e) {
      card.innerHTML = `<div style="font-size:13px;font-weight:600;margin-bottom:10px">🤖 AIリスク予測</div><div style="font-size:12px;color:var(--c-danger)">解析エラー（APIキー設定が必要です）</div>`;
    }
  };
}
