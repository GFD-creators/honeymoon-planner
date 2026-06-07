import { SEED } from './seed.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const KEY = 'honeymoon-planner-state';
let state = loadLocal();
let tripRef = null;
let applyingRemote = false;
const listeners = new Set();

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return structuredClone(SEED);
}

function persistLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

// URLの ?trip=xxxx を取得（無ければ生成してURLに付与）
function getTripId() {
  const url = new URL(location.href);
  let id = url.searchParams.get('trip');
  if (!id) {
    id = 't-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    url.searchParams.set('trip', id);
    history.replaceState(null, '', url.toString());
  }
  return id;
}

export async function initSync() {
  const tripId = getTripId();
  tripRef = doc(db, 'trips', tripId);
  const snap = await getDoc(tripRef);
  if (snap.exists()) {
    state = snap.data();
    persistLocal();
    notify();
  } else {
    await setDoc(tripRef, state); // 初回：ローカル（シード）をクラウドへ
  }
  onSnapshot(tripRef, (s) => {
    if (!s.exists()) return;
    applyingRemote = true;
    state = s.data();
    persistLocal();
    notify();
    applyingRemote = false;
  });
}

export function getState() { return state; }

export function update(updater) {
  updater(state);
  if (state.meta) state.meta.updatedAt = Date.now();
  persistLocal();
  notify();
  if (tripRef && !applyingRemote) {
    setDoc(tripRef, state).catch((e) => console.warn('cloud save failed', e));
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() { for (const fn of listeners) fn(state); }

export function shareUrl() { return location.href; }
