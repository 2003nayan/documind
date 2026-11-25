"use client";

import clsx from "clsx";
import { BadgeCheck, FileText, Search, Sparkles } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Box = { left: number; top: number; right: number; bottom: number };

// Real questions, Gemini answers and citation boxes from the sample documents.
const EXAMPLES: {
  doc: string;
  tag: string;
  question: string;
  answer: string;
  page: number;
  img: string;
  w: number;
  h: number;
  boxes: Box[];
}[] = [
  {
    doc: "NACA Report 468 (scanned, 1933)",
    tag: "OCR",
    question: "Who are the authors of the report on interference between struts?",
    answer: "The report was authored by David Biermann and William H. Herrnstein, Jr.",
    page: 5,
    img: "/landing/naca-p5.jpg",
    w: 632,
    h: 816,
    boxes: [
      { left: 81, top: 182, right: 514, bottom: 192 },
      { left: 182, top: 203, right: 414, bottom: 213 },
    ],
  },
  {
    doc: "Fuel Economy Guide 2024",
    tag: "Layout",
    question: "What is the maximum federal tax credit for a qualifying electric vehicle?",
    answer:
      "You may be eligible for a federal income tax credit of up to $7,500 if you purchase a qualifying all-electric vehicle (EV), plug-in hybrid, or fuel cell vehicle in 2023-2024.",
    page: 5,
    img: "/landing/fuel-p5.jpg",
    w: 612,
    h: 792,
    boxes: [
      { left: 36, top: 466, right: 114, bottom: 476 },
      { left: 36, top: 481, right: 287, bottom: 511 },
    ],
  },
];

type Phase = "typing" | "searching" | "answering" | "cited";

