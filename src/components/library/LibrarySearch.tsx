"use client";

import { useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export default function LibrarySearch({
  defaultValue = "",
  theme = "dark",
}: {
  defaultValue?: string;
  theme?: "dark" | "light";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleChange = useCallback((value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }
      router.push(`?${params.toString()}`);
    }, 350);
  }, [router, searchParams]);

  const handleClear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    router.push(`?${params.toString()}`);
  };

  const isLight = theme === "light";

  return (
    <div className="relative mb-6">
      <Search
        className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
          isLight ? "text-gray-400" : "text-gray-500"
        }`}
      />
      <input
        type="search"
        placeholder="Kitap veya yazar ara…"
        defaultValue={defaultValue}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none transition-colors ${
          isLight
            ? "bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gray-500"
            : "bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:border-gray-600"
        }`}
        aria-label="Kütüphanede ara"
      />
      {defaultValue && (
        <button
          onClick={handleClear}
          className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
            isLight ? "text-gray-400 hover:text-gray-700" : "text-gray-500 hover:text-white"
          }`}
          aria-label="Aramayı temizle"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
