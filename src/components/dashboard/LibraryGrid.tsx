"use client";

import { useState } from "react";
import Link from "next/link";
// NoAudioModal artık listen sayfasında kullanılıyor

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
  hasAudio: boolean;
};

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

function NoAudioModal({ color, onClose }: { color: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-3xl mb-3">🎧</div>
        <h3 className="text-white font-semibold mb-2">Bu kitap yakında eklenecek</h3>
        <p className="text-gray-400 text-sm mb-4">Ses dosyası hazırlanıyor. Kütüphanenizde aktif kitapları dinlemeye devam edebilirsiniz.</p>
        <button onClick={onClose} className="px-5 py-2 text-white text-sm font-medium rounded-xl transition-opacity hover:opacity-85" style={{ backgroundColor: color }}>
          Tamam
        </button>
      </div>
    </div>
  );
}

function BookCard({ book, color }: { book: Book; color: string }) {
  return (
    <Link href={`/dashboard/listen/${book.id}`}>
      <div className="group bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-colors cursor-pointer relative">
        {!book.hasAudio && (
          <div className="absolute top-2 right-2 z-10 bg-gray-900/80 text-gray-400 text-[10px] px-1.5 py-0.5 rounded-full">Yakında</div>
        )}
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} className={`w-full aspect-square object-cover ${!book.hasAudio ? "opacity-60" : ""}`} />
        ) : (
          <div className="w-full aspect-square bg-gray-800 flex items-center justify-center text-4xl">🎧</div>
        )}
        <div className="p-3">
          <h3 className="text-white font-semibold text-xs line-clamp-2">{book.title}</h3>
          <p className="text-gray-500 text-xs mt-0.5">{book.author}</p>
          <div className="flex items-center justify-between mt-2">
            {book.category && <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full truncate max-w-[80px]">{book.category}</span>}
            <span className="text-gray-600 text-[10px]">{formatDuration(book.duration)}</span>
          </div>
          {book.progressPct > 0 && (
            <div className="mt-2 w-full bg-gray-800 rounded-full h-0.5">
              <div className="h-0.5 rounded-full" style={{ width: `${book.progressPct}%`, backgroundColor: color }} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function SeriesCard({ series, color }: { series: SeriesGroup; color: string }) {
  const [expanded, setExpanded] = useState(false);
  const cover = series.coverUrl ?? series.books[0]?.coverUrl;
  const totalDur = series.books.reduce((s, b) => s + b.duration, 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex gap-3 p-3 cursor-pointer hover:bg-gray-800/50 transition-colors" onClick={() => setExpanded(!expanded)}>
        {cover ? (
          <img src={cover} alt={series.name} className="w-14 h-14 object-cover rounded-xl flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 bg-gray-800 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl">🎧</div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm line-clamp-1">{series.name}</h3>
          <p className="text-gray-500 text-xs mt-0.5">{series.books[0]?.author}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full">{series.books.length} kitap</span>
            <span className="text-gray-600 text-[10px]">{formatDuration(totalDur)}</span>
          </div>
        </div>
        <div className="text-gray-500 text-sm self-center">{expanded ? "▲" : "▼"}</div>
      </div>
      {expanded && (
        <div className="border-t border-gray-800 divide-y divide-gray-800">
          {series.books.map((b) => <SeriesBookRow key={b.id} book={b} color={color} />)}
        </div>
      )}
    </div>
  );
}

function SeriesBookRow({ book, color }: { book: Book; color: string }) {
  return (
    <Link href={`/dashboard/listen/${book.id}`}>
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/50 transition-colors cursor-pointer">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} className={`w-10 h-10 object-cover rounded-lg flex-shrink-0 ${!book.hasAudio ? "opacity-50" : ""}`} />
        ) : (
          <div className="w-10 h-10 bg-gray-800 rounded-lg flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-white text-xs font-medium line-clamp-1">{book.seriesOrder ? `${book.seriesOrder}. ` : ""}{book.title}</div>
          <div className="text-gray-500 text-[10px] mt-0.5">{formatDuration(book.duration)}</div>
        </div>
        {!book.hasAudio
          ? <span className="text-gray-500 text-[10px] flex-shrink-0">Yakında</span>
          : book.progressPct > 0
            ? <span className="text-[10px] flex-shrink-0" style={{ color }}>%{book.progressPct}</span>
            : null}
      </div>
    </Link>
  );
}

function Section({ title, items, color }: { title: string; items: (Book | SeriesGroup)[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="text-white font-semibold mb-4">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item) =>
          "books" in item
            ? <SeriesCard key={`series-${item.id}`} series={item} color={color} />
            : <BookCard key={item.id} book={item as Book} color={color} />
        )}
      </div>
    </div>
  );
}

export default function LibraryGrid({ books, color }: { books: Book[]; color: string }) {
  const favorites = books.filter((b) => b.isFavorite);

  // Seri grupla (favoriler dışındaki kitaplar)
  const nonFavorites = books.filter((b) => !b.isFavorite);
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
          hasAudio: false,
        });
      }
      const sg = seriesMap.get(b.seriesId)!;
      sg.books.push(b);
      if (b.hasAudio) sg.hasAudio = true;
    } else {
      soloBooks.push(b);
    }
  }

  // Seri kitapları sıralı hale getir
  for (const sg of seriesMap.values()) {
    sg.books.sort((a, b) => (a.seriesOrder ?? 999) - (b.seriesOrder ?? 999));
  }

  // Kategoriye göre grupla
  const byCategory: Record<string, (Book | SeriesGroup)[]> = {};
  for (const b of soloBooks) {
    const cat = b.category ?? "Diğer";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(b);
  }
  for (const sg of seriesMap.values()) {
    const cat = sg.category ?? "Diğer";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(sg);
  }

  return (
    <div>
      {favorites.length > 0 && (
        <Section title="Favorilerim" items={favorites} color={color} />
      )}
      {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b, "tr")).map(([cat, items]) => (
        <Section key={cat} title={cat} items={items} color={color} />
      ))}
    </div>
  );
}
