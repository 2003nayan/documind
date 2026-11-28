"use client";

import { workspaceCopy } from "@/lib/workspace-copy";
import clsx from "clsx";
import { FileSearch, FileText, Files, MessageSquare } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    seq: number;
  }>({
    docId: null,
    page: 0,
    boxes: [],
    seq: 0,
  });
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [split, setSplit] = useState(50);
  const [source, setSource] = useState<Citation | null>(null);
  const [notice, setNotice] = useState("");
  const citationTrigger = useRef<HTMLButtonElement | null>(null);
  const sourceHeading = useRef<HTMLHeadingElement>(null);
  const composer = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const libraryPanel = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  const openRequest = useRef(0);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [waking, setWaking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const docs = await api.documents();
      setDocuments(docs);
      setLoadError(null);
      const readyIds = new Set(docs.filter((doc) => doc.status === "READY").map((doc) => doc.id));
      if ([...selectedRef.current].some((id) => !readyIds.has(id))) {
        setNotice("A selected PDF is no longer available. Review the remaining documents before asking again.");
      }
      setSelected((prev) => new Set([...prev].filter((id) => readyIds.has(id))));
      setActive((prev) => prev && readyIds.has(prev.id) ? prev : null);
      setSource((prev) => prev && readyIds.has(prev.document_id) ? prev : null);
      return docs;
    } catch (e) {
      setLoadError((e as Error).message);
      return [];
    }
  }, []);

  const open = useCallback(async (id: string, targetPage = 1) => {
    const request = ++openRequest.current;
    const detail = await api.document(id);
    if (request !== openRequest.current) return false;
    setActive(detail);
    setPage(targetPage);
    return true;
  }, []);

  useEffect(() => {
    // Render's free tier sleeps when idle; tell the user instead of looking broken.
    const slow = setTimeout(() => setWaking(true), 3000);
    api
      .config()
      .then(setConfig)
      .catch(() => {});
    const entry = window.location.hash;
    if (entry === "#upload") setTab("docs");
    refresh()
      .then((docs) => {
        if (entry !== "#sample") return;
        const sample = docs.find((doc) => doc.source === "sample" && doc.status === "READY");
        if (!sample) {
          setNotice("No sample is available. You can upload a PDF or refresh the document list.");
          return;
        }
        setSelected(new Set([sample.id]));
        return open(sample.id);
      })
      .catch((error: Error) => setNotice(error.message))
      .finally(() => {
        clearTimeout(slow);
        setWaking(false);
      });
    return () => clearTimeout(slow);
  }, [refresh, open]);

  const isProcessing = documents.some((doc) => doc.status === "PROCESSING");
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, isProcessing ? 2000 : 30000);
    return () => clearInterval(interval);
  }, [isProcessing, refresh]);

  const onCitation = useCallback(
    async (c: Citation, trigger: HTMLButtonElement) => {
      try {
        if (active?.id !== c.document_id) {
          if (!(await open(c.document_id, c.page_number))) return;
        } else {
          openRequest.current++;
          setPage(c.page_number);
        }
        citationTrigger.current = trigger;
        setSource(c);
        setHighlights((h) => ({
          docId: c.document_id,
          page: c.page_number,
          boxes: c.bboxes,
          seq: h.seq + 1,
        }));
        setTab("pdf");
      } catch {
        setNotice("This source could not be opened. It may have expired or been deleted.");
        void refresh();
      }
    },
    [active, open, refresh],
  );

  useEffect(() => {
    if (tab === "pdf" && source) sourceHeading.current?.focus();
  }, [tab, source, highlights.seq]);

  function backToAnswer() {
    setTab("chat");
    requestAnimationFrame(() => citationTrigger.current?.focus());
  }

  function chooseDocuments() {
    setLibraryOpen(true);
    setTab("docs");
    requestAnimationFrame(() => {
      const library = libraryPanel.current;
      (library?.querySelector<HTMLInputElement>('input[type="checkbox"]:enabled') ?? library)?.focus();
    });
  }

  const selectedDocuments = documents.filter((doc) => selected.has(doc.id));
  const sample = documents.find((doc) => doc.source === "sample" && doc.status === "READY");

  const pageInfo = useMemo(
    () => active?.pages.find((p) => p.page_number === page),
    [active, page],
  );

  return (
    <div className="flex h-dvh flex-col bg-slate-950 text-slate-200 [color-scheme:dark]">
      <header className="flex items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-white"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">
            <FileSearch aria-hidden className="size-4" />
          </span>
          DocuMind
        </Link>
        <span className="hidden text-sm text-slate-400 md:inline">
          Grounded Q&amp;A over complex PDFs: layout, tables and scans
        </span>
        <Link
          href="/"
          className="ml-auto text-sm text-slate-400 hover:text-slate-100"
        >
          About
        </Link>
        <a
          className="text-sm text-slate-400 hover:text-slate-100"
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
          className="bg-indigo-950/60 px-4 py-2 text-sm text-indigo-200"
        >
          Waking up the free server. The first request can take up to a minute.
        </div>
      )}
      {(loadError || notice) && (
        <div
          role="alert"
          className="bg-amber-950/50 px-4 py-2 text-sm text-amber-200"
        >
          {loadError || notice}{" "}
          <button className="underline" onClick={() => { setNotice(""); void refresh(); }}>
            Refresh documents
          </button>
        </div>
      )}
      <nav
        className="grid grid-cols-3 border-b border-slate-800 text-sm lg:hidden"
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
              "flex items-center justify-center gap-1.5 py-3",
              tab === id
                ? "border-b-2 border-indigo-600 font-medium text-indigo-300"
                : "text-slate-400",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>
      <main className="min-h-0 flex-1 lg:grid" style={{
        gridTemplateColumns: `${libraryOpen ? "240px " : ""}minmax(0, ${split}fr) minmax(0, ${100 - split}fr)`,
      }}>
        <div
          ref={libraryPanel}
          tabIndex={-1}
          aria-label="Document library"
          className={clsx(
            "h-full min-h-0",
            tab === "docs" ? "block" : "hidden",
            libraryOpen ? "lg:block" : "lg:hidden",
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
              setSource(null);
              setHighlights((previous) => ({ ...previous, docId: null }));
              void open(id).then((opened) => { if (opened) setTab("pdf"); }).catch(() =>
                setNotice("This PDF could not be opened. Refresh the document list and try again."),
              );
            }}
            onAskAbout={(id) => {
              setSelected(new Set([id]));
              setSource(null);
              setTab("chat");
              requestAnimationFrame(() => composer.current?.focus());
              void open(id).catch(() => setNotice("This PDF could not be opened."));
            }}
            uploadButton={uploadButton}
            onUploadStarted={() => { setLibraryOpen(true); setTab("docs"); }}
            onChanged={refresh}
          />
        </div>
        <section
          aria-label="Document chat"
          className={clsx(
            "h-full min-h-0 overflow-hidden border-r border-slate-800",
            tab === "chat" ? "block" : "hidden",
            "lg:block",
          )}
        >
          <div className="flex h-full min-w-0 flex-col">
            <div className="hidden items-center gap-4 border-b border-slate-800 px-4 py-2 text-sm lg:flex">
              <button aria-expanded={libraryOpen} onClick={() => setLibraryOpen(!libraryOpen)} className="font-medium text-indigo-300">
                {libraryOpen ? "Hide documents" : "Show documents"}
              </button>
              {/* <label className="flex items-center gap-2 text-slate-300">
                Chat width
                <input type="range" className="accent-indigo-400" min="35" max="65" value={split} onChange={(event) => setSplit(Number(event.target.value))} />
              </label> */}
            </div>
            <div className="min-h-0 flex-1">
              <Chat
                documents={selectedDocuments}
                composer={composer}
                onChooseDocuments={chooseDocuments}
                onUploadPdf={config?.uploads_enabled ? () => uploadButton.current?.click() : undefined}
                onTrySample={sample ? () => {
                  setSelected(new Set([sample.id]));
                  setSource(null);
                  void open(sample.id).catch(() => setNotice("The sample PDF could not be opened."));
                } : undefined}
                onCitation={onCitation}
                suggestions={selectedDocuments.length === 1 && selectedDocuments[0].title.includes("NACA")
                  ? ["Summarize this PDF", "What wind tunnel or test setup does the NACA report describe?"]
                  : ["Summarize this PDF"]}
              />
            </div>
          </div>
        </section>
        <section
          aria-label="PDF viewer"
          className={clsx(
            "h-full min-h-0 overflow-hidden bg-slate-900",
            tab === "pdf" ? "block" : "hidden",
            "lg:block",
          )}
        >
          <div className="flex h-full min-h-0 flex-col">
            {source && (
              <div className="max-h-48 shrink-0 overflow-auto border-b border-indigo-800 bg-indigo-950/60 px-4 py-3 text-sm">
                <button onClick={backToAnswer} className="mb-2 font-medium text-indigo-300">{workspaceCopy.returnToAnswer}</button>
                <h2 ref={sourceHeading} tabIndex={-1} className="font-semibold">
                  {source.document_title} · p. {source.page_number}
                </h2>
                <blockquote className="my-1 text-slate-300">{source.quote}</blockquote>
                <p className="text-slate-300">{source.bboxes.length ? workspaceCopy.passageLocation : workspaceCopy.pageLocation}</p>
              </div>
            )}
            {active && !selected.has(active.id) && (
              <p className="shrink-0 border-b border-slate-800 px-4 py-2 text-sm text-slate-300">This PDF is open for reading and is outside the current question scope.</p>
            )}
            <div className="min-h-0 flex-1">
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
                  highlightSeq={highlights.seq}
                  onPageChange={setPage}
                />
              ) : (
                <p className="p-6 text-sm text-slate-400">
                  Select a document to view it.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
