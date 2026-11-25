"use client";

import clsx from "clsx";
import { FileText, Files, MessageSquare } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chat } from "@/components/Chat";
import { DocumentList } from "@/components/DocumentList";
import {
  api,
  AppConfig,
  BBox,
  Citation,
  DocumentDetail,
  DocumentInfo,
} from "@/lib/api";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), {
  ssr: false,
});

const SUGGESTIONS = [
  "What is the difference between energy-efficient and premium efficiency motors?",
  "What is the maximum federal tax credit for a qualifying electric vehicle?",
  "What wind tunnel or test setup does the NACA report describe?",
];

type Tab = "docs" | "chat" | "pdf";

export default function Workspace() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<DocumentDetail | null>(null);
  const [page, setPage] = useState(1);
  const [highlights, setHighlights] = useState<{
    docId: string | null;
    page: number;
    boxes: BBox[];
  }>({
    docId: null,
    page: 0,
    boxes: [],
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [waking, setWaking] = useState(false);

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
    // Render's free tier sleeps when idle; tell the user instead of looking broken.
    const slow = setTimeout(() => setWaking(true), 3000);
    api
      .config()
      .then(setConfig)
      .catch(() => {});
    refresh()
      .then((docs) => docs[0] && open(docs[0].id))
      .finally(() => {
        clearTimeout(slow);
        setWaking(false);
      });
    return () => clearTimeout(slow);
  }, [refresh, open]);

  useEffect(() => {
    if (!documents.some((d) => d.status === "PROCESSING")) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [documents, refresh]);

  const onCitation = useCallback(
    async (c: Citation) => {
      if (active?.id !== c.document_id)
        await open(c.document_id, c.page_number);
      else setPage(c.page_number);
      setHighlights({
        docId: c.document_id,
        page: c.page_number,
        boxes: c.bboxes,
      });
      setTab("pdf");
    },
    [active, open],
  );

  const pageInfo = useMemo(
    () => active?.pages.find((p) => p.page_number === page),
    [active, page],
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-2">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-indigo-700"
        >
          DocuMind
        </Link>
        <span className="hidden text-sm text-slate-500 md:inline">
          Grounded Q&amp;A over complex PDFs: layout, tables and scans
        </span>
        <Link
          href="/"
          className="ml-auto text-sm text-slate-500 hover:text-slate-800"
        >
          About
        </Link>
        <a
          className="text-sm text-slate-500 hover:text-slate-800"
          href="https://github.com/2003nayan/documind"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </header>
      {waking && (
        <div
          role="status"
          className="bg-indigo-50 px-4 py-2 text-sm text-indigo-800"
        >
          Waking up the free server. The first request can take up to a minute.
        </div>
      )}
      {loadError && (
        <div
          role="alert"
          className="bg-amber-50 px-4 py-2 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}
      <nav
        className="grid grid-cols-3 border-b border-slate-200 text-sm lg:hidden"
        aria-label="Panels"
      >
        {(
          [
            ["docs", "Documents", Files],
            ["chat", "Chat", MessageSquare],
            ["pdf", "PDF", FileText],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={clsx(
              "flex items-center justify-center gap-1.5 py-2",
              tab === id
                ? "border-b-2 border-indigo-600 font-medium text-indigo-700"
                : "text-slate-500",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>
      <main className="min-h-0 flex-1 lg:grid lg:grid-cols-[260px_minmax(360px,1fr)_minmax(360px,1.1fr)]">
        <div
          className={clsx(
            "h-full min-h-0",
            tab === "docs" ? "block" : "hidden",
            "lg:block",
          )}
        >
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
            onOpen={(id) => {
              open(id);
              setTab("pdf");
            }}
            onChanged={refresh}
          />
        </div>
        <section
          className={clsx(
            "h-full min-h-0 overflow-hidden border-r border-slate-200",
            tab === "chat" ? "block" : "hidden",
            "lg:block",
          )}
        >
          <Chat
            documentIds={[...selected]}
            onCitation={onCitation}
            suggestions={SUGGESTIONS}
          />
        </section>
        <section
          className={clsx(
            "h-full min-h-0 overflow-hidden",
            tab === "pdf" ? "block" : "hidden",
            "lg:block",
          )}
        >
          {active ? (
            <PdfViewer
              url={api.fileUrl(active.id)}
              title={active.title}
              page={page}
              pageCount={active.page_count}
              pageWidthPt={pageInfo?.width}
              highlights={
                highlights.docId === active.id && highlights.page === page
                  ? highlights.boxes
                  : []
              }
              onPageChange={(p) => setPage(p)}
            />
          ) : (
            <p className="p-6 text-sm text-slate-500">
              Select a document to view it.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

const knownIds = new Set<string>();
