'use strict';

/* ============================================================
   Görevlerim — küçük ama tam işlevli görev takip uygulaması
   Veriler tarayıcının localStorage'ında tutulur.
   ============================================================ */

const STORAGE_KEY = 'gorevler.v1';
const THEME_KEY = 'gorevler.theme';

const CATEGORIES = [
  { id: 'is', name: 'İş', color: '#6366f1' },
  { id: 'kisisel', name: 'Kişisel', color: '#10b981' },
  { id: 'alisveris', name: 'Alışveriş', color: '#f59e0b' },
  { id: 'saglik', name: 'Sağlık', color: '#f43f5e' },
  { id: 'ogrenme', name: 'Öğrenme', color: '#0ea5e9' },
  { id: 'diger', name: 'Diğer', color: '#8b5cf6' },
];

const ICONS = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l4.5 4.5L19.5 6.5"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M5 21V4"/><path d="M5 5h11l-1.5 4L19 13H5"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h10a5 5 0 0 1 0 10H8"/><path d="M8 5L4 9l4 4"/></svg>',
};

/* ---------------- Yardımcılar ---------------- */

const $ = (sel) => document.querySelector(sel);

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 't' + Date.now() + Math.random().toString(16).slice(2));

function todayISO() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function shiftISO(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

const trLower = (text) => String(text).toLocaleLowerCase('tr');

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

/* ---------------- Durum ---------------- */

const state = {
  todos: [],
  archive: [],
  filter: 'all',
  category: 'all',
  query: '',
};

let editingId = null;
let lastRemoved = null;

function load() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* localStorage kullanılamıyorsa uygulama bellekte çalışır */
  }

  if (!stored) {
    state.todos = seedTodos();
    persist();
    return;
  }

  const parsed = safeParse(stored, null);
  if (parsed && Array.isArray(parsed.todos)) {
    state.todos = parsed.todos.map(normalizeTodo).filter(Boolean);
  }
  if (parsed && Array.isArray(parsed.archive)) {
    state.archive = parsed.archive.map(normalizeTodo).filter(Boolean);
  }
}

function normalizeTodo(raw) {
  if (!raw || typeof raw.title !== 'string') return null;
  return {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    title: raw.title.slice(0, 140),
    category: CATEGORIES.some((c) => c.id === raw.category) ? raw.category : 'diger',
    priority: ['low', 'normal', 'high'].includes(raw.priority) ? raw.priority : 'normal',
    due: typeof raw.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.due) ? raw.due : '',
    done: Boolean(raw.done),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    completedAt: typeof raw.completedAt === 'number' ? raw.completedAt : null,
    archivedAt: typeof raw.archivedAt === 'number' ? raw.archivedAt : null,
  };
}

function seedTodos() {
  const today = todayISO();
  return [
    { id: uid(), title: 'Uygulamayı tarayıcıda aç ve dene', category: 'is', priority: 'high', due: today, done: false, createdAt: Date.now() },
    { id: uid(), title: 'Bir görevi tamamlandı olarak işaretle', category: 'kisisel', priority: 'normal', due: '', done: false, createdAt: Date.now() - 1 },
    { id: uid(), title: 'Görevleri sürükleyerek sırala', category: 'ogrenme', priority: 'low', due: shiftISO(today, 2), done: false, createdAt: Date.now() - 2 },
  ];
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ todos: state.todos, archive: state.archive }));
  } catch {
    /* kota ya da izin hatası: sessizce yoksay */
  }
}

/* ---------------- Görünür liste ---------------- */

function visibleTodos() {
  const q = trLower(state.query.trim());
  return state.todos.filter((t) => {
    if (state.filter === 'active' && t.done) return false;
    if (state.filter === 'done' && !t.done) return false;
    if (state.category !== 'all' && t.category !== state.category) return false;
    if (q && !trLower(t.title).includes(q)) return false;
    return true;
  });
}

/* ---------------- Parça üreticileri ---------------- */

