// 週・時刻の純粋計算。副作用なし。日付演算はUTC基準でタイムゾーン非依存。

const DAY_MS = 86400000;

function pad(n) { return String(n).padStart(2, '0'); }

function dateToUTC(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToDateStr(ms) {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// その日付が属する週（日曜起点）の日曜の日付
export function weekStartSunday(dateStr) {
  const ms = dateToUTC(dateStr);
  const dow = new Date(ms).getUTCDay(); // 0=Sun
  return utcToDateStr(ms - dow * DAY_MS);
}

// 日曜起点の7日分
export function weekDays(weekStartStr) {
  const ms = dateToUTC(weekStartStr);
  const out = [];
  for (let i = 0; i < 7; i++) out.push(utcToDateStr(ms + i * DAY_MS));
  return out;
}

// 週起点を n 週ずらす
export function addWeeks(weekStartStr, n) {
  return utcToDateStr(dateToUTC(weekStartStr) + n * 7 * DAY_MS);
}

// 'HH:MM' -> 分
export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// 分 -> グリッド上部からのpxオフセット
export function minutesToTop(min, opts) {
  const { startHour, hourHeight } = opts;
  return ((min - startHour * 60) / 60) * hourHeight;
}

// ブロック高さpx。終了なしは既定60分。最小は30分相当。
export function blockHeight(startStr, endStr, opts) {
  const { hourHeight } = opts;
  const start = timeToMinutes(startStr);
  let dur = 60;
  if (endStr) {
    const end = timeToMinutes(endStr);
    dur = end > start ? end - start : 60;
  }
  return Math.max((dur / 60) * hourHeight, hourHeight * 0.5);
}

// 時刻あり/終日（time が空）に分割
export function splitTimedAllDay(events) {
  const timed = [];
  const allDay = [];
  for (const ev of events) {
    if (ev.time) timed.push(ev); else allDay.push(ev);
  }
  return { timed, allDay };
}
