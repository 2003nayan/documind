"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chat } from "@/components/Chat";
import { DocumentList } from "@/components/DocumentList";
import { api, AppConfig, BBox, Citation, DocumentDetail, DocumentInfo } from "@/lib/api";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), { ssr: false });

const SUGGESTIONS = [
  "What is the difference between energy-efficient and premium efficiency motors?",
  "Which vehicle class has the best combined fuel economy?",
  "What wind tunnel or test setup does the NACA report describe?",
];

export default function Home() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<DocumentDetail | null>(null);
  const [page, setPage] = useState(1);
  const [highlights, setHighlights] = useState<{ docId: string | null; page: number; boxes: BBox[] }>({
    docId: null,
    page: 0,
    boxes: [],
  });
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const docs = await api.documents();
      setDocuments(docs);
      setLoadError(null);
      setSelected((prev) => {
        const ready = docs.filter((d) => d.status === "READY").map((d) => d.id);
        const next = new Set([...prev].filter((id) => ready.includes(id)));
        // New ready docs are selected by default.
        for (const id of ready) if (!knownIds.has(id)) next.add(id);
        ready.forEach((id) => knownIds.add(id));
        return next;
      });
      return docs;
    } catch (e) {
      setLoadError((e as Error).message);
      return [];
    }
  }, []);

  const open = useCallback(async (id: string, targetPage = 1) => {
    const detail = await api.document(id);
    setActive(detail);
    setPage(targetPage);
  }, []);

  useEffect(() => {
    api.config().then(setConfig).catch(() => {});
    refresh().then((docs) => docs[0] && open(docs[0].id));
  }, [refresh, open]);

  useEffect(() => {
    if (!documents.some((d) => d.status === "PROCESSING")) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [documents, refresh]);

  const onCitation = useCallback(
    async (c: Citation) => {
      if (active?.id !== c.document_id) await open(c.document_id, c.page_number);
      else setPage(c.page_number);
      setHighlights({ docId: c.document_id, page: c.page_number, boxes: c.bboxes });
    },
    [active, open],
  );

  const pageInfo = useMemo(() => active?.pages.find((p) => p.page_number === page), [active, page]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-2">
        <span className="text-lg font-bold text-indigo-700">DocuMind</span>
        <span className="text-sm text-slate-500">Grounded Q&amp;A over complex PDFs: layout, tables and scans</span>
        <a className="ml-auto text-sm text-slate-500 hover:text-slate-800" href="https://github.com/2003nayan/documind" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </header>
      {loadError && <div role="alert" className="bg-amber-50 px-4 py-2 text-sm text-amber-800">{loadError}</div>}
      <main className="flex flex-1 flex-col overflow-y-auto *:shrink-0 lg:grid lg:grid-cols-[260px_minmax(360px,1fr)_minmax(360px,1.1fr)] lg:overflow-hidden">
        <DocumentList
          documents={documents}
          selected={selected}
          activeId={active?.id ?? null}
          config={config}
          onToggle={(id) =>
            setSelected((s) => {
              const n = new Set(s);
              if (n.has(id)) n.delete(id);
              else n.add(id);
              return n;
            })
          }
          onOpen={(id) => open(id)}
          onChanged={refresh}
        />
        <section className="h-[80vh] overflow-hidden border-r border-slate-200 lg:h-auto">
          <Chat documentIds={[...selected]} onCitation={onCitation} suggestions={SUGGESTIONS} />
        </section>
        <section className="h-[80vh] overflow-hidden lg:h-auto">
          {active ? (
            <PdfViewer
              url={api.fileUrl(active.id)}
              title={active.title}
              page={page}
              pageCount={active.page_count}
              pageWidthPt={pageInfo?.width}
              highlights={highlights.docId === active.id && highlights.page === page ? highlights.boxes : []}
              onPageChange={(p) => setPage(p)}
            />
          ) : (
            <p className="p-6 text-sm text-slate-500">Select a document to view it.</p>
          )}
        </section>
      </main>
    </div>
  );
}

const knownIds = new Set<string>();
