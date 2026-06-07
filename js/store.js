import { SEED } from './seed.js';

const KEY = 'honeymoon-planner-state';
let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('state load failed, using seed', e);
  }
  return structuredClone(SEED);
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('state persist failed', e);
  }
}

export function getState() {
  return state;
}

// updater(state) を受け取り state を書き換える。保存＋通知。
export function update(updater) {
  updater(state);
  if (state.meta) state.meta.updatedAt = Date.now();
  persist();
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}

// 開発用：シードに戻す
export function resetToSeed() {
  state = structuredClone(SEED);
  persist();
  notify();
}
