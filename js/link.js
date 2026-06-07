// 行き先（sight）↔ 予定（event）のリンク解決。純粋関数。
export function findLinkedEvent(events, sight) {
  if (!sight || !sight.eventId) return null;
  return events.find((e) => e.id === sight.eventId) || null;
}

export function isScheduled(events, sight) {
  return findLinkedEvent(events, sight) != null;
}
