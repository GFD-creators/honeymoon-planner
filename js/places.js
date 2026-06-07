import { update } from './store.js';

export function renderPlaces(root, state) {
  for (const city of state.cities) {
    const card = document.createElement('div');
    card.className = 'card';
    const doneCount = city.sights.filter((s) => s.done).length;
    card.innerHTML =
      `<div class="day-head" style="margin:0 0 6px">` +
      `<span class="date">${city.name}</span>` +
      `<span class="weekday">${city.days}・${doneCount}/${city.sights.length} 達成</span></div>`;

    city.sights.forEach((sight, i) => {
      const row = document.createElement('div');
      row.className = 'sight' + (sight.done ? ' done' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = sight.done;
      cb.id = `${city.name}-${i}`;
      cb.addEventListener('change', () => {
        update((s) => {
          const c = s.cities.find((x) => x.name === city.name);
          if (c) c.sights[i].done = cb.checked;
        });
      });
      const label = document.createElement('label');
      label.setAttribute('for', cb.id);
      label.textContent = sight.name;
      row.appendChild(cb);
      row.appendChild(label);
      card.appendChild(row);
    });

    const add = document.createElement('button');
    add.className = 'link';
    add.textContent = '＋ 行きたい場所を追加';
    add.addEventListener('click', () => {
      const name = prompt(`${city.name}で行きたい場所`, '');
      if (!name) return;
      update((s) => {
        const c = s.cities.find((x) => x.name === city.name);
        if (c) c.sights.push({ name, done: false });
      });
    });
    card.appendChild(add);
    root.appendChild(card);
  }
}
