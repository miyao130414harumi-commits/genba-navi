import { state, subscribe, navigate, emit } from './store.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderDrawings } from './pages/drawings.js';
import { renderChecklist } from './pages/checklist.js';
import { renderReports } from './pages/reports.js';
import { renderPhotos } from './pages/photos.js';
import { toast } from './utils/toast.js';

const NAV_ITEMS = [
  { id: 'dashboard', icon: '🏠', label: 'ダッシュボード', section: 'メイン' },
  { id: 'drawings', icon: '📐', label: '図面管理', section: 'メイン', badge: () => state.drawings.filter(d=>d.projectId===state.currentProject).length },
  { id: 'photos', icon: '📷', label: '写真管理', section: 'メイン', badge: () => state.photos.length },
  { id: 'checklist', icon: '✅', label: '検査チェックリスト', section: '現場作業' },
  { id: 'reports', icon: '📋', label: '報告書', section: '現場作業', badge: () => state.reports.filter(r=>r.status==='draft').length || null },
];

function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="topbar">
      <button class="topbar-btn" id="menu-toggle" style="padding:5px 8px;font-size:18px">☰</button>
      <div class="topbar-logo">現場ナビ AI<span>β</span></div>
      <div class="topbar-project">
        <select id="project-select">
          ${state.projects.map(p=>`<option value="${p.id}" ${p.id===state.currentProject?'selected':''}>${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="topbar-avatar" title="${state.user.name}">${state.user.name[0]}</div>
    </div>

    <div class="main-layout">
      <nav class="sidenav" id="sidenav">
        ${buildSidenav()}
      </nav>

      <div class="page-content" id="page-content">
        ${NAV_ITEMS.map(n=>`<div class="page" id="page-${n.id}"></div>`).join('')}
      </div>
    </div>
  `;

  // Events
  document.getElementById('menu-toggle').onclick = () => {
    const nav = document.getElementById('sidenav');
    nav.classList.toggle('open');
  };

  document.getElementById('project-select').onchange = (e) => {
    state.currentProject = e.target.value;
    renderCurrentPage();
    document.getElementById('sidenav').innerHTML = buildSidenav();
    bindSidenav();
    toast(`${state.projects.find(p=>p.id===e.target.value)?.name}に切り替えました`, 'success');
  };

  bindSidenav();
  renderCurrentPage();
}

function buildSidenav() {
  const sections = [...new Set(NAV_ITEMS.map(n=>n.section))];
  return sections.map(sec => `
    <div class="sidenav-section">
      <div class="sidenav-section-label">${sec}</div>
      ${NAV_ITEMS.filter(n=>n.section===sec).map(n => {
        const badge = n.badge?.();
        return `
        <button class="sidenav-item ${state.currentPage===n.id?'active':''}" data-page="${n.id}">
          <span class="nav-icon">${n.icon}</span>
          ${n.label}
          ${badge ? `<span class="nav-badge">${badge}</span>` : ''}
        </button>`;
      }).join('')}
    </div>`).join('');
}

function bindSidenav() {
  document.querySelectorAll('.sidenav-item').forEach(btn => {
    btn.onclick = () => {
      navigate(btn.dataset.page);
      document.getElementById('sidenav').classList.remove('open');
    };
  });
}

function renderCurrentPage() {
  const page = state.currentPage;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const container = document.getElementById(`page-${page}`);
  if (!container) return;
  container.classList.add('active');

  // Render
  const renderers = {
    dashboard: renderDashboard,
    drawings: renderDrawings,
    checklist: renderChecklist,
    reports: renderReports,
    photos: renderPhotos,
  };
  renderers[page]?.(container);
}

// Listen for navigation
subscribe('navigate', (page) => {
  document.querySelectorAll('.sidenav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  renderCurrentPage();
});

// Init
renderApp();
