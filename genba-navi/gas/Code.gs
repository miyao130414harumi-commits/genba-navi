// ===================================================
// 現場ナビ AI — Google Apps Script バックエンド
// ===================================================
// デプロイ: GASエディタ → デプロイ → Webアプリ
//   - 実行者: 自分
//   - アクセス: 全員（または組織内）
// ===================================================

const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const DRIVE_FOLDER_ID = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');

function doGet(e) {
  return handleRequest(e);
}
function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = e.parameter || {};
  const body = e.postData ? JSON.parse(e.postData.contents || '{}') : {};
  const action = params.action || body.action;

  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    let result;
    switch (action) {
      case 'getProjects':   result = getProjects(); break;
      case 'getDrawings':   result = getDrawings(params.projectId); break;
      case 'getPins':       result = getPins(params.drawingId); break;
      case 'savePin':       result = savePin(body.pin); break;
      case 'updatePin':     result = updatePin(body.pin); break;
      case 'getReports':    result = getReports(params.projectId); break;
      case 'saveReport':    result = saveReport(body.report); break;
      case 'getChecklist':  result = getChecklist(params.templateId); break;
      case 'saveChecklist': result = saveChecklist(body.template); break;
      case 'uploadPhoto':   result = uploadPhoto(body); break;
      case 'getPhotos':     result = getPhotos(params.drawingId); break;
      default: result = { error: 'Unknown action: ' + action };
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== SPREADSHEET HELPER =====
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function appendRow(sheet, headers, obj) {
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  sheet.appendRow(row);
}

// ===== PROJECTS =====
function getProjects() {
  return sheetToObjects(getSheet('projects'));
}

// ===== DRAWINGS =====
function getDrawings(projectId) {
  const all = sheetToObjects(getSheet('drawings'));
  return projectId ? all.filter(d => d.projectId === projectId) : all;
}

// ===== PINS =====
const PIN_HEADERS = ['id','drawingId','x','y','label','severity','memo','status','assignee','photoCount','date'];

function getPins(drawingId) {
  const all = sheetToObjects(getSheet('pins'));
  return drawingId ? all.filter(p => p.drawingId === drawingId) : all;
}

function savePin(pin) {
  const sheet = getSheet('pins');
  pin.id = pin.id || `p_${Date.now()}`;
  pin.date = pin.date || new Date().toISOString().slice(0, 10);
  appendRow(sheet, PIN_HEADERS, pin);
  return { id: pin.id };
}

function updatePin(pin) {
  const sheet = getSheet('pins');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === pin.id) {
      headers.forEach((h, j) => {
        if (pin[h] !== undefined) sheet.getRange(i+1, j+1).setValue(pin[h]);
      });
      return { updated: true };
    }
  }
  return { updated: false };
}

// ===== REPORTS =====
const REPORT_HEADERS = ['id','projectId','title','date','inspector','type','status','summary','aiGenerated'];

function getReports(projectId) {
  const all = sheetToObjects(getSheet('reports'));
  return projectId ? all.filter(r => r.projectId === projectId) : all;
}

function saveReport(report) {
  const sheet = getSheet('reports');
  report.id = report.id || `r_${Date.now()}`;
  appendRow(sheet, REPORT_HEADERS, report);
  // Save full content to Drive
  if (report.fullContent) {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const blob = Utilities.newBlob(report.fullContent, 'text/plain', `report_${report.id}.txt`);
    folder.createFile(blob);
  }
  return { id: report.id };
}

// ===== CHECKLISTS =====
const CL_HEADERS = ['id','name','items'];

function getChecklist(templateId) {
  const all = sheetToObjects(getSheet('checklists'));
  if (templateId) return all.find(t => t.id === templateId);
  return all.map(t => ({ ...t, items: JSON.parse(t.items || '[]') }));
}

function saveChecklist(template) {
  const sheet = getSheet('checklists');
  template.id = template.id || `ct_${Date.now()}`;
  template.items = JSON.stringify(template.items || []);
  appendRow(sheet, CL_HEADERS, template);
  return { id: template.id };
}

// ===== PHOTOS =====
function uploadPhoto(body) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const blob = Utilities.newBlob(
    Utilities.base64Decode(body.base64),
    body.mimeType || 'image/jpeg',
    body.filename || `photo_${Date.now()}.jpg`
  );
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const photoRecord = {
    id: `ph_${Date.now()}`,
    drawingId: body.drawingId || '',
    pinId: body.pinId || '',
    driveId: file.getId(),
    driveUrl: `https://drive.google.com/uc?id=${file.getId()}`,
    date: new Date().toISOString().slice(0, 10),
    label: body.label || '',
    aiSeverity: body.aiSeverity || '',
    aiFindings: JSON.stringify(body.aiFindings || []),
  };

  const sheet = getSheet('photos');
  appendRow(sheet, Object.keys(photoRecord), photoRecord);
  return { id: photoRecord.id, url: photoRecord.driveUrl };
}

function getPhotos(drawingId) {
  const all = sheetToObjects(getSheet('photos'));
  const photos = drawingId ? all.filter(p => p.drawingId === drawingId) : all;
  return photos.map(p => ({ ...p, aiFindings: JSON.parse(p.aiFindings || '[]') }));
}

// ===== SETUP =====
// GASエディタで一度だけ実行してシートを初期化
function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ['projects','drawings','pins','reports','checklists','photos'];
  sheets.forEach(name => {
    if (!ss.getSheetByName(name)) ss.insertSheet(name);
  });

  // Sample data
  const projectSheet = getSheet('projects');
  if (projectSheet.getLastRow() < 2) {
    projectSheet.appendRow(['id','name','location','status','progress']);
    projectSheet.appendRow(['p1','A棟 新築工事','大阪市北区','active','68']);
  }
  Logger.log('Setup complete');
}
