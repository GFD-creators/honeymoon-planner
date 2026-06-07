import { update } from './store.js';

const TYPES = [
  { value: 'flight', label: '移動' },
  { value: 'sightseeing', label: '観光' },
  { value: 'hotel', label: '宿泊' },
  { value: 'food', label: '食事' },
  { value: 'other', label: 'その他' },
];

let overlay = null;

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// event=null で新規。opts = { defaultDate, defaultTime, prefill:{title,city,type}, onSaved(id,isNew) }。
// 後方互換: opts が文字列なら defaultDate として扱う。
export function openEditor(event, opts) {
  closeEditor();
  const o = typeof opts === 'string' ? { defaultDate: opts } : (opts || {});
  const pre = o.prefill || {};
  const isNew = !event;
  const ev = event || {
    id: 'e' + Date.now(),
    date: o.defaultDate || '2026-09-12',
    time: o.defaultTime || '',
    endTime: '',
    city: pre.city || '',
    type: pre.type || 'sightseeing',
    title: pre.title || '',
    meals: {},
  };

  overlay = document.createElement('div');
  overlay.className = 'editor-overlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeEditor(); });

  const sheet = document.createElement('div');
  sheet.className = 'editor-sheet';
  const typeOptions = TYPES.map((t) =>
    `<option value="${t.value}"${t.value === ev.type ? ' selected' : ''}>${t.label}</option>`).join('');

  sheet.innerHTML = `
    <h3 class="editor-title">${isNew ? '予定を追加' : '予定を編集'}</h3>
    <label class="editor-field">内容
      <input class="edit" id="ed-title" type="text" value="${escapeAttr(ev.title)}" placeholder="例: ルーブル美術館" />
    </label>
    <label class="editor-field">種別
      <select class="edit" id="ed-type">${typeOptions}</select>
    </label>
    <label class="editor-field">日付
      <input class="edit" id="ed-date" type="date" value="${ev.date}" />
    </label>
    <div class="editor-row">
      <label class="editor-field">開始
        <input class="edit" id="ed-time" type="time" value="${ev.time || ''}" />
      </label>
      <label class="editor-field">終了
        <input class="edit" id="ed-endtime" type="time" value="${ev.endTime || ''}" />
      </label>
    </div>
    <p class="editor-hint">開始を空にすると「終日」になります</p>
    <div class="editor-actions">
      <button class="btn-save" id="ed-save">保存</button>
      ${isNew ? '' : '<button class="btn-delete" id="ed-delete">削除</button>'}
      <button class="btn-cancel" id="ed-cancel">キャンセル</button>
    </div>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  sheet.querySelector('#ed-save').addEventListener('click', () => {
    const titleEl = sheet.querySelector('#ed-title');
    const title = titleEl.value.trim();
    if (!title) { titleEl.focus(); return; }
    const patch = {
      title,
      type: sheet.querySelector('#ed-type').value,
      date: sheet.querySelector('#ed-date').value,
      time: sheet.querySelector('#ed-time').value,
      endTime: sheet.querySelector('#ed-endtime').value,
    };
    update((s) => {
      const target = s.events.find((e) => e.id === ev.id);
      if (target) Object.assign(target, patch);
      else s.events.push({ ...ev, ...patch });
    });
    if (o.onSaved) o.onSaved(ev.id, isNew);
    closeEditor();
  });

  const delBtn = sheet.querySelector('#ed-delete');
  if (delBtn) delBtn.addEventListener('click', () => {
    if (!confirm('この予定を削除しますか？')) return;
    update((s) => {
      const i = s.events.findIndex((e) => e.id === ev.id);
      if (i >= 0) s.events.splice(i, 1);
    });
    closeEditor();
  });

  sheet.querySelector('#ed-cancel').addEventListener('click', closeEditor);
}

function closeEditor() {
  if (overlay) { overlay.remove(); overlay = null; }
}
