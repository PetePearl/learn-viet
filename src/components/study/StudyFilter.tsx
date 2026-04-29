import { createSignal, createMemo, Show, For } from 'solid-js';
import type { Card, Tag } from '../../lib/data';
import StudyMode from './StudyMode';

export interface CardWithLesson extends Card {
  lessonSlug?: string;
}

interface LessonMeta {
  slug: string;
  title: string;
}

interface Props {
  cards: CardWithLesson[];
  lessons: LessonMeta[];
  tags: Tag[];
}

export default function StudyFilter(props: Props) {
  const [lessonFilter, setLessonFilter] = createSignal<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = createSignal<Set<string>>(new Set());

  function toggleLesson(slug: string) {
    setLessonFilter((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  function toggleTag(id: string) {
    setTagFilter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const hasFilters = () => lessonFilter().size > 0 || tagFilter().size > 0;

  const filtered = createMemo(() => {
    const lf = lessonFilter();
    const tf = tagFilter();
    if (lf.size === 0 && tf.size === 0) return props.cards;
    return props.cards.filter((card) =>
      lf.has(card.lessonSlug ?? '') || (card.tags ?? []).some((t) => tf.has(t))
    );
  });

  return (
    <div class="study-filter">
      <div class="study-filter__bar">
        <Show when={props.lessons.length > 0}>
          <div class="study-filter__group">
            <span class="study-filter__label">Уроки</span>
            <div class="study-filter__chips">
              <For each={props.lessons}>
                {(l) => (
                  <button
                    class={`study-filter__chip${lessonFilter().has(l.slug) ? ' study-filter__chip--on' : ''}`}
                    onClick={() => toggleLesson(l.slug)}
                  >
                    {l.title}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={props.tags.length > 0}>
          <div class="study-filter__group">
            <span class="study-filter__label">Теги</span>
            <div class="study-filter__chips">
              <For each={props.tags}>
                {(t) => (
                  <button
                    class={`study-filter__chip${tagFilter().has(t.id) ? ' study-filter__chip--on' : ''}`}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.name}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={hasFilters()}>
          <button
            class="study-filter__reset"
            onClick={() => { setLessonFilter(new Set()); setTagFilter(new Set()); }}
          >
            Сбросить фильтры
          </button>
        </Show>
      </div>

      <Show
        when={filtered().length > 0}
        fallback={<p class="study-filter__empty">Нет карточек по заданным фильтрам</p>}
      >
        <p class="study-filter__count">{filtered().length} карт.</p>
        <StudyMode cards={filtered()} />
      </Show>
    </div>
  );
}
