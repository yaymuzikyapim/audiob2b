"use client";

import { useState } from "react";
import { FAQS } from "@/data/faqs";

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="sss" className="py-20 max-w-4xl mx-auto px-6 scroll-mt-6">
      <div className="text-center mb-12">
        <span className="text-orange-600 font-semibold text-xs tracking-wider uppercase bg-orange-50 px-3 py-1 rounded-full">
          Merak Edilenler
        </span>
        <h2 className="text-3xl font-bold mt-3 text-gray-900">
          Sıkça Sorulan Sorular
        </h2>
        <p className="text-gray-500 mt-2 text-sm sm:text-base">
          AudioB2B kurumsal sesli kitap platformu hakkında en çok merak edilen konular.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="border border-gray-200 rounded-2xl bg-white overflow-hidden transition-all duration-200 shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:text-orange-600 transition-colors"
                aria-expanded={isOpen}
              >
                <span className="text-base sm:text-lg">{faq.question}</span>
                <span
                  className={`w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180 bg-orange-100 text-orange-600" : ""
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              </button>
              {isOpen && (
                <div className="px-6 pb-5 text-gray-600 text-sm sm:text-base leading-relaxed border-t border-gray-100 pt-3">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
