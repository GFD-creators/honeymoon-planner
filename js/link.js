// 行き先（sight）↔ 予定（event）のリンク解決。純粋関数。
export function findLinkedEvent(events, sight) {
  if (!sight || !sight.eventId) return null;
  return events.find((e) => e.id === sight.eventId) || null;
}

export function isScheduled(events, sight) {
  return findLinkedEvent(events, sight) != null;
}

// sights のうち eventId を持つものの id 配列を返す
export function linkedEventIds(sights) {
  return sights.filter((s) => s && s.eventId).map((s) => s.eventId);
}
