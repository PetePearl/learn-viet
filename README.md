# Viet Learn

Статический сайт для самостоятельного изучения вьетнамского языка. Контент хранится в JSON-файлах, собирается в статический HTML и хостится на GitHub Pages.

## Стек

- **Astro** — статическая генерация страниц
- **Solid.js** — интерактивные острова (режим изучения, фильтры)
- **SCSS** — стили (BEM-именование)
- **Bun** — пакетный менеджер и запуск скриптов

---

## Структура проекта

```
src/
  components/
    LessonCard.astro        — карточка урока на главной
    WordCard.astro          — карточка слова (картинка + слово + перевод + теги)
    study/
      StudyMode.tsx         — режим изучения: перелистывание карточек с 3D-переворотом
      StudyFilter.tsx       — фильтры по урокам и тегам для режима изучения
  data/
    lessons/
      lesson-01.json        — данные урока (slug, title, description, cards[])
    cards.json              — карточки без урока
    tags.json               — список тегов [{id, name}]
  layouts/
    BaseLayout.astro        — общий layout: шапка с навигацией
  lib/
    data.ts                 — функции загрузки данных (getAllLessons, getStandaloneCards, getAllTags…)
  pages/
    index.astro             — главная: список уроков
    lessons/
      [slug].astro          — страница урока: все карточки урока
    study/
      index.astro           — режим изучения с фильтрами
      [slug].astro          — режим изучения конкретного урока
      standalone.astro      — режим изучения карточек без урока
  styles/
    global.scss             — CSS-переменные и базовые стили
    study.scss              — стили режима изучения и фильтров

public/
  images/                   — иллюстрации к карточкам (*.jpg, placeholder.svg)
  audio/                    — аудиофайлы произношения (*.mp3)

scripts/
  admin.ts                  — локальная админ-панель (Bun HTTP-сервер, порт 3001)
  add-card.ts               — CLI-скрипт добавления карточки

.github/
  workflows/
    deploy.yml              — деплой на GitHub Pages при пуше в main
```

---

## Формат данных

### Урок (`src/data/lessons/*.json`)

```json
{
  "slug": "lesson-01",
  "title": "Урок 1. Базовые слова",
  "description": "Описание урока",
  "cards": [...]
}
```

### Карточка

```json
{
  "id": "con-cho",
  "word": "con chó",
  "translation": "собака",
  "illustration": "con-cho.jpg",
  "audio": "con-cho.mp3",
  "tags": ["animals"],
  "example": {
    "sentence": "Con chó vui.",
    "translation": "Собака радостная.",
    "audio": "con-cho-example.mp3"
  }
}
```

Поля `audio`, `tags`, `example` — необязательные.

### Теги (`src/data/tags.json`)

```json
[
  { "id": "food", "name": "еда" },
  { "id": "animals", "name": "животные" }
]
```

---

## Скрипты

| Команда | Описание |
|---|---|
| `bun run dev` | Запустить dev-сервер Astro (http://localhost:4321) |
| `bun run build` | Собрать статику в папку `dist/` |
| `bun run preview` | Предпросмотр собранного сайта |
| `bun run admin` | Запустить локальную админ-панель (http://localhost:3001) |
| `bun run add-card "перевод" "слово"` | Добавить карточку через CLI |

---

## Локальная админ-панель

Запускается командой `bun run admin` и доступна по адресу **http://localhost:3001**.

Не деплоится — только для локального использования.

### Возможности

- **Уроки** — создание и редактирование уроков (название, описание)
- **Карточки** — добавление карточек: слово, перевод, урок, пример, теги, картинка
  - Поиск картинки через Unsplash (кнопка «Найти» / «Обновить»)
  - Автоматическая загрузка аудио через Google TTS
  - Тег-пикер: выбор из существующих тегов или создание нового
- **Без урока** — просмотр и удаление карточек без урока

### Переменные окружения

Скопируй `.env.example` в `.env` и заполни:

```
UNSPLASH_ACCESS_KEY=...   # https://unsplash.com/developers
```

Без ключа Unsplash карточки добавляются без картинки (используется placeholder).

---

## Деплой

При пуше в ветку `main` GitHub Actions автоматически:
1. Устанавливает зависимости (`bun install`)
2. Собирает сайт (`bun run build`)
3. Деплоит папку `dist/` на GitHub Pages

Настройка: `Settings → Pages → Source: GitHub Actions`.

---

## Добавление контента

### Через админ-панель (рекомендуется)

```bash
bun run admin
# открыть http://localhost:3001
```

После добавления — пересобрать и задеплоить:

```bash
git add src/data public/images public/audio
git commit -m "добавить карточки"
git push
```

### Вручную

Отредактировать JSON-файлы в `src/data/` и добавить медиафайлы в `public/images/` и `public/audio/`.

---

## Режим изучения

Доступен по адресу `/study`. Поддерживает фильтрацию по урокам и тегам — можно выбрать несколько фильтров, показываются карточки подходящие под любой из них.

Карточка переворачивается кликом:
- **Лицевая сторона** — картинка, вьетнамское слово, кнопка воспроизведения
- **Обратная сторона** — перевод, пример предложения с озвучкой
