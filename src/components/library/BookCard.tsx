"use client";

import Link from "next/link";
import Image from "next/image";

export type BookCardItem = {
  id: string;
  title: string;
  author: string;
  narrator?: string | null;
  duration: number;
  coverUrl: string | null;
  progressPct: number;
  hasAudio: boolean;
  listenerCount?: number;
};

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}sa ${m}dk`;
  if (h > 0) return `${h}sa`;
  return `${m}dk`;
}

export default function BookCard({
  book,
  color,
  showListeners = false,
}: {
  book: BookCardItem;
  color: string;
  showListeners?: boolean;
}) {
  return (
    <Link href={`/dashboard/listen/${book.id}`} className="group block w-full">
      <div className="relative w-full overflow-hidden rounded-xl border border-gray-800 group-hover:border-gray-600 transition-colors" style={{ aspectRatio: "1 / 1" }}>
        {book.coverUrl ? (
          <Image
            src={book.coverUrl}
            alt={book.title}
            fill
            sizes="(max-width: 640px) 30vw, (max-width: 1024px) 18vw, 130px"
            className={`object-cover ${!book.hasAudio ? "opacity-55" : ""}`}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-3xl">🎧</div>
        )}
        {!book.hasAudio && (
          <span className="absolute top-1.5 right-1.5 bg-black/70 text-gray-400 text-[9px] px-1.5 py-0.5 rounded-full">Yakında</span>
        )}
        {book.progressPct > 0 && book.progressPct < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/80">
            <div className="h-1" style={{ width: `${book.progressPct}%`, backgroundColor: color }} />
          </div>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="text-white text-[11px] font-medium line-clamp-2 leading-tight">{book.title}</p>
        <p className="text-gray-500 text-[10px] mt-0.5 truncate">{book.author}</p>
        <p className="text-gray-600 text-[10px] mt-px">{formatDuration(book.duration)}</p>
        {showListeners && (book.listenerCount ?? 0) > 0 && (
          <p className="text-gray-600 text-[10px] mt-px">{book.listenerCount} kişi dinledi</p>
        )}
      </div>
    </Link>
  );
}
