// ===== STATE STORE =====
export const state = {
  currentPage: 'dashboard',
  currentProject: '0',
  user: { name: '宮尾 明海', role: 'admin', company: 'Syabon建設' },
  sidenavOpen: false,

  projects: [
    { id: '0', name: 'A棟 新築工事', location: '大阪市北区', status: 'active', progress: 68 },
    { id: '1', name: 'B棟 改修工事', location: '大阪市中央区', status: 'active', progress: 34 },
    { id: '2', name: 'C棟 解体工事', location: '大阪市浪速区', status: 'complete', progress: 100 },
  ],

  drawings: [
    { id: 'd1', name: '1F 平面図', type: '建築', rev: 'Rev.3', projectId: '0', pinCount: 5, date: '2026-06-10' },
    { id: 'd2', name: '2F 平面図', type: '建築', rev: 'Rev.2', projectId: '0', pinCount: 2, date: '2026-06-08' },
    { id: 'd3', name: '電気設備図', type: '設備', rev: 'Rev.1', projectId: '0', pinCount: 3, date: '2026-05-30' },
    { id: 'd4', name: '外壁詳細図', type: '建築', rev: 'Rev.4', projectId: '0', pinCount: 1, date: '2026-06-15' },
  ],

  pins: [
    { id: 'p1', drawingId: 'd1', x: 28, y: 35, label: 'ひび割れ', severity: 'danger', memo: '南壁 幅0.3mm 経過観察', status: 'open', photoCount: 2, date: '2026-06-20', assignee: '田中' },
    { id: 'p2', drawingId: 'd1', x: 65, y: 22, label: '漏水痕', severity: 'warn', memo: '天井スラブ 茶色シミ', status: 'open', photoCount: 1, date: '2026-06-21', assignee: '宮尾' },
    { id: 'p3', drawingId: 'd1', x: 50, y: 65, label: '配管確認', severity: 'ok', memo: '異常なし 完了', status: 'closed', photoCount: 3, date: '2026-06-18', assignee: '田中' },
    { id: 'p4', drawingId: 'd1', x: 80, y: 48, label: '塗装剥離', severity: 'warn', memo: '外壁東面 要補修', status: 'in_progress', photoCount: 0, date: '2026-06-22', assignee: '山本' },
    { id: 'p5', drawingId: 'd1', x: 15, y: 80, label: '鉄筋露出', severity: 'danger', memo: '柱脚部 至急対応', status: 'open', photoCount: 1, date: '2026-06-24', assignee: '未定' },
  ],

  checklistTemplates: [
    {
      id: 'ct1', name: '躯体工事検査', items: [
        { id: 'i1', category: '基礎', label: '基礎配筋ピッチ確認', required: true },
        { id: 'i2', category: '基礎', label: 'かぶり厚さ確認', required: true },
        { id: 'i3', category: '基礎', label: '型枠寸法確認', required: true },
        { id: 'i4', category: '躯体', label: '柱・梁配筋確認', required: true },
        { id: 'i5', category: '躯体', label: 'スラブ厚確認', required: true },
        { id: 'i6', category: '躯体', label: 'コンクリート打設状況', required: true },
        { id: 'i7', category: '仕上', label: '表面仕上げ状態', required: false },
        { id: 'i8', category: '仕上', label: 'ジャンカ・巣穴の有無', required: true },
      ]
    },
    {
      id: 'ct2', name: '設備工事検査', items: [
        { id: 'i9', category: '電気', label: '電源配線ルート確認', required: true },
        { id: 'i10', category: '電気', label: 'アース接地確認', required: true },
        { id: 'i11', category: '電気', label: '照明器具取付確認', required: false },
        { id: 'i12', category: '給排水', label: '給水管勾配確認', required: true },
        { id: 'i13', category: '給排水', label: '排水管勾配確認', required: true },
        { id: 'i14', category: '空調', label: '換気経路確認', required: false },
      ]
    }
  ],

  checklistResults: {},

  reports: [
    {
      id: 'r1', title: '躯体工事中間検査報告', date: '2026-06-20',
      inspector: '宮尾 明海', type: '中間検査', status: 'complete',
      projectId: '0', summary: '全体的に施工品質は良好。基礎配筋のかぶり厚さについて一部指摘あり。',
      findings: ['基礎配筋ピッチ：適正', 'かぶり厚さ：1箇所不足（補正済み）', 'コンクリート強度：規定値以上'],
      aiGenerated: true
    },
    {
      id: 'r2', title: '外壁ひび割れ緊急点検報告', date: '2026-06-24',
      inspector: '宮尾 明海', type: '緊急点検', status: 'draft',
      projectId: '0', summary: 'AI生成下書き。要確認・修正。',
      findings: ['南壁0.3mmひび割れ確認', '漏水の可能性あり要経過観察'],
      aiGenerated: true
    },
  ],

  photos: [
    { id: 'ph1', drawingId: 'd1', pinId: 'p1', url: null, date: '2026-06-20', label: 'ひび割れ全景', aiAnalysis: { severity: 'warn', findings: ['幅0.3mmのひび割れ検出', '構造上の問題は軽微'] } },
    { id: 'ph2', drawingId: 'd1', pinId: 'p2', url: null, date: '2026-06-21', label: '天井漏水痕', aiAnalysis: { severity: 'danger', findings: ['漏水痕を検出', '上階防水処理の確認が必要'] } },
    { id: 'ph3', drawingId: 'd1', pinId: 'p3', url: null, date: '2026-06-18', label: '配管確認完了', aiAnalysis: { severity: 'ok', findings: ['配管状態良好', '異常なし'] } },
  ],

  listeners: {},
};

export function subscribe(event, cb) {
  if (!state.listeners[event]) state.listeners[event] = [];
  state.listeners[event].push(cb);
}

export function emit(event, data) {
  (state.listeners[event] || []).forEach(cb => cb(data));
}

export function navigate(page) {
  state.currentPage = page;
  emit('navigate', page);
}

export function getCurrentProject() {
  return state.projects.find(p => p.id === state.currentProject) || state.projects[0];
}
