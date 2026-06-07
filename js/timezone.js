// 旅行期間（2026年9月）固定の UTC オフセット（時間）
export const OFFSETS = {
  '東京': 9,
  '韓国': 9,
  'ロンドン': 1,
  'パリ': 2,
  'ヴェネチア': 2,
  'ローマ': 2,
};

const JAPAN_OFFSET = 9;

function pad(n) {
  return String(n).padStart(2, '0');
}

// 現地時刻を日本時刻へ変換。{ time: 'HH:MM', dayDiff: -1|0|1 } を返す
export function toJapanTime(city, dateStr, timeStr) {
  const offset = OFFSETS[city];
  if (offset === undefined) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m + (JAPAN_OFFSET - offset) * 60;
  let dayDiff = 0;
  let mins = totalMin;
  while (mins < 0) { mins += 1440; dayDiff -= 1; }
  while (mins >= 1440) { mins -= 1440; dayDiff += 1; }
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return { time: `${pad(hh)}:${pad(mm)}`, dayDiff };
}

// 「現地 / 🇯🇵日本」併記文字列。未知都市は現地のみ。
export function formatLocalAndJapan(city, dateStr, timeStr) {
  const jp = toJapanTime(city, dateStr, timeStr);
  if (!jp) return timeStr;
  let suffix = '';
  if (jp.dayDiff > 0) suffix = `(+${jp.dayDiff})`;
  else if (jp.dayDiff < 0) suffix = `(${jp.dayDiff})`;
  return `${timeStr} / 🇯🇵${jp.time}${suffix}`;
}
