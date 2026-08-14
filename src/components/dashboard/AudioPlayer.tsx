"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface Chapter {
  id: string;
  title: string;
  order: number;
  duration: number;
  s3Key: string;
}

interface Book {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  chapters: Chapter[];
}

interface Bookmark {
  id: string;
  bookId: string;
  chapterId: string | null;
  positionSec: number;
  note: string | null;
  createdAt: string;
}

function formatTime(sec: number) {
  if (!sec || isNaN(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AudioPlayer({
  book,
  initialPositionSec,
  initialChapterId,
  initialBookmarks,
  brandColor,
}: {
  book: Book;
  initialPositionSec: number;
  initialChapterId: string | null;
  initialBookmarks: Bookmark[];
  brandColor: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const pendingPlayRef = useRef(false); // bölüm bitince otomatik devam
  const didInitialSeekRef = useRef(false);
  // Stale closure'ı önlemek için ref'ler
  const chapterIdxRef = useRef(0);
  const currentTimeRef = useRef(0);
  const color = brandColor || "#2563eb";

  const initialIdx = (() => {
    if (initialChapterId) {
      const idx = book.chapters.findIndex((c) => c.id === initialChapterId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  })();

  const [currentChapterIdx, setCurrentChapterIdx] = useState(initialIdx);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [noAudio, setNoAudio] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);
  const [addingBookmark, setAddingBookmark] = useState(false);

  useEffect(() => { chapterIdxRef.current = currentChapterIdx; }, [currentChapterIdx]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  const currentChapter = book.chapters[currentChapterIdx] ?? null;
  const hasChapters = book.chapters.length > 0;

  // ── Audio event listener'ları (bir kez bağla) ──────────────────────────
  const logPlayHistory = useCallback(() => {
    if (!sessionStartRef.current) return;
    const listenedSec = (Date.now() - sessionStartRef.current) / 1000;
    sessionStartRef.current = null;
    if (listenedSec < 5) return;
    const totalDurationSec = book.chapters.reduce((acc, ch) => acc + ch.duration, 0);
    const completedPct = totalDurationSec > 0
      ? Math.min(100, (currentTimeRef.current / totalDurationSec) * 100)
      : 0;
    fetch("/api/dashboard/play-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: book.id, listenedSec, completedPct }),
      keepalive: true,
    });
  }, [book.id, book.chapters]);

  const saveProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const chapter = book.chapters[chapterIdxRef.current];
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/dashboard/player-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          chapterId: chapter?.id ?? null,
          positionSec: Math.floor(audio.currentTime),
        }),
      });
    }, 3000);
  }, [book.id, book.chapters]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onCanPlay = () => {
      setLoaded(true);
      setDuration(audio.duration || 0);
      // İlk yüklemede kaldığı yere atla
      if (!didInitialSeekRef.current && initialPositionSec > 0 && chapterIdxRef.current === initialIdx) {
        didInitialSeekRef.current = true;
        audio.currentTime = initialPositionSec;
        setCurrentTime(initialPositionSec);
      }
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        audio.play();
      }
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      saveProgress();
    };
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onPlay = () => {
      setIsPlaying(true);
      if (!sessionStartRef.current) sessionStartRef.current = Date.now();
    };
    const onPause = () => {
      setIsPlaying(false);
      logPlayHistory();
    };
    const onEnded = () => {
      logPlayHistory();
      const nextIdx = chapterIdxRef.current + 1;
      if (nextIdx < book.chapters.length) {
        pendingPlayRef.current = true;
        setCurrentChapterIdx(nextIdx);
        setCurrentTime(0);
        setLoaded(false);
        setIsPlaying(false);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [saveProgress, logPlayHistory, book.chapters.length, initialPositionSec, initialIdx]);

  // ── Bölüm değişince S3 URL yükle, src güncelle ─────────────────────────
  useEffect(() => {
    if (!currentChapter?.s3Key) {
      setNoAudio(true);
      const audio = audioRef.current;
      if (audio) { audio.src = ""; audio.load(); }
      return;
    }
    setNoAudio(false);
    setLoaded(false);
    setDuration(0);

    fetch(`/api/dashboard/audio-url?key=${encodeURIComponent(currentChapter.s3Key)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.url) {
          const audio = audioRef.current;
          if (audio) {
            audio.src = data.url;
            audio.load();
          }
        } else {
          setNoAudio(true);
        }
      })
      .catch(() => setNoAudio(true));
  }, [currentChapter]);

  // Sayfa kapanınca kaydet
  useEffect(() => {
    const handler = () => logPlayHistory();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [logPlayHistory]);

  // ── Kontroller ────────────────────────────────────────────────────────
  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || noAudio) return;
    if (isPlaying) audio.pause();
    else audio.play();
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  }

  function skip(sec: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + sec));
  }

  function changeChapter(idx: number) {
    if (idx === currentChapterIdx) return;
    logPlayHistory();
    pendingPlayRef.current = false;
    setCurrentChapterIdx(idx);
    setCurrentTime(0);
    setLoaded(false);
    setDuration(0);
    setIsPlaying(false);
  }

  function changeRate(rate: number) {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }

  function changeVolume(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }

  async function addBookmark() {
    const chapter = book.chapters[chapterIdxRef.current];
    setAddingBookmark(true);
    try {
      const res = await fetch("/api/dashboard/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          chapterId: chapter?.id ?? null,
          positionSec: Math.floor(currentTimeRef.current),
        }),
      });
      const bm = await res.json();
      setBookmarks((prev) => [...prev, bm].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ));
    } finally {
      setAddingBookmark(false);
    }
  }

  async function deleteBookmark(id: string) {
    await fetch(`/api/dashboard/bookmarks/${id}`, { method: "DELETE" });
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }

  function jumpToBookmark(bm: Bookmark) {
    const chIdx = bm.chapterId
      ? book.chapters.findIndex((c) => c.id === bm.chapterId)
      : -1;

    if (chIdx >= 0 && chIdx !== currentChapterIdx) {
      changeChapter(chIdx);
      setTimeout(() => {
        const audio = audioRef.current;
        if (audio) { audio.currentTime = bm.positionSec; setCurrentTime(bm.positionSec); }
      }, 600);
    } else {
      const audio = audioRef.current;
      if (audio) { audio.currentTime = bm.positionSec; setCurrentTime(bm.positionSec); }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Audio her zaman DOM'da */}
      <audio ref={audioRef} preload="metadata" />

      {/* Player */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
        {noAudio && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-400 text-sm mb-5">
            🎵 Ses dosyası henüz yüklenmemiş.
          </div>
        )}

        {currentChapter && (
          <div className="mb-5">
            <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">
              Bölüm {currentChapter.order} / {book.chapters.length}
            </div>
            <div className="text-white font-semibold">{currentChapter.title}</div>
          </div>
        )}

        {!hasChapters && (
          <div className="text-gray-500 text-sm mb-5">Bu kitaba henüz bölüm eklenmemiş.</div>
        )}

        {/* Progress bar */}
        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={seek}
            disabled={noAudio || !hasChapters || !loaded}
            className="w-full h-2 rounded-full appearance-none bg-gray-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            style={{ accentColor: color }}
          />
          <div className="flex justify-between text-gray-500 text-xs mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{loaded ? formatTime(duration) : "—"}</span>
          </div>
        </div>

        {/* Kontroller */}
        <div className="flex items-center justify-center gap-6 mb-5">
          <button
            onClick={() => changeChapter(Math.max(0, currentChapterIdx - 1))}
            disabled={currentChapterIdx === 0 || !hasChapters}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>

          <button onClick={() => skip(-15)} disabled={noAudio || !hasChapters || !loaded}
            className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors p-2 text-sm font-medium">
            −15s
          </button>

          <button
            onClick={togglePlay}
            disabled={noAudio || !hasChapters || !loaded}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: color }}
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button onClick={() => skip(15)} disabled={noAudio || !hasChapters || !loaded}
            className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors p-2 text-sm font-medium">
            +15s
          </button>

          <button
            onClick={() => changeChapter(Math.min(book.chapters.length - 1, currentChapterIdx + 1))}
            disabled={currentChapterIdx >= book.chapters.length - 1 || !hasChapters}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" />
            </svg>
          </button>
        </div>

        {/* Hız, ses, yer imi */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">Hız:</span>
            {[0.75, 1, 1.25, 1.5, 2].map((r) => (
              <button
                key={r}
                onClick={() => changeRate(r)}
                className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                style={playbackRate === r
                  ? { backgroundColor: color + "33", color }
                  : { color: "#6b7280" }
                }
              >
                {r}x
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
              <input
                type="range" min={0} max={1} step={0.05} value={volume}
                onChange={changeVolume}
                className="w-20 h-1.5 rounded-full appearance-none bg-gray-800 cursor-pointer"
                style={{ accentColor: color }}
              />
            </div>

            <button
              onClick={addBookmark}
              disabled={addingBookmark || noAudio || !hasChapters || !loaded}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
              style={{ borderColor: color + "44", color }}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
              </svg>
              Yer İmi
            </button>
          </div>
        </div>
      </div>

      {/* Bölüm listesi */}
      {hasChapters && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-4">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Bölümler</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {book.chapters.map((ch, idx) => (
              <button
                key={ch.id}
                onClick={() => changeChapter(idx)}
                className={`w-full flex items-center justify-between px-6 py-3 hover:bg-gray-800/50 transition-colors text-left ${
                  idx === currentChapterIdx ? "border-l-2" : ""
                }`}
                style={idx === currentChapterIdx
                  ? { backgroundColor: color + "0a", borderColor: color }
                  : {}
                }
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-600 text-sm w-6 flex-shrink-0">{ch.order}</span>
                  <span
                    className="text-sm"
                    style={idx === currentChapterIdx ? { color, fontWeight: 500 } : { color: "#fff" }}
                  >
                    {ch.title}
                  </span>
                  {idx === currentChapterIdx && isPlaying && (
                    <span className="text-xs animate-pulse" style={{ color }}>▶ Çalıyor</span>
                  )}
                </div>
                <span className="text-gray-500 text-xs flex-shrink-0">{formatTime(ch.duration)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Yer imleri */}
      {bookmarks.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Yer İmleri ({bookmarks.length})</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {bookmarks.map((bm) => {
              const bmChapter = bm.chapterId
                ? book.chapters.find((c) => c.id === bm.chapterId)
                : null;
              return (
                <div key={bm.id} className="flex items-center justify-between px-6 py-3">
                  <button
                    onClick={() => jumpToBookmark(bm)}
                    className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" style={{ color }}>
                      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                    </svg>
                    <div>
                      <div className="text-white text-sm font-medium">{formatTime(bm.positionSec)}</div>
                      {bmChapter && (
                        <div className="text-gray-500 text-xs mt-0.5">{bmChapter.title}</div>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => deleteBookmark(bm.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
