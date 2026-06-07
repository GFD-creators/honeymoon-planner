import {
  timeToMinutes, minutesToTop, topToMinutes, snapMinutes, minutesToTime,
} from './week.js';

const THRESHOLD = 6; // px。これ未満の移動はタップ扱い

// ポインタキャプチャは環境によって例外を投げ得る（アクティブポインタ無し等）。
// 失敗してもドラッグ自体は継続できるため握り潰す。
function safeCapture(el, id) { try { el.setPointerCapture(id); } catch (e) { /* ignore */ } }
function safeRelease(el, id) { try { el.releasePointerCapture(id); } catch (e) { /* ignore */ } }

// blockEl: 対象ブロック要素 / ev: イベント / ctx: { opts, snapStep, getColumns, onCommit, onTap }
export function attachDrag(blockEl, ev, ctx) {
  const handle = blockEl.querySelector('.resize-handle');

  blockEl.addEventListener('pointerdown', (e) => {
    if (handle && handle.contains(e.target)) return; // ハンドルはリサイズ側で処理
    startMove(e);
  });
  if (handle) handle.addEventListener('pointerdown', startResize);

  function startMove(down) {
    down.preventDefault();
    const startX = down.clientX;
    const startY = down.clientY;
    const cols = ctx.getColumns();
    const origStart = timeToMinutes(ev.time);
    const origEnd = ev.endTime ? timeToMinutes(ev.endTime) : null;
    const dur = origEnd != null ? origEnd - origStart : 0;
    let dragging = false;
    let pending = null;
    safeCapture(blockEl, down.pointerId);

    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < THRESHOLD) return;
      dragging = true;
      blockEl.classList.add('dragging');
      const col = columnAt(cols, e.clientX) || cols.find((c) => c.date === ev.date) || cols[0];
      const raw = topToMinutes(e.clientY - col.rect.top, ctx.opts);
      let startMin = snapMinutes(raw, ctx.snapStep);
      if (startMin < 0) startMin = 0;
      if (startMin + dur > 1440) startMin = 1440 - dur;
      if (startMin < 0) startMin = 0;
      blockEl.style.top = minutesToTop(startMin, ctx.opts) + 'px';
      blockEl.style.transform = `translateX(${dx}px)`;
      const label = blockEl.querySelector('.bk-time');
      if (label) label.textContent = minutesToTime(startMin);
      pending = { date: col.date, startMin };
    }

    function onUp() {
      safeRelease(blockEl, down.pointerId);
      blockEl.removeEventListener('pointermove', onMove);
      blockEl.removeEventListener('pointerup', onUp);
      blockEl.classList.remove('dragging');
      blockEl.style.transform = '';
      if (!dragging) { ctx.onTap(ev); return; }
      if (!pending) return;
      const patch = { date: pending.date, time: minutesToTime(pending.startMin) };
      if (origEnd != null) patch.endTime = minutesToTime(pending.startMin + dur);
      ctx.onCommit(ev.id, patch);
    }

    blockEl.addEventListener('pointermove', onMove);
    blockEl.addEventListener('pointerup', onUp);
  }

  function startResize(down) {
    down.preventDefault();
    down.stopPropagation();
    const startMin = timeToMinutes(ev.time);
    const cols = ctx.getColumns();
    const col = cols.find((c) => c.date === ev.date) || cols[0];
    let dragging = false;
    let endPending = null;
    safeCapture(handle, down.pointerId);

    function onMove(e) {
      const dy = e.clientY - down.clientY;
      if (!dragging && Math.abs(dy) < THRESHOLD) return;
      dragging = true;
      blockEl.classList.add('dragging');
      const raw = topToMinutes(e.clientY - col.rect.top, ctx.opts);
      const endMin = Math.max(startMin + ctx.snapStep, snapMinutes(raw, ctx.snapStep));
      blockEl.style.height = ((endMin - startMin) / 60) * ctx.opts.hourHeight + 'px';
      endPending = endMin;
    }

    function onUp() {
      safeRelease(handle, down.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      blockEl.classList.remove('dragging');
      if (!dragging || endPending == null) return;
      ctx.onCommit(ev.id, { endTime: minutesToTime(endPending) });
    }

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  }
}

function columnAt(cols, clientX) {
  return cols.find((c) => clientX >= c.rect.left && clientX < c.rect.right);
}
