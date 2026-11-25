"use client";

import { Loader2, ScanLine, Trash2, Upload, AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";
import clsx from "clsx";
import { api, AppConfig, DocumentInfo } from "@/lib/api";

type Props = {
  documents: DocumentInfo[];
  selected: Set<string>;
  activeId: string | null;
  config: AppConfig | null;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onChanged: () => void;
};

export function DocumentList({ documents, selected, activeId, config, onToggle, onOpen, onChanged }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.upload(file);
      setMessage(res.warnings.join(" ") || `Uploaded ${res.document.title}; indexing...`);
      onChanged();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const groups: [string, DocumentInfo[]][] = [
    ["Sample documents", documents.filter((d) => d.source === "sample")],
    ["Your uploads", documents.filter((d) => d.source === "upload")],
  ];

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4">
      {groups.map(([label, docs]) =>
        docs.length || label === "Your uploads" ? (
          <section key={label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h2>
            {docs.length === 0 && <p className="text-xs text-slate-400">No uploads yet.</p>}
            <ul className="space-y-1">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className={clsx(
                    "group flex items-start gap-2 rounded-md p-2 text-sm",
                    activeId === d.id ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white",
                  )}
                >
                  <input
                    type="checkbox"
                    aria-label={`Include ${d.title} in search`}
                    className="mt-1 accent-indigo-600"
                    checked={selected.has(d.id)}
                    disabled={d.status !== "READY"}
                    onChange={() => onToggle(d.id)}
                  />
                  <button className="flex-1 text-left" onClick={() => onOpen(d.id)}>
                    <span className="line-clamp-2 font-medium text-slate-800">{d.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      {d.status === "PROCESSING" && <Loader2 className="h-3 w-3 animate-spin" />}
                      {d.status === "FAILED" && <AlertTriangle className="h-3 w-3 text-red-500" />}
                      {d.page_count} pages · {d.pipeline === "full" ? "Docling" : d.parser === "gemini_vision" ? "Vision OCR" : "Lite"}
                      {d.parser === "docling" && <ScanLine className="h-3 w-3" aria-label="layout + OCR" />}
                    </span>
                  </button>
                  {d.source === "upload" && d.status !== "PROCESSING" && (
                    <button
                      aria-label={`Delete ${d.title}`}
                      className="invisible text-slate-400 hover:text-red-600 group-hover:visible"
                      onClick={async () => {
                        await api.remove(d.id);
                        onChanged();
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

      {config?.uploads_enabled && (
        <div className="mt-auto">
          <input
            ref={input}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-indigo-400 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload PDF
          </button>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Max {config.max_upload_mb} MB / {config.max_upload_pages} pages, {config.uploads_per_ip_per_day} per day. Deleted after{" "}
            {config.upload_ttl_hours}h. Uploaded text is sent to a third-party LLM; don&apos;t upload private files.
          </p>
          {message && <p className="mt-2 text-xs text-slate-700">{message}</p>}
        </div>
      )}
    </aside>
  );
}