function dueBadge(todo) {
  if (!todo.due) return '';
  const today = todayISO();
  let cls = '';
  if (!todo.done) {
    if (todo.due < today) cls = 'is-overdue';
    else if (todo.due === today) cls = 'is-today';
  }
  const label =
    todo.due === today
      ? 'Bugün'
      : todo.due === shiftISO(today, 1)
        ? 'Yarın'
        : todo.due === shiftISO(today, -1)
          ? 'Dün'
          : new Date(todo.due + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return `<span class="badge due ${cls}">${ICONS.calendar}${esc(label)}</span>`;
}

function priorityBadge(todo) {
  if (todo.priority === 'high') return `<span class="badge prio-high">${ICONS.flag}Yüksek</span>`;
  if (todo.priority === 'low') return `<span class="badge prio-low">${ICONS.flag}Düşük</span>`;
  return '';
}

function itemHTML(todo) {
  const cat = categoryOf(todo.category);
  const isEditing = editingId === todo.id;
  const titleHTML = isEditing
    ? `<input class="edit-input" type="text" maxlength="140" value="${esc(todo.title)}" aria-label="Görev başlığını düzenle">`
    : `<p class="todo-title" data-action="edit" title="Düzenlemek için tıkla">${esc(todo.title)}</p>`;

  return `
    <li class="todo${todo.done ? ' is-done' : ''}" data-id="${esc(todo.id)}" data-priority="${todo.priority}" draggable="true">
      <span class="drag-handle" aria-hidden="true" title="Sürükleyerek sırala">${ICONS.grip}</span>
      <label class="check" title="${todo.done ? 'Tamamlanmadı yap' : 'Tamamlandı yap'}">
        <input type="checkbox" data-action="toggle" ${todo.done ? 'checked' : ''}
               aria-label="${esc(todo.title)} görevini ${todo.done ? 'tamamlanmadı' : 'tamamlandı'} olarak işaretle">
        <span class="box">${ICONS.check}</span>
      </label>
      <div class="todo-body">
        ${titleHTML}
        <div class="meta">
          <span class="badge category" style="--chip-color:${cat.color}">${esc(cat.name)}</span>
          ${dueBadge(todo)}
          ${priorityBadge(todo)}
        </div>
      </div>
      <div class="todo-actions">
        <button class="act-btn" type="button" data-action="edit" title="Düzenle" aria-label="Düzenle">${ICONS.pencil}</button>
        <button class="act-btn danger" type="button" data-action="delete" title="Sil" aria-label="Sil">${ICONS.trash}</button>
      </div>
    </li>`;
}

/* ---------------- Render ---------------- */

function render() {
  const list = $('#todoList');
  const visible = visibleTodos();

  list.innerHTML = visible.map(itemHTML).join('');

  const empty = $('#emptyState');
  empty.hidden = visible.length > 0;
  if (visible.length === 0) {
    const hasAny = state.todos.length > 0;
    $('#emptyTitle').textContent = hasAny ? 'Sonuç bulunamadı' : 'Henüz görev yok';
    $('#emptyText').textContent = hasAny
      ? 'Arama veya filtreleri değiştirerek tekrar dene.'
      : 'Yukarıdaki alandan ilk görevini ekleyerek başla.';
  }

  renderCounts();
  renderChips();
  renderProgress();
  renderFooter();

  if (!$('#archiveModal').hidden) renderArchive();

  if (editingId) {
    const input = list.querySelector('.edit-input');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    } else {
      editingId = null;
    }
  }
}

function renderCounts() {
  const all = state.todos.length;
  const done = state.todos.filter((t) => t.done).length;
  document.querySelector('[data-count="all"]').textContent = all;
  document.querySelector('[data-count="active"]').textContent = all - done;
  document.querySelector('[data-count="done"]').textContent = done;

  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.filter === state.filter;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
}

