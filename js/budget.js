const sum = (items, key) =>
  items.reduce((acc, it) => acc + (Number(it[key]) || 0), 0);

export function totalPlanned(items) {
  return sum(items, 'planned');
}

export function totalActual(items) {
  return sum(items, 'actual');
}

export function perPerson(total, people = 2) {
  return Math.floor(total / people);
}

export function toEUR(yen, rate) {
  return Math.round((yen / rate) * 10) / 10;
}

export function remaining(items) {
  return totalPlanned(items) - totalActual(items);
}

// 料金カテゴリの固定リスト（編集シートの選択肢・集計表示順）
export const COST_CATEGORIES = ['航空券', 'ホテル', '食事', '交通', '観光チケット', 'Wi-Fi・eSIM', '海外保険', '前撮り', 'その他'];

// events の cost 総和
export function totalCost(events) {
  return events.reduce((acc, e) => acc + (Number(e.cost) || 0), 0);
}

// cost>0 の予定をカテゴリ別に集計。COST_CATEGORIES 順、未知/空は「未分類」として末尾に1件
export function costByCategory(events) {
  const map = new Map();
  let uncategorized = 0;
  for (const e of events) {
    const c = Number(e.cost) || 0;
    if (c <= 0) continue;
    const cat = e.costCategory;
    if (cat && COST_CATEGORIES.includes(cat)) {
      map.set(cat, (map.get(cat) || 0) + c);
    } else {
      uncategorized += c;
    }
  }
  const out = [];
  for (const cat of COST_CATEGORIES) {
    if (map.has(cat)) out.push({ category: cat, amount: map.get(cat) });
  }
  if (uncategorized > 0) out.push({ category: '未分類', amount: uncategorized });
  return out;
}
