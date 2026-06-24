const API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

async function callClaude({ system, prompt, image, maxTokens = 1000 }) {
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
  content.push({ type: 'text', text: prompt });

  const body = { model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content }] };
  if (system) body.system = system;

  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.map(c => c.text || '').join('');
}

function parseJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// 写真解析
export async function analyzePhoto(base64Image) {
  const text = await callClaude({
    prompt: `この建設現場の写真を解析してください。JSON形式のみで回答（説明不要）:
{"severity":"high|mid|low","findings":["指摘1","指摘2"],"category":"ひび割れ|漏水|錆|剥離|その他","summary":"総合所見20字以内","recommend":"推奨対応20字以内"}
日本語で。`,
    image: base64Image
  });
  return parseJSON(text);
}

// チェックリスト自動生成
export async function generateChecklist(drawingName, workType) {
  const text = await callClaude({
    prompt: `建設現場の「${drawingName}」（工種: ${workType}）の検査チェックリストを生成してください。
JSON形式のみで回答:
{"items":[{"category":"カテゴリ名","label":"検査項目","required":true}]}
日本語で10〜15項目。`,
  });
  return parseJSON(text);
}

// 報告書自動生成
export async function generateReport({ site, date, inspector, type, notes, pins = [] }) {
  const pinSummary = pins.map(p => `・${p.label}（${p.severity === 'danger' ? '重要' : p.severity === 'warn' ? '注意' : '軽微'}）: ${p.memo}`).join('\n');
  const text = await callClaude({
    prompt: `以下の点検情報をもとに建設現場の${type}報告書を作成してください。
現場: ${site}
点検日: ${date}
点検者: ${inspector}
所見メモ: ${notes}
指摘事項:\n${pinSummary || 'なし'}

JSON形式のみで回答:
{"title":"タイトル","overview":"概要3文","sections":[{"heading":"見出し","body":"本文2〜3文"}],"conclusion":"総括2文"}
セクションは3つ。日本語で。`,
    maxTokens: 1500
  });
  return parseJSON(text);
}

// 自然言語検索
export async function searchByNL(query, drawings) {
  const drawingList = drawings.map(d => `・${d.name}（${d.type} ${d.rev}）`).join('\n');
  const text = await callClaude({
    prompt: `ユーザーの検索クエリ「${query}」に対して、以下の図面リストから最も関連するものを選んでください。
${drawingList}

JSON形式のみで回答:
{"matches":["図面名1","図面名2"],"explanation":"理由20字以内"}`,
  });
  return parseJSON(text);
}

// 不具合予測
export async function predictIssues(pins) {
  const summary = pins.map(p => `${p.label}: ${p.memo} (${p.severity})`).join('\n');
  const text = await callClaude({
    prompt: `以下の現場指摘事項から、今後発生しうる問題を予測してください。
${summary}

JSON形式のみで回答:
{"predictions":[{"risk":"リスク名","probability":"high|mid|low","description":"説明20字","action":"推奨対応20字"}]}
最大3件。日本語で。`,
  });
  return parseJSON(text);
}
