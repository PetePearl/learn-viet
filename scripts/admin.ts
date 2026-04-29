import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..');
const LESSONS_DIR = join(ROOT, 'src/data/lessons');
const CARDS_FILE = join(ROOT, 'src/data/cards.json');
const TAGS_FILE = join(ROOT, 'src/data/tags.json');
const IMAGES_DIR = join(ROOT, 'public/images');
const AUDIO_DIR = join(ROOT, 'public/audio');
const PORT = 3001;

// --- Утилиты ---

const CYR: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'j',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
};

function slugify(text: string): string {
  const translit = text.toLowerCase().split('').map(c => CYR[c] ?? c).join('');
  const result = translit
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return result || Date.now().toString(36);
}

function getLessons() {
  return readdirSync(LESSONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const data = JSON.parse(readFileSync(join(LESSONS_DIR, f), 'utf-8'));
      return { slug: data.slug, title: data.title, cards: data.cards.length };
    });
}

function getLesson(slug: string) {
  const path = join(LESSONS_DIR, `${slug}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function getNextLessonSlug(): string {
  const files = readdirSync(LESSONS_DIR).filter((f) => f.endsWith('.json'));
  const nums = files.map((f) => {
    const m = f.match(/lesson-(\d+)\.json/);
    return m ? parseInt(m[1]) : 0;
  });
  const next = Math.max(0, ...nums) + 1;
  return `lesson-${String(next).padStart(2, '0')}`;
}

async function downloadAudio(word: string, outputPath: string): Promise<boolean> {
  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=vi&client=tw-ob`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return false;
    writeFileSync(outputPath, Buffer.from(await res.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

async function searchUnsplash(query: string, page: number): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&page=${page}&orientation=squarish`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    const data = (await res.json()) as any;
    return data.results?.[0]?.urls?.small ?? null;
  } catch {
    return null;
  }
}

async function downloadImageFromUrl(url: string, outputPath: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    writeFileSync(outputPath, Buffer.from(await res.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

function saveCard(card: object, lessonSlug?: string) {
  if (lessonSlug) {
    const path = join(LESSONS_DIR, `${lessonSlug}.json`);
    if (!existsSync(path)) throw new Error(`Урок "${lessonSlug}" не найден`);
    const lesson = JSON.parse(readFileSync(path, 'utf-8'));
    lesson.cards.push(card);
    writeFileSync(path, JSON.stringify(lesson, null, 2) + '\n');
  } else {
    const cards = JSON.parse(readFileSync(CARDS_FILE, 'utf-8')) as object[];
    cards.push(card);
    writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2) + '\n');
  }
}

function pruneUnusedTags() {
  const lessonCards = readdirSync(LESSONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(LESSONS_DIR, f), 'utf-8')).cards as any[]);
  const standalone = JSON.parse(readFileSync(CARDS_FILE, 'utf-8')) as any[];
  const usedIds = new Set([...lessonCards, ...standalone].flatMap((c) => (c.tags ?? []).filter(Boolean)));
  const tags = JSON.parse(readFileSync(TAGS_FILE, 'utf-8')) as any[];
  const filtered = tags.filter((t: any) => usedIds.has(t.id));
  if (filtered.length !== tags.length) {
    writeFileSync(TAGS_FILE, JSON.stringify(filtered, null, 2) + '\n');
  }
}

// --- HTML ---

const HTML = /* html */ `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Viet Learn — Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      background: #fff;
      color: #111;
    }

    .layout {
      display: grid;
      grid-template-columns: 200px 1fr;
      min-height: 100vh;
    }

    .sidebar {
      border-right: 1px solid #ddd;
      padding: 32px 0;
      display: flex;
      flex-direction: column;
    }

    .sidebar-logo {
      font-size: 15px;
      font-weight: 700;
      padding: 0 20px 24px;
      border-bottom: 1px solid #ddd;
      margin-bottom: 8px;
      color: #c0392b;
    }

    .nav-item {
      display: block;
      padding: 8px 20px;
      font-size: 14px;
      color: #888;
      cursor: pointer;
      border: none;
      background: none;
      text-align: left;
      width: 100%;
      font: inherit;
    }

    .nav-item:hover { color: #111; }
    .nav-item.active { color: #111; font-weight: 600; }

    .content {
      padding: 40px 48px;
      max-width: 680px;
    }

    .page { display: none; flex-direction: column; gap: 32px; }
    .page.active { display: flex; }

    h1 { font-size: 22px; font-weight: 700; }
    h2 { font-size: 15px; font-weight: 600; }

    .form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    label { font-size: 13px; color: #888; }

    input, select, textarea {
      font: inherit;
      font-size: 15px;
      border: 1px solid #ddd;
      padding: 8px 10px;
      outline: none;
      width: 100%;
      background: #fff;
    }

    input:focus, select:focus, textarea:focus { border-color: #111; }

    .divider {
      font-size: 13px;
      color: #bbb;
      border-bottom: 1px solid #eee;
      padding-bottom: 8px;
    }

    .btn {
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      padding: 8px 20px;
      border: 1px solid #111;
      background: #fff;
      cursor: pointer;
      align-self: flex-start;
      white-space: nowrap;
    }

    .btn:hover { background: #111; color: #fff; }
    .btn:disabled { opacity: 0.4; cursor: default; background: #fff; color: #111; }

    .btn-ghost {
      font: inherit;
      font-size: 13px;
      padding: 4px 10px;
      border: 1px solid #ddd;
      background: #fff;
      cursor: pointer;
      white-space: nowrap;
    }

    .btn-ghost:hover { border-color: #111; }

    .btn-danger {
      font: inherit;
      font-size: 13px;
      padding: 4px 10px;
      border: 1px solid #ddd;
      background: #fff;
      color: #c0392b;
      cursor: pointer;
    }

    .btn-danger:hover { border-color: #c0392b; background: #c0392b; color: #fff; }

    .btn-link {
      font: inherit;
      font-size: 13px;
      color: #888;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
    }

    .btn-link:hover { color: #111; }

    /* Список уроков */
    .lessons-list {
      display: flex;
      flex-direction: column;
    }

    .lesson-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
      gap: 16px;
    }

    .lesson-row:first-child { border-top: 1px solid #eee; }

    .lesson-row-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .lesson-row-title { font-size: 14px; font-weight: 500; }
    .lesson-row-count { font-size: 12px; color: #bbb; }
    .lesson-row-actions { display: flex; gap: 8px; flex-shrink: 0; }

    /* Редактор урока */
    .edit-header {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .edit-title { font-size: 22px; font-weight: 700; flex: 1; }

    /* Список карточек в уроке */
    .cards-list {
      display: flex;
      flex-direction: column;
    }

    .card-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }

    .card-row:first-child { border-top: 1px solid #eee; }

    .card-row-img {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border: 1px solid #eee;
      flex-shrink: 0;
      background: #f5f5f5;
    }

    .card-row-info { flex: 1; min-width: 0; }
    .card-row-word { font-size: 14px; font-weight: 600; }
    .card-row-translation { font-size: 13px; color: #888; }
    .card-row-example { font-size: 12px; color: #bbb; }

    /* Уведомления */
    .notice {
      font-size: 13px;
      padding: 8px 12px;
      display: none;
    }

    .notice.visible { display: block; }
    .notice.ok { color: #2a7a2a; border: 1px solid #c3e6c3; }
    .notice.error { color: #c0392b; border: 1px solid #f5c0c0; }

    /* Превью карточки */
    .card-preview {
      border: 1px solid #ddd;
      padding: 16px;
      display: none;
      flex-direction: column;
      gap: 8px;
    }

    .card-preview.visible { display: flex; }
    .card-preview img { width: 100px; height: 100px; object-fit: cover; border: 1px solid #eee; }
    .card-word { font-size: 20px; font-weight: 700; }
    .card-translation { color: #888; font-size: 14px; }
    .card-example { font-size: 14px; }
    .card-example-tr { font-size: 13px; color: #888; }

    .file-status { display: flex; flex-direction: column; gap: 2px; }
    .file-status span { font-size: 13px; }
    .file-status .ok { color: #2a7a2a; }
    .file-status .fail { color: #bbb; }

    .img-picker { display: flex; gap: 12px; align-items: flex-start; }

    .img-picker-preview {
      width: 120px;
      height: 120px;
      border: 1px solid #ddd;
      background: #f5f5f5;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .img-picker-preview img { width: 100%; height: 100%; object-fit: cover; }
    .img-picker-preview-empty { font-size: 12px; color: #bbb; text-align: center; padding: 8px; }

    .img-picker-controls { display: flex; flex-direction: column; gap: 8px; justify-content: center; }

    /* Тег-пикер */
    .tag-picker { display: flex; flex-direction: column; gap: 8px; }

    .tag-selected { display: flex; flex-wrap: wrap; gap: 6px; min-height: 24px; }

    .tag-chip {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; padding: 2px 8px;
      border: 1px solid #ddd; background: #f5f5f5;
    }

    .tag-chip-remove {
      background: none; border: none; cursor: pointer;
      font-size: 14px; line-height: 1; color: #aaa; padding: 0;
    }
    .tag-chip-remove:hover { color: #c0392b; }

    .tag-input-wrap { position: relative; }

    .tag-input-wrap input {
      font: inherit; font-size: 14px;
      border: 1px solid #ddd; padding: 6px 10px;
      outline: none; width: 100%; background: #fff;
    }
    .tag-input-wrap input:focus { border-color: #111; }

    .tag-dropdown {
      display: none; position: absolute; top: 100%; left: 0; right: 0;
      border: 1px solid #ddd; border-top: none;
      background: #fff; z-index: 10; max-height: 180px; overflow-y: auto;
    }
    .tag-dropdown.open { display: block; }

    .tag-option {
      padding: 8px 12px; font-size: 14px; cursor: pointer;
    }
    .tag-option:hover { background: #f5f5f5; }
    .tag-option-create { color: #888; }

    .empty { font-size: 14px; color: #bbb; padding: 12px 0; }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-logo">Viet Learn</div>
      <button class="nav-item active" data-page="lessons">Уроки</button>
      <button class="nav-item" data-page="standalone">Без урока</button>
      <button class="nav-item" data-page="cards">Карточки</button>
    </aside>

    <main class="content">

      <!-- Страница: Уроки (список) -->
      <div class="page active" id="page-lessons">
        <h1>Уроки</h1>

        <div class="lessons-list" id="lessons-list"></div>

        <div style="display:flex;flex-direction:column;gap:16px;">
          <h2>Новый урок</h2>
          <form class="form" id="lesson-form">
            <div class="field">
              <label>Название *</label>
              <input name="title" required placeholder="Урок 2. Семья">
            </div>
            <div class="field">
              <label>Описание</label>
              <input name="description" placeholder="Члены семьи и приветствия">
            </div>
            <button class="btn" type="submit" id="lesson-btn">Создать урок</button>
            <div class="notice" id="lesson-notice"></div>
          </form>
        </div>
      </div>

      <!-- Страница: Редактирование урока -->
      <div class="page" id="page-edit">
        <div class="edit-header">
          <button class="btn-link" id="edit-back">← Уроки</button>
          <span class="edit-title" id="edit-lesson-title"></span>
        </div>

        <form class="form" id="edit-form">
          <div class="field">
            <label>Название *</label>
            <input name="title" required id="edit-title-input">
          </div>
          <div class="field">
            <label>Описание</label>
            <input name="description" id="edit-desc-input">
          </div>
          <div style="display:flex;gap:12px;align-items:center;">
            <button class="btn" type="submit" id="edit-save-btn">Сохранить</button>
            <div class="notice" id="edit-notice" style="margin:0;"></div>
          </div>
        </form>

        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <h2 id="edit-cards-title">Карточки</h2>
            <button class="btn-ghost" id="edit-add-card-btn">+ Добавить карточку</button>
          </div>
          <div class="cards-list" id="edit-cards-list"></div>
        </div>
      </div>

      <!-- Страница: Без урока -->
      <div class="page" id="page-standalone">
        <h1>Без урока</h1>
        <div class="cards-list" id="standalone-cards-list"></div>
      </div>

      <!-- Страница: Карточки -->
      <div class="page" id="page-cards">
        <h1>Новая карточка</h1>

        <form class="form" id="card-form">
          <div class="row">
            <div class="field">
              <label>Вьетнамское слово *</label>
              <input name="word" required placeholder="con chó">
            </div>
            <div class="field">
              <label>Перевод (русский) *</label>
              <input name="translation" required placeholder="собака">
            </div>
          </div>

          <div class="field">
            <label>Урок</label>
            <select name="lessonSlug" id="card-lesson-select">
              <option value="">Без урока</option>
            </select>
          </div>

          <p class="divider">Пример — необязательно</p>

          <div class="row">
            <div class="field">
              <label>Предложение (вьетнамский)</label>
              <input name="exampleSentence" placeholder="Con chó vui.">
            </div>
            <div class="field">
              <label>Перевод предложения</label>
              <input name="exampleTranslation" placeholder="Собака радостная.">
            </div>
          </div>

          <div class="field">
            <label>Теги</label>
            <div class="tag-picker" id="tag-picker">
              <div class="tag-selected" id="tag-selected"></div>
              <div class="tag-input-wrap">
                <input type="text" id="tag-input" placeholder="Поиск или новый тег..." autocomplete="off">
                <div class="tag-dropdown" id="tag-dropdown"></div>
              </div>
            </div>
            <input type="hidden" name="tags" id="tags-value" value="[]">
          </div>

          <p class="divider">Картинка — необязательно</p>

          <div class="field">
            <label>Поиск на Unsplash</label>
            <div class="img-picker">
              <div class="img-picker-preview" id="img-preview">
                <span class="img-picker-preview-empty">нет картинки</span>
              </div>
              <div class="img-picker-controls">
                <button class="btn-ghost" type="button" id="img-search-btn">Найти</button>
                <button class="btn-ghost" type="button" id="img-refresh-btn" style="display:none">Обновить</button>
                <button class="btn-ghost" type="button" id="img-clear-btn" style="display:none">Убрать</button>
              </div>
            </div>
            <input type="hidden" name="imageUrl" id="selected-image-url">
          </div>

          <button class="btn" type="submit" id="card-btn">Добавить карточку</button>
          <div class="notice" id="card-notice"></div>
        </form>

        <div class="card-preview" id="card-preview"></div>
      </div>

    </main>
  </div>

  <script>
    let currentEditSlug = null;
    const cardForm = document.getElementById('card-form');

    // --- Навигация ---
    function showPage(name) {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + name).classList.add('active');
      const navBtn = document.querySelector(\`.nav-item[data-page="\${name}"]\`);
      if (navBtn) navBtn.classList.add('active');
    }

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => showPage(btn.dataset.page));
    });

    // --- Загрузка уроков ---
    async function loadLessons() {
      const res = await fetch('/api/lessons');
      const lessons = await res.json();

      const list = document.getElementById('lessons-list');
      if (lessons.length === 0) {
        list.innerHTML = '<p class="empty">Уроков пока нет</p>';
      } else {
        list.innerHTML = lessons.map(l => \`
          <div class="lesson-row">
            <div class="lesson-row-info">
              <span class="lesson-row-title">\${l.title}</span>
              <span class="lesson-row-count">\${l.cards} карт.</span>
            </div>
            <div class="lesson-row-actions">
              <button class="btn-ghost" onclick="openEdit('\${l.slug}')">Редактировать</button>
            </div>
          </div>
        \`).join('');
      }

      const select = document.getElementById('card-lesson-select');
      const current = select.value;
      select.innerHTML = '<option value="">Без урока</option>' +
        lessons.map(l => \`<option value="\${l.slug}">\${l.title}</option>\`).join('');
      if (current) select.value = current;

      return lessons;
    }

    loadLessons();

    // --- Карточки без урока ---
    async function loadStandaloneCards() {
      const res = await fetch('/api/cards');
      const cards = await res.json();
      const list = document.getElementById('standalone-cards-list');
      if (cards.length === 0) {
        list.innerHTML = '<p class="empty">Карточек без урока нет</p>';
        return;
      }
      list.innerHTML = cards.map(c => \`
        <div class="card-row" id="standalone-row-\${c.id}">
          <img class="card-row-img" src="/images/\${c.illustration}" alt=""
               onerror="this.src='/images/placeholder.svg'">
          <div class="card-row-info">
            <div class="card-row-word">\${c.word}</div>
            <div class="card-row-translation">\${c.translation}</div>
            \${c.example ? \`<div class="card-row-example">\${c.example.sentence}</div>\` : ''}
          </div>
          <button class="btn-danger" onclick="deleteStandaloneCard('\${c.id}')">Удалить</button>
        </div>
      \`).join('');
    }

    async function deleteStandaloneCard(cardId) {
      if (!confirm('Удалить карточку?')) return;
      try {
        const res = await fetch(\`/api/cards/\${cardId}\`, { method: 'DELETE' });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        document.getElementById(\`standalone-row-\${cardId}\`)?.remove();
        if (!document.querySelector('#standalone-cards-list .card-row')) {
          document.getElementById('standalone-cards-list').innerHTML =
            '<p class="empty">Карточек без урока нет</p>';
        }
      } catch (err) {
        alert(err.message);
      }
    }

    document.querySelector('.nav-item[data-page="standalone"]').addEventListener('click', loadStandaloneCards);

    // --- Открыть редактор урока ---
    async function openEdit(slug) {
      currentEditSlug = slug;
      const res = await fetch(\`/api/lessons/\${slug}\`);
      const lesson = await res.json();

      document.getElementById('edit-lesson-title').textContent = lesson.title;
      document.getElementById('edit-title-input').value = lesson.title;
      document.getElementById('edit-desc-input').value = lesson.description || '';
      document.getElementById('edit-cards-title').textContent =
        \`Карточки (\${lesson.cards.length})\`;
      document.getElementById('edit-notice').className = 'notice';

      renderEditCards(lesson.cards);

      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-edit').classList.add('active');
    }

    function renderEditCards(cards) {
      const list = document.getElementById('edit-cards-list');
      if (cards.length === 0) {
        list.innerHTML = '<p class="empty">Карточек нет</p>';
        return;
      }
      list.innerHTML = cards.map(c => \`
        <div class="card-row" id="card-row-\${c.id}">
          <img class="card-row-img" src="/images/\${c.illustration}" alt=""
               onerror="this.src='/images/placeholder.svg'">
          <div class="card-row-info">
            <div class="card-row-word">\${c.word}</div>
            <div class="card-row-translation">\${c.translation}</div>
            \${c.example ? \`<div class="card-row-example">\${c.example.sentence}</div>\` : ''}
          </div>
          <button class="btn-danger" onclick="deleteCard('\${c.id}')">Удалить</button>
        </div>
      \`).join('');
    }

    document.getElementById('edit-back').addEventListener('click', () => {
      currentEditSlug = null;
      showPage('lessons');
      loadLessons();
    });

    document.getElementById('edit-add-card-btn').addEventListener('click', () => {
      showPage('cards');
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelector('.nav-item[data-page="cards"]').classList.add('active');
      if (currentEditSlug) {
        document.getElementById('card-lesson-select').value = currentEditSlug;
      }
    });

    // --- Сохранить урок ---
    const editForm = document.getElementById('edit-form');
    const editSaveBtn = document.getElementById('edit-save-btn');
    const editNotice = document.getElementById('edit-notice');

    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      editSaveBtn.disabled = true;
      editSaveBtn.textContent = 'Сохраняю...';
      editNotice.className = 'notice';

      const data = Object.fromEntries(new FormData(editForm));
      try {
        const res = await fetch(\`/api/lessons/\${currentEditSlug}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);

        document.getElementById('edit-lesson-title').textContent = data.title;
        editNotice.textContent = 'Сохранено';
        editNotice.className = 'notice ok visible';
        setTimeout(() => editNotice.classList.remove('visible'), 2000);
      } catch (err) {
        editNotice.textContent = err.message;
        editNotice.className = 'notice error visible';
      } finally {
        editSaveBtn.disabled = false;
        editSaveBtn.textContent = 'Сохранить';
      }
    });

    // --- Удалить карточку ---
    async function deleteCard(cardId) {
      if (!confirm('Удалить карточку?')) return;
      try {
        const res = await fetch(\`/api/lessons/\${currentEditSlug}/cards/\${cardId}\`, {
          method: 'DELETE',
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        document.getElementById(\`card-row-\${cardId}\`)?.remove();
        const remaining = document.querySelectorAll('.card-row').length;
        document.getElementById('edit-cards-title').textContent =
          \`Карточки (\${remaining})\`;
        if (remaining === 0) {
          document.getElementById('edit-cards-list').innerHTML = '<p class="empty">Карточек нет</p>';
        }
      } catch (err) {
        alert(err.message);
      }
    }

    // --- Создать урок ---
    const lessonForm = document.getElementById('lesson-form');
    const lessonBtn = document.getElementById('lesson-btn');
    const lessonNotice = document.getElementById('lesson-notice');

    lessonForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      lessonBtn.disabled = true;
      lessonBtn.textContent = 'Создаю...';
      lessonNotice.className = 'notice';

      const data = Object.fromEntries(new FormData(lessonForm));
      try {
        const res = await fetch('/api/add-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);

        lessonNotice.textContent = \`Урок создан: \${json.slug}\`;
        lessonNotice.className = 'notice ok visible';
        lessonForm.reset();
        await loadLessons();
      } catch (err) {
        lessonNotice.textContent = err.message;
        lessonNotice.className = 'notice error visible';
      } finally {
        lessonBtn.disabled = false;
        lessonBtn.textContent = 'Создать урок';
      }
    });

    // --- Пикер картинки ---
    let imgPage = 1;
    let imgQuery = '';

    const imgPreview    = document.getElementById('img-preview');
    const imgSearchBtn  = document.getElementById('img-search-btn');
    const imgRefreshBtn = document.getElementById('img-refresh-btn');
    const imgClearBtn   = document.getElementById('img-clear-btn');
    const imgUrlInput   = document.getElementById('selected-image-url');

    function setImage(url) {
      imgUrlInput.value = url;
      imgPreview.innerHTML = \`<img src="\${url}" alt="">\`;
      imgRefreshBtn.style.display = '';
      imgClearBtn.style.display = '';
    }

    function clearImage() {
      imgUrlInput.value = '';
      imgPreview.innerHTML = '<span class="img-picker-preview-empty">нет картинки</span>';
      imgRefreshBtn.style.display = 'none';
      imgClearBtn.style.display = 'none';
    }

    async function fetchImage(query, page) {
      imgSearchBtn.textContent = '...';
      imgSearchBtn.disabled = true;
      imgRefreshBtn.disabled = true;
      try {
        const res = await fetch(\`/api/unsplash?q=\${encodeURIComponent(query)}&page=\${page}\`);
        const { url } = await res.json();
        if (url) setImage(url);
        else imgPreview.innerHTML = '<span class="img-picker-preview-empty">не найдено</span>';
      } finally {
        imgSearchBtn.textContent = 'Найти';
        imgSearchBtn.disabled = false;
        imgRefreshBtn.disabled = false;
      }
    }

    imgSearchBtn.addEventListener('click', () => {
      const translation = cardForm.querySelector('[name="translation"]').value.trim();
      const word        = cardForm.querySelector('[name="word"]').value.trim();
      imgQuery = translation || word;
      if (!imgQuery) return;
      imgPage = 1;
      fetchImage(imgQuery, imgPage);
    });

    imgRefreshBtn.addEventListener('click', () => {
      if (!imgQuery) return;
      imgPage++;
      fetchImage(imgQuery, imgPage);
    });

    imgClearBtn.addEventListener('click', clearImage);

    // Сбросить пикер при сбросе формы
    cardForm.addEventListener('reset', clearImage);

    // --- Тег-пикер ---
    let allTags = [];
    let selectedTags = []; // [{id, name}]

    async function loadTags() {
      const res = await fetch('/api/tags');
      allTags = await res.json();
    }
    loadTags();

    const tagInput      = document.getElementById('tag-input');
    const tagDropdown   = document.getElementById('tag-dropdown');
    const tagSelected   = document.getElementById('tag-selected');
    const tagsValue     = document.getElementById('tags-value');

    function renderSelectedTags() {
      tagSelected.innerHTML = selectedTags.map(t => \`
        <span class="tag-chip">
          \${t.name}
          <button class="tag-chip-remove" type="button" data-id="\${t.id}">×</button>
        </span>
      \`).join('');
      tagsValue.value = JSON.stringify(selectedTags.map(t => t.id));
      tagSelected.querySelectorAll('.tag-chip-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedTags = selectedTags.filter(t => t.id !== btn.dataset.id);
          renderSelectedTags();
        });
      });
    }

    function renderDropdown(query) {
      const q = query.trim().toLowerCase();
      const alreadySelected = new Set(selectedTags.map(t => t.id));
      const filtered = allTags.filter(t =>
        !alreadySelected.has(t.id) &&
        (q === '' || t.name.toLowerCase().includes(q) || t.id.includes(q))
      );

      const exactMatch = allTags.some(t => t.name.toLowerCase() === q);
      const canCreate = q.length > 0 && !exactMatch;

      if (filtered.length === 0 && !canCreate) {
        tagDropdown.classList.remove('open');
        return;
      }

      tagDropdown.innerHTML = [
        ...filtered.map(t => \`<div class="tag-option" data-id="\${t.id}" data-name="\${t.name}">\${t.name}</div>\`),
        canCreate ? \`<div class="tag-option tag-option-create" data-create="\${q}">+ Создать «\${q}»</div>\` : ''
      ].join('');
      tagDropdown.classList.add('open');

      tagDropdown.querySelectorAll('.tag-option[data-id]').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectedTags.push({ id: el.dataset.id, name: el.dataset.name });
          renderSelectedTags();
          tagInput.value = '';
          tagDropdown.classList.remove('open');
        });
      });

      const createEl = tagDropdown.querySelector('[data-create]');
      if (createEl) {
        createEl.addEventListener('mousedown', async (e) => {
          e.preventDefault();
          const name = createEl.dataset.create;
          const res = await fetch('/api/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
          const json = await res.json();
          if (json.ok) {
            allTags.push(json.tag);
            selectedTags.push(json.tag);
            renderSelectedTags();
            tagInput.value = '';
            tagDropdown.classList.remove('open');
          }
        });
      }
    }

    tagInput.addEventListener('input', () => renderDropdown(tagInput.value));
    tagInput.addEventListener('focus', () => renderDropdown(tagInput.value));
    tagInput.addEventListener('blur', () => setTimeout(() => tagDropdown.classList.remove('open'), 150));

    // Сбросить теги при reset формы
    cardForm?.addEventListener('reset', () => {
      selectedTags = [];
      renderSelectedTags();
      tagDropdown.classList.remove('open');
    });

    // --- Добавить карточку ---
    const cardBtn = document.getElementById('card-btn');
    const cardNotice = document.getElementById('card-notice');
    const cardPreview = document.getElementById('card-preview');

    cardForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      cardBtn.disabled = true;
      cardBtn.textContent = 'Добавляю...';
      cardNotice.className = 'notice';
      cardPreview.className = 'card-preview';

      const data = Object.fromEntries(new FormData(cardForm));
      try {
        const res = await fetch('/api/add-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);

        const { card, meta } = json;
        cardPreview.innerHTML = \`
          \${meta.imageOk ? \`<img src="/images/\${card.illustration}" alt="">\` : ''}
          <p class="card-word">\${card.word}</p>
          <p class="card-translation">\${card.translation}</p>
          \${card.example ? \`
            <p class="card-example">\${card.example.sentence}</p>
            <p class="card-example-tr">\${card.example.translation}</p>
          \` : ''}
          <div class="file-status">
            <span class="\${meta.audioOk ? 'ok' : 'fail'}">\${meta.audioOk ? '✓' : '✗'} аудио слова</span>
            \${card.example ? \`<span class="\${meta.exampleAudioOk ? 'ok' : 'fail'}">\${meta.exampleAudioOk ? '✓' : '✗'} аудио примера</span>\` : ''}
            <span class="\${meta.imageOk ? 'ok' : 'fail'}">\${meta.imageOk ? '✓' : '✗'} картинка\${!meta.imageOk && !meta.hasUnsplashKey ? ' — нет ключа Unsplash' : ''}</span>
          </div>
        \`;
        cardPreview.className = 'card-preview visible';
        cardNotice.textContent = 'Карточка добавлена';
        cardNotice.className = 'notice ok visible';
        cardForm.reset();
        await loadLessons();
      } catch (err) {
        cardNotice.textContent = err.message;
        cardNotice.className = 'notice error visible';
      } finally {
        cardBtn.disabled = false;
        cardBtn.textContent = 'Добавить карточку';
      }
    });
  </script>
</body>
</html>`;

// --- HTTP сервер ---

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname, method } = { pathname: url.pathname, method: req.method };

    if (pathname === '/' && method === 'GET') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (pathname === '/api/lessons' && method === 'GET') {
      return Response.json(getLessons());
    }

    // GET /api/lessons/:slug
    const lessonMatch = pathname.match(/^\/api\/lessons\/([^/]+)$/);
    if (lessonMatch && method === 'GET') {
      const lesson = getLesson(lessonMatch[1]);
      if (!lesson) return Response.json({ ok: false, error: 'Не найден' }, { status: 404 });
      return Response.json(lesson);
    }

    // PUT /api/lessons/:slug
    if (lessonMatch && method === 'PUT') {
      try {
        const slug = lessonMatch[1];
        const path = join(LESSONS_DIR, `${slug}.json`);
        if (!existsSync(path)) return Response.json({ ok: false, error: 'Не найден' }, { status: 404 });
        const { title, description } = (await req.json()) as Record<string, string>;
        if (!title) return Response.json({ ok: false, error: 'Название обязательно' }, { status: 400 });
        const lesson = JSON.parse(readFileSync(path, 'utf-8'));
        lesson.title = title;
        lesson.description = description || '';
        writeFileSync(path, JSON.stringify(lesson, null, 2) + '\n');
        return Response.json({ ok: true });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    // DELETE /api/lessons/:slug/cards/:cardId
    const cardMatch = pathname.match(/^\/api\/lessons\/([^/]+)\/cards\/([^/]+)$/);
    if (cardMatch && method === 'DELETE') {
      try {
        const [, slug, cardId] = cardMatch;
        const path = join(LESSONS_DIR, `${slug}.json`);
        if (!existsSync(path)) return Response.json({ ok: false, error: 'Урок не найден' }, { status: 404 });
        const lesson = JSON.parse(readFileSync(path, 'utf-8'));
        const before = lesson.cards.length;
        lesson.cards = lesson.cards.filter((c: any) => c.id !== cardId);
        if (lesson.cards.length === before) return Response.json({ ok: false, error: 'Карточка не найдена' }, { status: 404 });
        writeFileSync(path, JSON.stringify(lesson, null, 2) + '\n');
        pruneUnusedTags();
        return Response.json({ ok: true });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    // GET /api/tags
    if (pathname === '/api/tags' && method === 'GET') {
      const tags = JSON.parse(readFileSync(TAGS_FILE, 'utf-8'));
      return Response.json(tags);
    }

    // POST /api/tags — создать тег
    if (pathname === '/api/tags' && method === 'POST') {
      try {
        const { name } = (await req.json()) as { name: string };
        if (!name) return Response.json({ ok: false, error: 'Название обязательно' }, { status: 400 });
        const tags = JSON.parse(readFileSync(TAGS_FILE, 'utf-8')) as any[];
        const id = slugify(name);
        if (tags.find((t) => t.id === id)) return Response.json({ ok: false, error: 'Тег уже существует' }, { status: 409 });
        const tag = { id, name };
        tags.push(tag);
        writeFileSync(TAGS_FILE, JSON.stringify(tags, null, 2) + '\n');
        return Response.json({ ok: true, tag });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    // GET /api/unsplash?q=...&page=N
    if (pathname === '/api/unsplash' && method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const page = parseInt(url.searchParams.get('page') ?? '1');
      const imageUrl = await searchUnsplash(q, page);
      return Response.json({ url: imageUrl });
    }

    // GET /api/cards — standalone cards
    if (pathname === '/api/cards' && method === 'GET') {
      const cards = JSON.parse(readFileSync(CARDS_FILE, 'utf-8'));
      return Response.json(cards);
    }

    // DELETE /api/cards/:id
    const standaloneCardMatch = pathname.match(/^\/api\/cards\/([^/]+)$/);
    if (standaloneCardMatch && method === 'DELETE') {
      try {
        const cardId = standaloneCardMatch[1];
        const cards = JSON.parse(readFileSync(CARDS_FILE, 'utf-8')) as any[];
        const before = cards.length;
        const updated = cards.filter((c) => c.id !== cardId);
        if (updated.length === before) return Response.json({ ok: false, error: 'Карточка не найдена' }, { status: 404 });
        writeFileSync(CARDS_FILE, JSON.stringify(updated, null, 2) + '\n');
        pruneUnusedTags();
        return Response.json({ ok: true });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    if (pathname === '/api/add-lesson' && method === 'POST') {
      try {
        const { title, description } = (await req.json()) as Record<string, string>;
        if (!title) return Response.json({ ok: false, error: 'Название обязательно' }, { status: 400 });
        const slug = getNextLessonSlug();
        const lesson = { slug, title, description: description || '', cards: [] };
        writeFileSync(join(LESSONS_DIR, `${slug}.json`), JSON.stringify(lesson, null, 2) + '\n');
        return Response.json({ ok: true, slug, title });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    if (pathname === '/api/add-card' && method === 'POST') {
      try {
        const { word, translation, lessonSlug, exampleSentence, exampleTranslation, imageUrl, tags } =
          (await req.json()) as Record<string, string>;
        if (!word || !translation) return Response.json({ ok: false, error: 'Слово и перевод обязательны' }, { status: 400 });

        const slug = slugify(word);
        const subfolder = lessonSlug ? `lessons/${lessonSlug}` : 'standalone';
        const subImagesDir = join(IMAGES_DIR, subfolder);
        const subAudioDir = join(AUDIO_DIR, subfolder);
        if (!existsSync(subImagesDir)) mkdirSync(subImagesDir, { recursive: true });
        if (!existsSync(subAudioDir)) mkdirSync(subAudioDir, { recursive: true });

        const audioFileName = `${slug}.mp3`;
        const audioPath = `${subfolder}/${audioFileName}`;
        const audioOk = await downloadAudio(word, join(subAudioDir, audioFileName));

        let exampleAudioPath: string | null = null;
        let exampleAudioOk = false;
        if (exampleSentence) {
          const exAudioFileName = `${slug}-example.mp3`;
          exampleAudioOk = await downloadAudio(exampleSentence, join(subAudioDir, exAudioFileName));
          if (exampleAudioOk) exampleAudioPath = `${subfolder}/${exAudioFileName}`;
        }

        const imageFileName = `${slug}.jpg`;
        const imagePath = `${subfolder}/${imageFileName}`;
        const imageOk = imageUrl
          ? await downloadImageFromUrl(imageUrl, join(subImagesDir, imageFileName))
          : false;

        const parsedTags: string[] = tags ? JSON.parse(tags) : [];

        const card: Record<string, unknown> = {
          id: slug,
          word,
          translation,
          illustration: imageOk ? imagePath : 'placeholder.svg',
          audio: audioOk ? audioPath : null,
          ...(parsedTags.length > 0 && { tags: parsedTags }),
        };

        if (exampleSentence && exampleTranslation) {
          card.example = { sentence: exampleSentence, translation: exampleTranslation, audio: exampleAudioPath };
        }

        saveCard(card, lessonSlug || undefined);

        return Response.json({
          ok: true, card,
          meta: { audioOk, exampleAudioOk, imageOk, hasUnsplashKey: !!process.env.UNSPLASH_ACCESS_KEY },
        });
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    if (pathname.startsWith('/images/') || pathname.startsWith('/audio/')) {
      const filePath = join(ROOT, 'public', pathname);
      if (existsSync(filePath)) return new Response(Bun.file(filePath));
    }

    return new Response('Not found', { status: 404 });
  },
});

console.log(`\nAdmin panel → http://localhost:${PORT}\n`);
