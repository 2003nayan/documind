"use client";

import { Loader2, SendHorizonal, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import { api, ChatResponse, Citation } from "@/lib/api";

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; response: ChatResponse }
  | { role: "error"; text: string };

type Props = {
  documentIds: string[];
  onCitation: (c: Citation) => void;
  suggestions: string[];
};

export function Chat({ documentIds, onCitation, suggestions }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const bottom = useRef<HTMLDivElement>(null);

  // Scroll only the message list, never the page (the panels stack on mobile).
  useEffect(() => {
    const list = bottom.current?.parentElement;
    list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const response = await api.chat(q, documentIds, conversationId);
      setConversationId(response.conversation_id);
      setMessages((m) => [...m, { role: "assistant", response }]);
      if (response.citations[0]) onCitation(response.citations[0]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", text: (e as Error).message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mx-auto mt-8 max-w-md text-center">
            <h1 className="text-xl font-semibold text-slate-800">Ask your documents</h1>
            <p className="mt-1 text-sm text-slate-500">
              Answers cite the exact page. Citations are verified against the retrieved text, so the model cannot invent page numbers.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-md border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-indigo-300 hover:bg-indigo-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">
              {m.text}
            </div>
          ) : m.role === "error" ? (
            <div key={i} role="alert" className="max-w-[85%] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {m.text}
            </div>
          ) : (
            <AssistantMessage key={i} response={m.response} onCitation={onCitation} />
          ),
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching and answering...
          </div>
        )}
        <div ref={bottom} />
      </div>
      <form
        className="flex gap-2 border-t border-slate-200 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <input
          aria-label="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={documentIds.length ? "Ask a question about the selected documents..." : "Select at least one document"}
          disabled={!documentIds.length}
          maxLength={1000}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50"
        />
        <button type="submit" aria-label="Send" disabled={loading || !question.trim() || !documentIds.length} className="rounded-md bg-indigo-600 px-3 text-white hover:bg-indigo-700 disabled:opacity-40">
          <SendHorizonal className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function AssistantMessage({ response, onCitation }: { response: ChatResponse; onCitation: (c: Citation) => void }) {
  const [showSources, setShowSources] = useState(false);
  return (
    <div className="max-w-[92%] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" data-testid="assistant-message">
      <div className={clsx("prose prose-sm max-w-none", !response.found && "text-slate-500 italic")}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{response.answer}</ReactMarkdown>
      </div>
      {response.warning && <p className="mt-2 text-xs text-amber-700">{response.warning}</p>}
      {response.citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {response.citations.map((c) => (
            <button
              key={`${c.chunk_id}-${c.index}`}
              onClick={() => onCitation(c)}
              title={c.quote}
              data-testid="citation"
              className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-100"
            >
              [{c.index}] {c.document_title.slice(0, 28)}
              {c.document_title.length > 28 ? "…" : ""}, p.{c.page_number}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
        <span>
          {response.provider} · retrieval {response.retrieval_ms} ms · LLM {response.latency_ms} ms
        </span>
        <button className="flex items-center gap-1 hover:text-slate-600" onClick={() => setShowSources((s) => !s)}>
          <Info className="h-3 w-3" /> {showSources ? "Hide" : "Show"} {response.retrieved.length} retrieved passages
        </button>
      </div>
      {showSources && (
        <ol className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
          {response.retrieved.map((r, i) => (
            <li key={r.chunk_id}>
              <span className="font-medium">
                S{i + 1} · p.{r.page_number} · {r.chunk_type}
                {r.section ? ` · ${r.section}` : ""}
              </span>
              <p className="line-clamp-3 whitespace-pre-wrap">{r.content}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
