export interface Example {
  sentence: string;
  translation: string;
  audio: string | null;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Card {
  id: string;
  word: string;
  translation: string;
  illustration: string;
  audio: string | null;
  example?: Example;
  tags?: string[];
}

export interface Lesson {
  slug: string;
  title: string;
  description: string;
  cards: Card[];
}

const lessonModules = import.meta.glob('../data/lessons/*.json', { eager: true });
const standaloneCards = (await import('../data/cards.json')).default as Card[];
const allTags = (await import('../data/tags.json')).default as Tag[];

export function getAllLessons(): Lesson[] {
  return Object.values(lessonModules) as Lesson[];
}

export function getLessonBySlug(slug: string): Lesson | undefined {
  return getAllLessons().find((l) => l.slug === slug);
}

export function getStandaloneCards(): Card[] {
  return standaloneCards;
}

export function getAllTags(): Tag[] {
  return allTags;
}

export function getTagById(id: string): Tag | undefined {
  return allTags.find((t) => t.id === id);
}