export function HeroDemo() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [n, setN] = useState(0);
  const [reduced, setReduced] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const ex = EXAMPLES[index];
  const words = ex.answer.split(" ");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setPhase("cited");
    }
  }, []);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      t = n < ex.question.length ? setTimeout(() => setN(n + 1), 32) : setTimeout(() => (setN(0), setPhase("searching")), 450);
    } else if (phase === "searching") {
      t = setTimeout(() => setPhase("answering"), 1300);
    } else if (phase === "answering") {
      t = n < words.length ? setTimeout(() => setN(n + 1), 60) : setTimeout(() => setPhase("cited"), 250);
    } else {
      t = setTimeout(() => {
        setIndex((i) => (i + 1) % EXAMPLES.length);
        setN(0);
        setPhase("typing");
      }, 5000);
    }
    return () => clearTimeout(t);
  }, [phase, n, ex.question.length, words.length, reduced]);

  const cited = phase === "cited";
  const shownAnswer = phase === "answering" ? words.slice(0, n).join(" ") : cited ? ex.answer : "";
  const xs = ex.boxes.flatMap((b) => [b.left, b.right]);
  const ys = ex.boxes.flatMap((b) => [b.top, b.bottom]);
  const cx = ((Math.min(...xs) + Math.max(...xs)) / 2 / ex.w) * 100;
  const cy = ((Math.min(...ys) + Math.max(...ys)) / 2 / ex.h) * 100;
  // Zoom in as far as the cited region still fits, then pan it to the viewport centre (clamped to the page).
  const zoom = Math.min(1.9, 0.85 / ((Math.max(...xs) - Math.min(...xs)) / ex.w));
  const pageH = (size.w * ex.h) / ex.w;
  const clamp = (v: number, lo: number) => Math.min(0, Math.max(lo, v));
  const tx = clamp(size.w / 2 - (cx / 100) * size.w * zoom, size.w - size.w * zoom);
  const ty = clamp(size.h / 2 - (cy / 100) * pageH * zoom, size.h - pageH * zoom);

  return (
    <div className="relative mx-auto max-w-5xl">
      <div className="absolute -inset-x-10 -inset-y-6 -z-10 rounded-[2rem] bg-gradient-to-r from-indigo-600/30 via-fuchsia-500/20 to-cyan-500/30 blur-3xl" />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-indigo-950/50 ring-1 ring-white/5 backdrop-blur">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-rose-400/80" />
          <span className="h-3 w-3 rounded-full bg-amber-300/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          <span className="mx-auto rounded-md bg-white/5 px-3 py-0.5 font-mono text-[11px] text-slate-400">documind / app</span>
        </div>
        <div className="grid md:grid-cols-[1fr_1fr]">
          <div className="flex min-h-[360px] flex-col gap-3 p-4 text-left sm:p-5 md:min-h-[440px]">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <FileText className="h-3.5 w-3.5 text-indigo-300" />
              <span className="truncate">{ex.doc}</span>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-px text-[10px] font-medium text-cyan-300">{ex.tag}</span>
            </div>
            <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-indigo-600 px-3.5 py-2 text-sm text-white shadow-lg shadow-indigo-900/40">
              {phase === "typing" ? ex.question.slice(0, n) : ex.question}
              {phase === "typing" && <span className="caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-white" />}
            </div>
            {phase === "searching" && (
              <div className="shimmer flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                <Search className="h-3.5 w-3.5 text-cyan-300" /> Hybrid search: dense + BM25 → 8 passages
              </div>
            )}
            {(phase === "answering" || cited) && (
              <div className="max-w-[95%] rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm leading-relaxed text-slate-100">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-fuchsia-300">
                  <Sparkles className="h-3 w-3" /> Gemini
                </div>
                {shownAnswer}
                {phase === "answering" && <span className="caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-slate-300" />}
                {cited && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="pop rounded-md border border-indigo-400/40 bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-200 shadow-[0_0_18px_-4px_rgba(129,140,248,0.9)]">
                      [1] p.{ex.page}
                    </span>
                    <span className="pop flex items-center gap-1 text-[11px] text-emerald-300" style={{ animationDelay: "150ms" }}>
                      <BadgeCheck className="h-3.5 w-3.5" /> Quote verified on page {ex.page}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="mt-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-500">
              Ask a question about the selected documents...
            </div>
          </div>
          <div className="relative border-t border-white/10 bg-slate-950/60 p-4 md:border-t-0 md:border-l">
            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Page {ex.page}</span>
              <span className={clsx("transition-opacity", cited ? "opacity-100" : "opacity-0")}>Jumped to cited region</span>
            </div>
            <div ref={viewport} className="relative h-[300px] overflow-hidden rounded-lg bg-white shadow-inner sm:h-[380px]">
              <div
                className="relative w-full transition-transform duration-[1400ms] ease-out motion-reduce:transition-none"
                style={{
                  aspectRatio: `${ex.w} / ${ex.h}`,
                  transformOrigin: "0 0",
                  transform: cited ? `translate(${tx}px, ${ty}px) scale(${zoom})` : "none",
                }}
              >
                <Image key={ex.img} src={ex.img} alt={`${ex.doc}, page ${ex.page}`} fill sizes="(min-width: 768px) 480px, 100vw" className="object-cover" priority />
                {cited &&
                  ex.boxes.map((b, i) => (
                    <div
                      key={`${index}-${i}`}
                      className="hl-draw absolute rounded-[2px] bg-indigo-500/20 ring-2 ring-indigo-500"
                      style={{
                        left: `${((b.left - 3) / ex.w) * 100}%`,
                        top: `${((b.top - 3) / ex.h) * 100}%`,
                        width: `${((b.right - b.left + 6) / ex.w) * 100}%`,
                        height: `${((b.bottom - b.top + 6) / ex.h) * 100}%`,
                        animationDelay: `${300 + i * 200}ms`,
                      }}
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-2">
        {EXAMPLES.map((e, i) => (
          <span key={e.doc} className={clsx("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-indigo-400" : "w-1.5 bg-white/20")} />
        ))}
      </div>
    </div>
  );
}
