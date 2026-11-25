"use client";

import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { sessionId, type BBox } from "@/lib/api";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type Props = {
  url: string;
  title: string;
  page: number;
  pageCount: number;
  highlights: BBox[];
  pageWidthPt?: number;
  onPageChange: (page: number) => void;
};

export default function PdfViewer({ url, title, page, pageCount, highlights, pageWidthPt, onPageChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  // Send the session as a header so it never lands in URLs or access logs.
  const file = useMemo(() => ({ url, httpHeaders: { "X-Session-Id": sessionId() } }), [url]);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setWidth(Math.max(300, el.clientWidth - 32)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => setError(null), [url]);

  const firstHighlight = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => firstHighlight.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    return () => clearTimeout(t);
  }, [highlights, page]);

  const renderWidth = width * zoom;
  const scale = pageWidthPt ? renderWidth / pageWidthPt : 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm">
        <span className="flex-1 truncate font-medium text-slate-800" title={title}>
          {title}
        </span>
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="tabular-nums text-slate-600">
          {page} / {pageCount}
        </span>
        <button aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="rounded p-1 hover:bg-slate-100">
          <ZoomOut className="h-4 w-4" />
        </button>
        <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="rounded p-1 hover:bg-slate-100">
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>
      <div ref={container} className="flex-1 overflow-auto bg-slate-100 p-4">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <Document file={file} onLoadError={(e) => setError(`Could not load PDF: ${e.message}`)} loading={<p className="text-sm text-slate-500">Loading PDF...</p>}>
            <div className="relative mx-auto w-fit shadow" data-testid="pdf-page">
              <Page pageNumber={page} width={renderWidth} />
              {highlights.map((b, i) => (
                <div
                  key={i}
                  ref={i === 0 ? firstHighlight : undefined}
                  data-testid="citation-highlight"
                  className="pointer-events-none absolute rounded-sm bg-indigo-500/10 ring-2 ring-indigo-500/70"
                  style={{
                    left: b.left * scale - 2,
                    top: b.top * scale - 2,
                    width: (b.right - b.left) * scale + 4,
                    height: (b.bottom - b.top) * scale + 4,
                  }}
                />
              ))}
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}