function renderChips() {
  const container = $('#categoryChips');
  const used = new Set(state.todos.map((t) => t.category));
  const items = [{ id: 'all', name: 'Tümü', color: 'var(--primary)' }, ...CATEGORIES.filter((c) => used.has(c.id))];

  container.innerHTML = items
    .map((cat) => {
      const active = state.category === cat.id;
      const dot = cat.id === 'all' ? '' : '<span class="dot"></span>';
      return `<button type="button" class="chip${active ? ' is-active' : ''}" data-cat="${esc(cat.id)}"
                      style="--chip-color:${cat.color}" aria-pressed="${active}">${dot}${esc(cat.name)}</button>`;
    })
    .join('');
}

function renderProgress() {
  const all = state.todos.length;
  const done = state.todos.filter((t) => t.done).length;
  const pct = all === 0 ? 0 : Math.round((done / all) * 100);

  $('#progressLabel').textContent = `${done} / ${all} tamamlandı`;
  $('#progressPct').textContent = `%${pct}`;

  const fill = $('#progressFill');
  fill.style.width = pct + '%';
  fill.classList.toggle('is-complete', pct === 100 && all > 0);
}

function renderFooter() {
  const visible = visibleTodos().length;
  $('#footerCount').textContent = `${visible} görev gösteriliyor`;
  $('#clearDone').disabled = !state.todos.some((t) => t.done);
  $('#archiveCount').textContent = state.archive.length;
}

/* ---------------- İşlemler ---------------- */

function addTodo(title, category, priority, due) {
  const text = title.trim();
  if (!text) return;

  state.todos.unshift({
    id: uid(),
    title: text.slice(0, 140),
    category: CATEGORIES.some((c) => c.id === category) ? category : 'diger',
    priority: ['low', 'normal', 'high'].includes(priority) ? priority : 'normal',
    due,
    done: false,
    createdAt: Date.now(),
  });

  persist();
  render();
}

function toggleTodo(id) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  todo.done = !todo.done;
  todo.completedAt = todo.done ? Date.now() : null;
  persist();
  render();
}

function startEdit(id) {
  editingId = id;
  render();
}

function commitEdit(value) {
  if (!editingId) return;
  const todo = state.todos.find((t) => t.id === editingId);
  const text = value.trim();
  if (todo && text) todo.title = text.slice(0, 140);
  editingId = null;
  persist();
  render();
}

function cancelEdit() {
  if (!editingId) return;
  editingId = null;
  render();
}

function deleteTodo(id) {
  const index = state.todos.findIndex((t) => t.id === id);
  if (index < 0) return;
  const [removed] = state.todos.splice(index, 1);
  lastRemoved = { entries: [{ todo: removed, index }] };
  persist();
  render();
  showToast('Görev silindi', [{ label: 'Geri al', handler: undoLastRemoved }]);
}

/* Tamamlanan görevler silinmez; arşive taşınır. */
function clearCompleted() {
  const entries = [];
  state.todos.forEach((todo, index) => {
    if (todo.done) entries.push({ todo, index });
  });
  if (entries.length === 0) return;

  const now = Date.now();
  const archived = entries.map(({ todo }) => ({
    ...todo,
    completedAt: todo.completedAt || now,
    archivedAt: now,
  }));

  state.todos = state.todos.filter((t) => !t.done);
  state.archive = [...archived, ...state.archive];
  lastRemoved = { entries };
  persist();
  render();
  showToast(`${entries.length} görev arşive taşındı`, [
    { label: 'Geri al', handler: undoLastRemoved },
    { label: 'Arşivi aç', handler: openArchive },
  ]);
}

/* Silinen / arşivlenen görevleri, sıralamayı bozmadan geri koyar. */
function undoLastRemoved() {
  if (!lastRemoved) return;
  const ids = new Set(lastRemoved.entries.map((entry) => entry.todo.id));
  if (ids.size > 0) state.archive = state.archive.filter((t) => !ids.has(t.id));

  const entries = [...lastRemoved.entries].sort((a, b) => a.index - b.index);
  for (const { todo, index } of entries) {
    todo.archivedAt = null;
    state.todos.splice(Math.min(index, state.todos.length), 0, todo);
  }
  lastRemoved = null;
  persist();
  render();
}

