import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..');
const LESSONS_DIR = join(ROOT, 'src/data/lessons');
const CARDS_FILE = join(ROOT, 'src/data/cards.json');
const IMAGES_DIR = join(ROOT, 'public/images');
const AUDIO_DIR = join(ROOT, 'public/audio');

// Убираем вьетнамские диакритики для генерации slug
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Аудио через Google TTS (бесплатно, без ключа)
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

// Картинка через Unsplash (нужен UNSPLASH_ACCESS_KEY)
async function downloadImage(query: string, outputPath: string): Promise<boolean> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    console.log('  ⚠  UNSPLASH_ACCESS_KEY не задан — картинка пропущена');
    return false;
  }
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    const data = (await res.json()) as any;
    const imageUrl = data.results?.[0]?.urls?.small;
    if (!imageUrl) return false;
    const img = await fetch(imageUrl);
    writeFileSync(outputPath, Buffer.from(await img.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

function saveCard(card: object, lessonSlug?: string) {
  if (lessonSlug) {
    const path = join(LESSONS_DIR, `${lessonSlug}.json`);
    if (!existsSync(path)) {
      console.error(`Урок "${lessonSlug}" не найден`);
      process.exit(1);
    }
    const lesson = JSON.parse(readFileSync(path, 'utf-8'));
    lesson.cards.push(card);
    writeFileSync(path, JSON.stringify(lesson, null, 2) + '\n');
    console.log(`  ✓  Добавлено в урок ${lessonSlug}`);
  } else {
    const cards = JSON.parse(readFileSync(CARDS_FILE, 'utf-8')) as object[];
    cards.push(card);
    writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2) + '\n');
    console.log(`  ✓  Добавлено в cards.json`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Использование:');
    console.error('  bun run add-card "перевод" "слово" [урок] ["пример"] ["перевод примера"]');
    console.error('Пример:');
    console.error('  bun run add-card "собака" "con chó" lesson-01 "Con chó vui." "Собака радостная."');
    process.exit(1);
  }

  const [translation, word, lessonSlug, exampleSentence, exampleTranslation] = args;
  const slug = slugify(word);

  console.log(`\n  слово:   ${word}`);
  console.log(`  перевод: ${translation}`);
  if (exampleSentence) console.log(`  пример:  ${exampleSentence} — ${exampleTranslation}`);
  console.log(`  slug:    ${slug}\n`);

  // Аудио слова
  const audioFile = `${slug}.mp3`;
  process.stdout.write('  Аудио слова...');
  const audioOk = await downloadAudio(word, join(AUDIO_DIR, audioFile));
  console.log(audioOk ? ` ${audioFile}` : ' не удалось');

  // Аудио примера
  let exampleAudioFile: string | null = null;
  if (exampleSentence) {
    exampleAudioFile = `${slug}-example.mp3`;
    process.stdout.write('  Аудио примера...');
    const exampleAudioOk = await downloadAudio(exampleSentence, join(AUDIO_DIR, exampleAudioFile));
    console.log(exampleAudioOk ? ` ${exampleAudioFile}` : ' не удалось');
    if (!exampleAudioOk) exampleAudioFile = null;
  }

  // Картинка
  const imageFile = `${slug}.jpg`;
  process.stdout.write('  Картинка...');
  const imageOk = await downloadImage(translation, join(IMAGES_DIR, imageFile));
  console.log(imageOk ? ` ${imageFile}` : ' не удалось');

  const card: Record<string, unknown> = {
    id: slug,
    word,
    translation,
    illustration: imageOk ? imageFile : 'placeholder.svg',
    audio: audioOk ? audioFile : null,
  };

  if (exampleSentence && exampleTranslation) {
    card.example = {
      sentence: exampleSentence,
      translation: exampleTranslation,
      audio: exampleAudioFile,
    };
  }

  saveCard(card, lessonSlug);

  console.log('\nКарточка:');
  console.log(JSON.stringify(card, null, 2));
}

main();
