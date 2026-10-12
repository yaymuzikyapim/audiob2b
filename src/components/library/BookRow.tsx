"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BookCard, { BookCardItem } from "./BookCard";

export default function BookRow({
  title,
  books,
  color,
  totalCount,
  href,
  showListeners = false,
  theme = "dark",
}: {
  title: string;
  books: BookCardItem[];
  color: string;
  totalCount?: number;
  href?: string;
  showListeners?: boolean;
  theme?: "dark" | "light";
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? el.clientWidth * 0.8 : -el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (books.length === 0) return null;

  const isLight = theme === "light";
  const showSeeAll = href && totalCount !== undefined && totalCount > books.length;
  const showArrows = canLeft || canRight;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2
          className={`font-semibold text-sm truncate ${
            isLight ? "text-gray-900" : "text-white"
          }`}
        >
          {title}
        </h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showSeeAll && (
            <Link
              href={href!}
              className={`text-xs transition-colors whitespace-nowrap ${
                isLight
                  ? "text-gray-500 hover:text-gray-900"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Tümünü gör · {totalCount}
            </Link>
          )}
          {showArrows && (
            <div className="flex gap-1">
              <button
                onClick={() => scroll("left")}
                disabled={!canLeft}
                className={`p-1 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  isLight
                    ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    : "bg-gray-800 hover:bg-gray-700 text-white"
                }`}
                aria-label="Sola kaydır"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => scroll("right")}
                disabled={!canRight}
                className={`p-1 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  isLight
                    ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    : "bg-gray-800 hover:bg-gray-700 text-white"
                }`}
                aria-label="Sağa kaydır"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide"
        style={{ scrollSnapType: "x mandatory" }}
        role="list"
        aria-label={title}
      >
        {books.map((book) => (
          <div
            key={book.id}
            className="flex-shrink-0"
            style={{ width: 120, scrollSnapAlign: "start" }}
            role="listitem"
          >
            <BookCard book={book} color={color} showListeners={showListeners} theme={theme} />
          </div>
        ))}
      </div>
    </div>
  );
}