/* ---------------- Arşiv ---------------- */

const PRIORITY_LABELS = { low: 'Düşük', normal: 'Orta', high: 'Yüksek' };

function formatStamp(ts) {
  return new Date(ts).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function archiveSorted() {
  return [...state.archive].sort(
    (a, b) => (b.completedAt || b.archivedAt || 0) - (a.completedAt || a.archivedAt || 0),
  );
}

function renderArchive() {
  const list = archiveSorted();
  const hasItems = list.length > 0;

  $('#archiveBody').innerHTML = list
    .map((todo) => {
      const cat = categoryOf(todo.category);
      const stamp = todo.completedAt || todo.archivedAt;
      return `
        <tr data-id="${esc(todo.id)}">
          <td class="title">${esc(todo.title)}</td>
          <td><span class="badge category" style="--chip-color:${cat.color}">${esc(cat.name)}</span></td>
          <td class="muted-cell">${esc(PRIORITY_LABELS[todo.priority] || 'Orta')}</td>
          <td class="muted-cell">${stamp ? esc(formatStamp(stamp)) : '—'}</td>
          <td class="act">
            <button class="restore-btn" type="button" data-action="restore" data-id="${esc(todo.id)}">
              ${ICONS.undo}Geri yükle
            </button>
          </td>
        </tr>`;
    })
    .join('');

  document.querySelector('.archive-table').hidden = !hasItems;
  $('#archiveEmpty').hidden = hasItems;
  $('#archiveSubtitle').textContent = hasItems
    ? `Arşivde ${list.length} görev · en son tamamlananlar üstte`
    : 'Arşivde görev yok';

  $('#exportArchive').disabled = !hasItems;
  $('#restoreAll').disabled = !hasItems;
  $('#wipeArchive').disabled = !hasItems;
  $('#exportAll').disabled = state.todos.length + state.archive.length === 0;
}

function openArchive() {
  const modal = $('#archiveModal');
  if (!modal.hidden) return;
  renderArchive();
  modal.hidden = false;
  document.body.classList.add('modal-open');
  $('#closeArchive').focus();
}

function closeArchive() {
  const modal = $('#archiveModal');
  if (modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  resetWipeConfirm();
  $('#openArchive').focus();
}

function restoreArchived(id) {
  const index = state.archive.findIndex((t) => t.id === id);
  if (index < 0) return;
  const [todo] = state.archive.splice(index, 1);
  todo.archivedAt = null;
  state.todos.unshift(todo);
  persist();
  render();
  showToast('Görev listeye geri yüklendi', []);
}

function restoreAllArchived() {
  if (state.archive.length === 0) return;
  const count = state.archive.length;
  const items = state.archive
    .splice(0, state.archive.length)
    .map((todo) => ({ ...todo, archivedAt: null }))
    .reverse(); // eskiden yeniye: listenin başına eklerken sıralama korunur
  state.todos = [...items, ...state.todos];
  persist();
  render();
  showToast(`${count} görev listeye geri yüklendi`, []);
}

let wipeTimer = null;

function resetWipeConfirm() {
  clearTimeout(wipeTimer);
  const button = $('#wipeArchive');
  if (!button) return;
  button.classList.remove('is-confirming');
  button.textContent = 'Arşivi temizle';
}

function handleWipeArchive() {
  const button = $('#wipeArchive');
  if (!button.classList.contains('is-confirming')) {
    button.classList.add('is-confirming');
    button.textContent = 'Emin misin? Tekrar bas';
    clearTimeout(wipeTimer);
    wipeTimer = setTimeout(resetWipeConfirm, 4000);
    return;
  }

  const count = state.archive.length;
  state.archive = [];
  resetWipeConfirm();
  persist();
  render();
  showToast(`${count} görev kalıcı olarak silindi`, []);
}

/* ---------------- Excel (xlsx) dışa aktarma ---------------- */

function isoDateTime(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function exportColumns(withStatus) {
  const columns = [
    { header: 'Görev', width: 48 },
    { header: 'Kategori', width: 15 },
    { header: 'Öncelik', width: 11 },
    { header: 'Bitiş Tarihi', width: 14, type: 'date' },
    { header: 'Tamamlanma Tarihi', width: 20, type: 'datetime' },
  ];
  if (withStatus) columns.push({ header: 'Durum', width: 14 });
  return columns;
}

function exportRows(items, withStatus) {
  return items.map((todo) => {
    const row = [
      todo.title,
      categoryOf(todo.category).name,
      PRIORITY_LABELS[todo.priority] || 'Orta',
      todo.due || '',
      todo.completedAt ? isoDateTime(todo.completedAt) : '',
    ];
    if (withStatus) row.push(todo.archivedAt ? 'Arşiv' : todo.done ? 'Tamamlandı' : 'Aktif');
    return row;
  });
}

function downloadWorkbook(items, withStatus, prefix, sheetName) {
  if (items.length === 0) {
    showToast('Aktarılacak görev yok', []);
    return;
  }

  let blob;
  try {
    blob = XLSX.create([{ name: sheetName, columns: exportColumns(withStatus), rows: exportRows(items, withStatus) }]);
  } catch (error) {
    console.error(error);
    showToast('Dosya oluşturulamadı', []);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${prefix}-${todayISO()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);

  showToast('Excel dosyası indirildi', []);
}

/* ---------------- Toast ---------------- */

let toastTimer = null;

function showToast(message, actions = []) {
  const toast = $('#toast');
  const container = $('#toastActions');

  $('#toastMsg').textContent = message;
  container.innerHTML = '';

  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-btn';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      hideToast();
      action.handler();
    });
    container.appendChild(button);
  }

  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 7000);
}

