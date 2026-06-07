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
