import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import type { Card } from '../../lib/data';

interface Props {
  cards: Card[];
}

function AudioControls(props: { src: string; stopKey: number }) {
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

  createEffect(() => { void props.stopKey; stop(); });
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
  const [stopKey, setStopKey] = createSignal(0);
  let imgRef: HTMLImageElement | undefined;

  createEffect(() => {
    void props.cards;
    setIndex(0);
    setFlipped(false);
  });

  const card = () => props.cards[index()];
  const total = () => props.cards.length;

  createEffect(() => {
    void card().illustration;
    setImgLoading(true);
    // Если картинка уже закэшированна — onLoad не выстрелит
    Promise.resolve().then(() => {
      if (imgRef?.complete && imgRef.naturalWidth > 0) setImgLoading(false);
    });
  });

  function prev() {
    setStopKey((k) => k + 1);
    setFlipped(false);
    setIndex((i) => (i - 1 + total()) % total());
  }

  function next() {
    setStopKey((k) => k + 1);
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
            <Show when={imgLoading()}>
              <div class="study__img-loader" />
            </Show>
            <img
              ref={imgRef}
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
          <p class="study__word">{card().translation}</p>
        </div>

        <div class="study__back">
          <p class="study__translation">{card().word}</p>
          {card().audio && (
            <AudioControls src={`${import.meta.env.BASE_URL}/audio/${card().audio}`} stopKey={stopKey()} />
          )}
          {card().example && (
            <div class="study__example" onClick={(e) => e.stopPropagation()}>
              <p class="study__example-sentence">{card().example!.sentence}</p>
              <p class="study__example-translation">{card().example!.translation}</p>
              {card().example!.audio && (
                <AudioControls src={`${import.meta.env.BASE_URL}/audio/${card().example!.audio}`} stopKey={stopKey()} />
              )}
            </div>
          )}
        </div>
      </div>

      <p class="study__hint">
        {flipped() ? 'нажмите, чтобы вернуть' : 'нажмите, чтобы увидеть перевод'}
      </p>

      <Show when={total() > 1}>
        <div class="study__nav">
          <button class="study__btn" onClick={prev}>← Назад</button>
          <button class="study__btn" onClick={next}>Вперёд →</button>
        </div>
      </Show>
    </div>
  );
}
