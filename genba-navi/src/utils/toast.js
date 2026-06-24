const container = document.createElement('div');
container.className = 'toast-container';
document.body.appendChild(container);

export function toast(msg, type = 'default', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', default: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || icons.default}</span><span>${msg}</span>`;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

export function modal({ title, body, confirmLabel = '確認', cancelLabel = 'キャンセル', onConfirm, danger = false }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop open';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-title">${title}</div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-cancel">${cancelLabel}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">${confirmLabel}</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#modal-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#modal-confirm').onclick = () => { onConfirm?.(); backdrop.remove(); };
  backdrop.onclick = e => { if (e.target === backdrop) backdrop.remove(); };
  return backdrop;
}
