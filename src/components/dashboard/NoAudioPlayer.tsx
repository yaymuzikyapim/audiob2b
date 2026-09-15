"use client";

import { useState } from "react";

export default function NoAudioPlayer({ color }: { color: string }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setShowModal(true)}
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 opacity-50 cursor-pointer"
            style={{ backgroundColor: color }}
          >
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="w-full bg-gray-800 rounded-full h-1 mb-2">
              <div className="h-1 rounded-full bg-gray-700 w-0" />
            </div>
            <div className="flex justify-between text-gray-600 text-xs">
              <span>0:00</span>
              <span>--:--</span>
            </div>
          </div>
        </div>
        <p className="text-gray-500 text-sm text-center">Ses dosyası henüz hazır değil</p>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-3xl mb-3">🎧</div>
            <h3 className="text-white font-semibold mb-2">Bu kitap yakında eklenecek</h3>
            <p className="text-gray-400 text-sm mb-4">Ses dosyası hazırlanıyor. Kütüphanenizde aktif kitapları dinlemeye devam edebilirsiniz.</p>
            <button
              onClick={() => setShowModal(false)}
              className="px-5 py-2 text-white text-sm font-medium rounded-xl transition-opacity hover:opacity-85"
              style={{ backgroundColor: color }}
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </>
  );
}