function hideToast() {
  const toast = $('#toast');
  toast.classList.remove('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (!toast.classList.contains('is-visible')) toast.hidden = true;
  }, 240);
}

/* ---------------- Tema ---------------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* yoksay */
  }
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    /* yoksay */
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = saved === 'dark' || saved === 'light' ? saved : prefersDark ? 'dark' : 'light';
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

/* ---------------- Sürükle-bırak ---------------- */

let dragState = null;

function clearDropMarkers() {
  document.querySelectorAll('.todo.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
  document.querySelectorAll('.todo.is-dragging').forEach((el) => el.classList.remove('is-dragging'));
}

/* ---------------- Başlat ---------------- */

function init() {
  initTheme();
  load();

  const dateLabel = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  $('#todayLabel').textContent = dateLabel;

  // Kategori seçenekleri
  const categorySelect = $('#categoryInput');
  categorySelect.innerHTML = CATEGORIES.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  categorySelect.value = 'kisisel';

  const list = $('#todoList');

  // ---- Ekleme ----
  $('#todoForm').addEventListener('submit', (event) => {
    event.preventDefault();
    addTodo($('#titleInput').value, categorySelect.value, $('#priorityInput').value, $('#dueInput').value);
    $('#titleInput').value = '';
    $('#dueInput').value = '';
    $('#titleInput').focus();
  });

  // ---- Filtreler ----
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.filter = tab.dataset.filter;
      render();
    });
  });

  $('#searchInput').addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
  });

  $('#searchInput').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.target.value = '';
      state.query = '';
      render();
    }
  });

  $('#categoryChips').addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    state.category = state.category === chip.dataset.cat ? 'all' : chip.dataset.cat;
    render();
  });

  // ---- Liste etkileşimleri ----
  list.addEventListener('click', (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const item = actionEl.closest('.todo');
    if (!item) return;
    const id = item.dataset.id;
    const action = actionEl.dataset.action;

    if (action === 'edit') startEdit(id);
    else if (action === 'delete') deleteTodo(id);
  });

  list.addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[data-action="toggle"]');
    if (!checkbox) return;
    const item = checkbox.closest('.todo');
    if (item) toggleTodo(item.dataset.id);
  });

  list.addEventListener('keydown', (event) => {
    if (!event.target.classList.contains('edit-input')) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      commitEdit(event.target.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  });

  list.addEventListener(
    'blur',
    (event) => {
      if (event.target.classList.contains('edit-input')) commitEdit(event.target.value);
    },
    true,
  );

  // ---- Sürükle-bırak ----
  list.addEventListener('dragstart', (event) => {
    const item = event.target.closest('.todo');
    if (!item) return;
    dragState = { id: item.dataset.id, target: null, after: false };
    item.classList.add('is-dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', dragState.id);
    }
  });

  list.addEventListener('dragover', (event) => {
    if (!dragState) return;
    const item = event.target.closest('.todo');
    if (!item) return;
    event.preventDefault();
    if (item.dataset.id === dragState.id) {
      dragState.target = null;
      clearDropMarkers();
      list.querySelector(`.todo[data-id="${CSS.escape(dragState.id)}"]`)?.classList.add('is-dragging');
      return;
    }
    const rect = item.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    if (dragState.target !== item.dataset.id) {
      clearDropMarkers();
      list.querySelector(`.todo[data-id="${CSS.escape(dragState.id)}"]`)?.classList.add('is-dragging');
    }
    dragState.target = item.dataset.id;
    dragState.after = after;
    item.classList.add('is-drop-target');
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });

  list.addEventListener('dragleave', (event) => {
    const item = event.target.closest('.todo');
    if (item) item.classList.remove('is-drop-target');
  });

  list.addEventListener('drop', (event) => {
    if (!dragState || !dragState.target) return;
    event.preventDefault();
    const { id, target, after } = dragState;
    dragState = null;
    clearDropMarkers();

    const from = state.todos.findIndex((t) => t.id === id);
    if (from < 0) return;
    const [item] = state.todos.splice(from, 1);
    const targetIndex = state.todos.findIndex((t) => t.id === target);
    if (targetIndex < 0) {
      state.todos.splice(from, 0, item);
      return;
    }
    state.todos.splice(after ? targetIndex + 1 : targetIndex, 0, item);
    persist();
    render();
  });

  list.addEventListener('dragend', () => {
    dragState = null;
    clearDropMarkers();
  });

  // ---- Diğer ----
  $('#clearDone').addEventListener('click', clearCompleted);
  $('#themeToggle').addEventListener('click', toggleTheme);

  // ---- Arşiv ----
  $('#openArchive').addEventListener('click', openArchive);
  $('#archiveModal').addEventListener('click', (event) => {
    if (event.target.dataset.close) closeArchive();
  });
  $('#archiveBody').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="restore"]');
    if (button) restoreArchived(button.dataset.id);
  });
  $('#restoreAll').addEventListener('click', restoreAllArchived);
  $('#wipeArchive').addEventListener('click', handleWipeArchive);

  $('#exportArchive').addEventListener('click', () => {
    downloadWorkbook(archiveSorted(), false, 'gorevler-arsiv', 'Tamamlananlar');
  });
  $('#exportAll').addEventListener('click', () => {
    downloadWorkbook([...state.todos, ...archiveSorted()], true, 'gorevler-tumu', 'Görevler');
  });

  document.addEventListener('keydown', (event) => {
    const modalOpen = !$('#archiveModal').hidden;
    const tag = (event.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || event.target.isContentEditable;

    if (event.key === 'Escape' && modalOpen) {
      event.preventDefault();
      closeArchive();
      return;
    }

    if (event.key === 'Escape' && !typing) {
      editingId = null;
      if (state.query) {
        state.query = '';
        $('#searchInput').value = '';
      }
      render();
      return;
    }

    if (!typing && !modalOpen && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'd') {
        event.preventDefault();
        toggleTheme();
      } else if (key === 'n') {
        event.preventDefault();
        $('#titleInput').focus();
      }
    }
  });

  render();
}

init();
