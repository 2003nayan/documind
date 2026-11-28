"use client";

import { workspaceCopy } from "@/lib/workspace-copy";
import { Loader2, ScanLine, Trash2, Upload, AlertTriangle } from "lucide-react";
import { useRef, useState, type RefObject } from "react";
import clsx from "clsx";
import { api, AppConfig, DocumentInfo } from "@/lib/api";

type Props = {
  documents: DocumentInfo[];
  selected: Set<string>;
  activeId: string | null;
  config: AppConfig | null;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onAskAbout: (id: string) => void;
  uploadButton: RefObject<HTMLButtonElement | null>;
  onUploadStarted: () => void;
  onChanged: () => void;
};

export function DocumentList({ documents, selected, activeId, config, onToggle, onOpen, onAskAbout, uploadButton, onUploadStarted, onChanged }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pending = documents.find((d) => d.id === pendingId);
  const status =
    pending?.status === "PROCESSING"
      ? `Reading ${pending.title}…`
      : pending?.status === "FAILED"
        ? `Couldn’t read ${pending.title}. ${pending.error || "Try uploading another PDF."}`
        : pending?.status === "READY"
          ? `${pending.title} is ready.`
          : null;

  async function upload(file: File) {
    onUploadStarted();
    setUploading(file.name);
    setMessage(null);
    setPendingId(null);
    try {
      const res = await api.upload(file);
      setMessage(res.warnings.join(" ") || null);
      setPendingId(res.document.id);
      onChanged();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setUploading(null);
      if (input.current) input.current.value = "";
    }
  }

  const groups: [string, DocumentInfo[]][] = [
    ["Sample documents", documents.filter((d) => d.source === "sample")],
    ["Your uploads", documents.filter((d) => d.source === "upload")],
  ];

  return (
    <aside id="documents" className="flex h-full flex-col gap-4 overflow-y-auto border-r border-slate-800 bg-slate-900 p-4">
      {config?.uploads_enabled && (
        <div id="upload">
          <input
            ref={input}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button
            ref={uploadButton}
            onClick={() => input.current?.click()}
            disabled={Boolean(uploading)}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 hover:border-indigo-400 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : workspaceCopy.uploadPdf}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Max {config.max_upload_mb} MB / {config.max_upload_pages} pages, {config.uploads_per_ip_per_day} per day. Deleted after{" "}
            {config.upload_ttl_hours} hours. Extracted text may be sent to a third-party AI provider when a hosted provider is used.
          </p>
          <p role="status" className="mt-2 text-sm text-slate-300">
            {uploading ? `Uploading ${uploading}…` : status}
          </p>
          {pending?.status === "READY" && (
            <button className="mt-2 min-h-10 font-semibold text-indigo-300 underline" onClick={() => onAskAbout(pending.id)}>{workspaceCopy.askAboutPdf}</button>
          )}
        </div>
      )}
      {config && !config.uploads_enabled && <p id="upload" className="text-sm text-slate-300">{workspaceCopy.uploadUnavailable}</p>}
      <p role="status" className="empty:hidden text-sm text-slate-300">{message}</p>
      {groups.map(([label, docs]) =>
        docs.length || label === "Your uploads" ? (
          <section key={label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</h2>
            {docs.length === 0 && <p className="text-xs text-slate-400">No uploads yet.</p>}
            <ul className="space-y-1">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className={clsx(
                    "group flex items-start gap-2 rounded-md p-2 text-sm",
                    activeId === d.id ? "bg-slate-800 shadow-sm ring-1 ring-slate-700" : "hover:bg-slate-800",
                  )}
                >
                  <input
                    type="checkbox"
                    aria-label={`Include ${d.title} in search`}
                    className="mt-1 accent-indigo-400"
                    checked={selected.has(d.id)}
                    disabled={d.status !== "READY"}
                    onChange={() => onToggle(d.id)}
                  />
                  <button disabled={d.status !== "READY"} className="min-w-0 flex-1 text-left" onClick={() => onOpen(d.id)}>
                    <span className="line-clamp-2 font-medium text-slate-100">{d.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                      {d.status === "PROCESSING" && <Loader2 className="h-3 w-3 animate-spin" />}
                      {d.status === "FAILED" && <AlertTriangle className="h-3 w-3 text-red-300" />}
                      {d.status === "PROCESSING" ? workspaceCopy.readingPdf : d.status === "FAILED" ? "Couldn’t read this PDF" : `${d.page_count} pages`}
                      {d.parser === "docling" && <ScanLine className="h-3 w-3" aria-label="layout + OCR" />}
                    </span>
                    {d.expires_at && (
                      <span className="mt-0.5 block text-xs text-slate-300">
                        Expires <time dateTime={d.expires_at}>{dateFormat.format(new Date(d.expires_at))}</time>
                      </span>
                    )}
                  </button>
                  {d.source === "upload" && d.status !== "PROCESSING" && (
                    <button
                      aria-label={`Delete ${d.title}`}
                      disabled={Boolean(deleting)}
                      className="min-h-9 min-w-9 text-slate-300 hover:text-red-300 disabled:opacity-50"
                      onClick={async () => {
                        if (!window.confirm(`Delete ${d.title}?`)) return;
                        setDeleting(d.id);
                        setMessage(null);
                        try {
                          await api.remove(d.id);
                          setMessage(`Deleted ${d.title}.`);
                          onChanged();
                        } catch (error) {
                          setMessage((error as Error).message);
                        } finally {
                          setDeleting(null);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}

    </aside>
  );
}
