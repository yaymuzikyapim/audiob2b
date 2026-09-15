"use client";

import { useState } from "react";
import Link from "next/link";

type Book = {
  id: string;
  title: string;
  author: string;
  narrator: string | null;
  duration: number;
  coverUrl: string | null;
  description: string | null;
  hasAudio: boolean;
  progressPct: number;
  isFavorite: boolean;
  category: string | null;
  seriesId: string | null;
  seriesName: string | null;
  seriesCoverUrl: string | null;
  seriesOrder: number | null;
};

type SeriesGroup = {
  id: string;
  name: string;
  coverUrl: string | null;
  category: string | null;
  books: Book[];
};

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

// Küçük kart — yatay scroll içinde seri kitapları için
function MiniBookCard({ book, color }: { book: Book; color: string }) {
  return (
    <Link href={`/dashboard/listen/${book.id}`} className="flex-shrink-0 w-24">
      <div className="relative">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className={`w-24 h-36 object-cover rounded-xl ${!book.hasAudio ? "opacity-55" : ""}`}
          />
        ) : (
          <div className="w-24 h-36 bg-gray-800 rounded-xl flex items-center justify-center text-2xl">🎧</div>
        )}
        {!book.hasAudio && (
          <span className="absolute top-1.5 right-1.5 bg-black/70 text-gray-400 text-[9px] px-1 py-0.5 rounded-full">Yakında</span>
        )}
        {book.progressPct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-700 rounded-b-xl">
            <div className="h-0.5 rounded-b-xl" style={{ width: `${book.progressPct}%`, backgroundColor: color }} />
          </div>
        )}
      </div>
      <p className="text-white text-[10px] font-medium mt-1.5 line-clamp-2 leading-tight">
        {book.seriesOrder ? `${book.seriesOrder}. ` : ""}{book.title}
      </p>
    </Link>
  );
}

// Standart kitap kartı — grid için
function BookCard({ book, color }: { book: Book; color: string }) {
  return (
    <Link href={`/dashboard/listen/${book.id}`}>
      <div className="group cursor-pointer">
        <div className="relative">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className={`w-full aspect-[2/3] object-cover rounded-xl border border-gray-800 group-hover:border-gray-600 transition-colors ${!book.hasAudio ? "opacity-55" : ""}`}
            />
          ) : (
            <div className="w-full aspect-[2/3] bg-gray-800 rounded-xl border border-gray-800 flex items-center justify-center text-3xl">🎧</div>
          )}
          {!book.hasAudio && (
            <span className="absolute top-1.5 right-1.5 bg-black/70 text-gray-400 text-[9px] px-1.5 py-0.5 rounded-full">Yakında</span>
          )}
          {book.progressPct > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-700 rounded-b-xl">
              <div className="h-0.5 rounded-b-xl" style={{ width: `${book.progressPct}%`, backgroundColor: color }} />
            </div>
          )}
        </div>
        <div className="mt-1.5 px-0.5">
          <p className="text-white text-[11px] font-medium line-clamp-2 leading-tight">{book.title}</p>
          <p className="text-gray-500 text-[10px] mt-0.5 truncate">{book.author}</p>
        </div>
      </div>
    </Link>
  );
}

// Seri satırı — yatay açılır
function SeriesShelf({ series, color }: { series: SeriesGroup; color: string }) {
  const [expanded, setExpanded] = useState(false);
  const cover = series.coverUrl ?? series.books[0]?.coverUrl;
  const totalDur = series.books.reduce((s, b) => s + b.duration, 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-2">
      <button
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-800/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {cover ? (
          <img src={cover} alt={series.name} className="w-11 h-11 object-cover rounded-lg flex-shrink-0" />
        ) : (
          <div className="w-11 h-11 bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center text-xl">🎧</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{series.name}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {series.books[0]?.author} · {series.books.length} kitap · {formatDuration(totalDur)}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="flex gap-3 px-3 pb-3 overflow-x-auto scrollbar-hide">
          {series.books.map((b) => (
            <MiniBookCard key={b.id} book={b} color={color} />
          ))}
        </div>
      )}
    </div>
  );
}

// Kategori bölümü
function CategorySection({
  title, seriesList, soloBooks, color,
}: {
  title: string;
  seriesList: SeriesGroup[];
  soloBooks: Book[];
  color: string;
}) {
  if (seriesList.length === 0 && soloBooks.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="text-white font-semibold text-sm mb-3">{title}</h2>
      {seriesList.map((sg) => (
        <SeriesShelf key={sg.id} series={sg} color={color} />
      ))}
      {soloBooks.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 mt-3">
          {soloBooks.map((b) => (
            <BookCard key={b.id} book={b} color={color} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LibraryGrid({ books, color }: { books: Book[]; color: string }) {
  const favorites = books.filter((b) => b.isFavorite);
  const nonFavorites = books.filter((b) => !b.isFavorite);

  // Seri grupla
  const seriesMap = new Map<string, SeriesGroup>();
  const soloBooks: Book[] = [];

  for (const b of nonFavorites) {
    if (b.seriesId) {
      if (!seriesMap.has(b.seriesId)) {
        seriesMap.set(b.seriesId, {
          id: b.seriesId,
          name: b.seriesName!,
          coverUrl: b.seriesCoverUrl,
          category: b.category,
          books: [],
        });
      }
      seriesMap.get(b.seriesId)!.books.push(b);
    } else {
      soloBooks.push(b);
    }
  }

  for (const sg of seriesMap.values()) {
    sg.books.sort((a, b) => (a.seriesOrder ?? 999) - (b.seriesOrder ?? 999));
  }

  // Kategoriye göre grupla
  const byCategory: Record<string, { series: SeriesGroup[]; solo: Book[] }> = {};

  const addCat = (cat: string) => {
    if (!byCategory[cat]) byCategory[cat] = { series: [], solo: [] };
  };

  for (const b of soloBooks) {
    const cat = b.category ?? "Diğer";
    addCat(cat);
    byCategory[cat].solo.push(b);
  }
  for (const sg of seriesMap.values()) {
    const cat = sg.category ?? "Diğer";
    addCat(cat);
    byCategory[cat].series.push(sg);
  }

  return (
    <div>
      {/* Favoriler */}
      {favorites.length > 0 && (
        <div className="mb-8">
          <h2 className="text-white font-semibold text-sm mb-3">Favorilerim</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {favorites.map((b) => (
              <BookCard key={b.id} book={b} color={color} />
            ))}
          </div>
        </div>
      )}

      {/* Kategoriler */}
      {Object.entries(byCategory)
        .sort(([a], [b]) => a.localeCompare(b, "tr"))
        .map(([cat, { series, solo }]) => (
          <CategorySection
            key={cat}
            title={cat}
            seriesList={series}
            soloBooks={solo}
            color={color}
          />
        ))}
    </div>
  );
}
