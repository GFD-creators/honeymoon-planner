import { update } from './store.js';
import { openEditor } from './editor.js';
import { findLinkedEvent } from './link.js';

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

      const actions = document.createElement('div');
      actions.className = 'sight-actions';
      const linked = findLinkedEvent(state.events, sight);

      if (linked) {
        const when = linked.time
          ? `${linked.date.slice(5).replace('-', '/')} ${linked.time}`
          : `${linked.date.slice(5).replace('-', '/')} 終日`;
        const sched = document.createElement('button');
        sched.className = 'sight-schedule';
        sched.textContent = `🗓 ${when}`;
        sched.addEventListener('click', () => openEditor(linked));

        const unlink = document.createElement('button');
        unlink.className = 'sight-unlink';
        unlink.textContent = '解除';
        unlink.addEventListener('click', () => {
          update((s) => {
            const c = s.cities.find((x) => x.name === city.name);
            const sgt = c && c.sights[i];
            if (sgt && sgt.eventId) {
              const idx = s.events.findIndex((e) => e.id === sgt.eventId);
              if (idx >= 0) s.events.splice(idx, 1);
              delete sgt.eventId;
            }
          });
        });
        actions.append(sched, unlink);
      } else {
        if (sight.eventId) {
          // リンク切れ：stale な eventId を遅延クリア（再描画の再入を避ける）
          Promise.resolve().then(() => {
            update((s) => {
              const c = s.cities.find((x) => x.name === city.name);
              const sgt = c && c.sights[i];
              if (sgt && sgt.eventId && !s.events.some((e) => e.id === sgt.eventId)) delete sgt.eventId;
            });
          });
        }
        const addBtn = document.createElement('button');
        addBtn.className = 'sight-add';
        addBtn.textContent = '🗓 旅程に追加';
        addBtn.addEventListener('click', () => {
          openEditor(null, {
            defaultDate: state.meta?.startDate || '2026-09-12',
            defaultTime: '10:00',
            prefill: { title: sight.name, city: city.name, type: 'sightseeing' },
            onSaved: (id) => update((s) => {
              const c = s.cities.find((x) => x.name === city.name);
              if (c && c.sights[i]) c.sights[i].eventId = id;
            }),
          });
        });
        actions.appendChild(addBtn);
      }
      row.appendChild(actions);
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
