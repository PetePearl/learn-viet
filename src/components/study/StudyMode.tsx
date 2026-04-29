import { createSignal, createEffect, onCleanup } from 'solid-js';
import type { Card } from '../../lib/data';

interface Props {
  cards: Card[];
}

function AudioControls(props: { src: string }) {
  const [playing, setPlaying] = createSignal(false);
  let audio: HTMLAudioElement | null = null;

  function stop() {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio = null;
    }
    setPlaying(false);
  }

  function play() {
    stop();
    audio = new Audio(props.src);
    audio.addEventListener('ended', () => setPlaying(false));
    audio.play();
    setPlaying(true);
  }

  onCleanup(stop);

  return (
    <div class="study__audio-controls" onClick={(e) => e.stopPropagation()}>
      {!playing() ? (
        <button class="study__audio-btn" onClick={play}>▶ Слушать</button>
      ) : (
        <>
          <button class="study__audio-btn study__audio-btn--stop" onClick={stop}>■ Стоп</button>
          <button class="study__audio-btn" onClick={play}>↺ Повтор</button>
        </>
      )}
    </div>
  );
}

export default function StudyMode(props: Props) {
  const [index, setIndex] = createSignal(0);
  const [flipped, setFlipped] = createSignal(false);
  const [imgLoading, setImgLoading] = createSignal(true);

  createEffect(() => {
    void props.cards;
    setIndex(0);
    setFlipped(false);
  });

  const card = () => props.cards[index()];

  createEffect(() => {
    void card().illustration;
    setImgLoading(true);
  });
  const total = () => props.cards.length;

  function prev() {
    setFlipped(false);
    setIndex((i) => (i - 1 + total()) % total());
  }

  function next() {
    setFlipped(false);
    setIndex((i) => (i + 1) % total());
  }

  function flip() {
    setFlipped((f) => !f);
  }

  return (
    <div class="study">
      <div class="study__progress">
        {index() + 1} / {total()}
      </div>

      <div
        class={`study__card${flipped() ? ' study__card--flipped' : ''}`}
        onClick={flip}
      >
        <div class="study__front">
          <div class="study__img-wrap">
            {imgLoading() && <div class="study__img-loader" />}
            <img
              src={`${import.meta.env.BASE_URL}/images/${card().illustration}`}
              alt={card().word}
              style={{ opacity: imgLoading() ? 0 : 1 }}
              onLoad={() => setImgLoading(false)}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}/images/placeholder.svg`;
                setImgLoading(false);
              }}
            />
          </div>
          <p class="study__word">{card().word}</p>
          {card().audio && (
            <AudioControls src={`${import.meta.env.BASE_URL}/audio/${card().audio}`} />
          )}
        </div>

        <div class="study__back">
          <p class="study__translation">{card().translation}</p>
          {card().example && (
            <div class="study__example" onClick={(e) => e.stopPropagation()}>
              <p class="study__example-sentence">{card().example!.sentence}</p>
              <p class="study__example-translation">{card().example!.translation}</p>
              {card().example!.audio && (
                <AudioControls src={`${import.meta.env.BASE_URL}/audio/${card().example!.audio}`} />
              )}
            </div>
          )}
        </div>
      </div>

      <p class="study__hint">
        {flipped() ? 'нажмите, чтобы вернуть' : 'нажмите, чтобы увидеть перевод'}
      </p>

      <div class="study__nav">
        <button class="study__btn" onClick={prev}>← Назад</button>
        <button class="study__btn" onClick={next}>Вперёд →</button>
      </div>
    </div>
  );
}
