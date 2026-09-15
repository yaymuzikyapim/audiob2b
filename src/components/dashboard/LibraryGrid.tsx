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
};

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

function BookCard({ book, color }: { book: Book; color: string }) {
  const [showModal, setShowModal] = useState(false);

  const inner = (
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
          {book.category && (
            <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full truncate max-w-[80px]">{book.category}</span>
          )}
          <span className="text-gray-600 text-[10px]">{formatDuration(book.duration)}</span>
        </div>
        {book.progressPct > 0 && (
          <div className="mt-2">
            <div className="w-full bg-gray-800 rounded-full h-0.5">
              <div className="h-0.5 rounded-full" style={{ width: `${book.progressPct}%`, backgroundColor: color }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (!book.hasAudio) {
    return (
      <>
        <div onClick={() => setShowModal(true)}>{inner}</div>
        {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
              <div className="text-3xl mb-3">🎧</div>
              <h3 className="text-white font-semibold mb-2">Bu kitap yakında eklenecek</h3>
              <p className="text-gray-400 text-sm mb-4">Ses dosyası hazırlanıyor. Kütüphanenizde aktif kitapları dinlemeye devam edebilirsiniz.</p>
              <button onClick={() => setShowModal(false)}
                className="px-5 py-2 text-white text-sm font-medium rounded-xl transition-opacity hover:opacity-85"
                style={{ backgroundColor: color }}>
                Tamam
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return <Link href={`/dashboard/listen/${book.id}`}>{inner}</Link>;
}

function Section({ title, books, color }: { title: string; books: Book[]; color: string }) {
  if (books.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="text-white font-semibold mb-4">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {books.map((b) => <BookCard key={b.id} book={b} color={color} />)}
      </div>
    </div>
  );
}

export default function LibraryGrid({ books, color }: { books: Book[]; color: string }) {
  const favorites = books.filter((b) => b.isFavorite);
  const nonFavorites = books.filter((b) => !b.isFavorite);

  const byCategory: Record<string, Book[]> = {};
  for (const b of nonFavorites) {
    const cat = b.category ?? "Diğer";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(b);
  }

  return (
    <div>
      {favorites.length > 0 && <Section title="Favorilerim" books={favorites} color={color} />}
      {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b, "tr")).map(([cat, catBooks]) => (
        <Section key={cat} title={cat} books={catBooks} color={color} />
      ))}
    </div>
  );
}
