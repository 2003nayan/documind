"use client";

import { workspaceCopy } from "@/lib/workspace-copy";
import { Loader2, SendHorizonal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import { api, ApiError, ChatResponse, Citation, DocumentInfo } from "@/lib/api";

type Question = { text: string; ids: string[]; titles: string[] };
type OpenCitation = (citation: Citation, trigger: HTMLButtonElement) => void;

type Message =
  | { role: "user"; question: Question }
  | { role: "assistant"; response: ChatResponse }
  | { role: "error"; text: string; question: Question; retryable: boolean };

type Props = {
  documents: DocumentInfo[];
  composer: RefObject<HTMLInputElement | null>;
  onCitation: OpenCitation;
  onChooseDocuments: () => void;
  onUploadPdf?: () => void;
  onTrySample?: () => void;
  suggestions: string[];
};

export function Chat({ documents, composer, onCitation, onChooseDocuments, onUploadPdf, onTrySample, suggestions }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) return setSlow(false);
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);
  const bottom = useRef<HTMLDivElement>(null);

  // Scroll only the message list, never the page (the panels stack on mobile).
  useEffect(() => {
    const list = bottom.current?.parentElement;
    list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function submit(text: string) {
    if (text.trim().length < 2 || !documents.length || loading) return;
    const request = {
      text: text.trim(),
      ids: documents.map((document) => document.id),
      titles: documents.map((document) => document.title),
    };
    setQuestion("");
    setMessages((previous) => [...previous, { role: "user", question: request }]);
    void ask(request);
  }

  async function ask(request: Question, retryIndex?: number) {
    if (loading) return;
    setLoading(true);
    function showResult(message: Message) {
      setMessages((previous) => retryIndex === undefined
        ? [...previous, message]
        : previous.map((item, index) => index === retryIndex ? message : item));
    }
    try {
      const response = await api.chat(request.text, request.ids, conversationId);
      setConversationId(response.conversation_id);
      showResult({ role: "assistant", response });
    } catch (e) {
      const retryable = !(e instanceof ApiError) || e.status >= 500;
      showResult({ role: "error", text: (e as Error).message, question: request, retryable });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div role="log" aria-label="Conversation" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mx-auto mt-8 max-w-md text-center">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-950/60 text-indigo-300">
              <Sparkles className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-semibold text-slate-100">Ask your documents</h1>
            <p className="mt-2 text-sm text-slate-300">
              {documents.length ? "Ask a question, then open a citation to check the source." : "Choose a sample or upload a PDF to get started."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {documents.length ? suggestions.map((suggestion) => (
                <button key={suggestion} disabled={loading} onClick={() => submit(suggestion)} className="min-h-11 rounded-md border border-slate-700 px-3 text-sm text-indigo-300 hover:bg-indigo-950/60">
                  {suggestion}
                </button>
              )) : (
                <>
                  {onTrySample && <button onClick={onTrySample} className="min-h-11 rounded-md bg-indigo-700 px-4 text-sm font-semibold text-white">{workspaceCopy.trySample}</button>}
                  {onUploadPdf && <button onClick={onUploadPdf} className="min-h-11 rounded-md border border-slate-700 px-4 text-sm font-semibold text-indigo-300">{workspaceCopy.uploadPdf}</button>}
                  <button onClick={onChooseDocuments} className="min-h-11 rounded-md border border-slate-700 px-4 text-sm font-semibold text-indigo-300">{workspaceCopy.choosePdf}</button>
                </>
              )}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">
              {m.question.text}
              <div className="mt-1 break-words text-xs text-indigo-100">{m.question.titles.join(", ")}</div>
            </div>
          ) : m.role === "error" ? (
            <div key={i} role="alert" className="max-w-[85%] rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200">
              {m.text}
              {m.retryable && (
                <button disabled={loading} onClick={() => void ask(m.question, i)} className="mt-2 block font-semibold underline">
                  Retry this question
                </button>
              )}
            </div>
          ) : (
            <AssistantMessage key={i} response={m.response} onCitation={onCitation} />
          ),
        )}
        {loading && (
          <div role="status" className="w-fit rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-300" /> Searching the documents and checking citations...
            </span>
            {slow && <span className="mt-1 block text-xs text-slate-400">Still working: the free server or the LLM may be busy. This can take up to a minute.</span>}
          </div>
        )}
        <div ref={bottom} />
      </div>
      <form
        className="border-t border-slate-800 bg-slate-950 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
      >
        <div id="question-scope" className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="min-w-0 break-words text-slate-300">
            {documents.length ? <><strong>{workspaceCopy.questionScope}</strong> {documents.map((document) => document.title).join(", ")}</> : workspaceCopy.chooseReady}
          </span>
          <button type="button" onClick={onChooseDocuments} className="font-medium text-indigo-300 underline">{workspaceCopy.changeDocuments}</button>
        </div>
        <div className="flex gap-2">
          <input
            ref={composer}
            aria-describedby="question-scope"
            aria-label="Question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={documents.length ? "Ask a question about the selected documents..." : "Select at least one document"}
            maxLength={1000}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-700 px-3 py-2 text-sm bg-slate-900 placeholder:text-slate-400 focus:border-indigo-400 disabled:bg-slate-900"
          />
          <button type="submit" aria-label="Send" disabled={loading || question.trim().length < 2 || !documents.length} className="min-w-11 rounded-md bg-indigo-600 px-3 text-white hover:bg-indigo-700 disabled:opacity-40">
            <SendHorizonal className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function AssistantMessage({ response, onCitation }: { response: ChatResponse; onCitation: OpenCitation }) {
  function renderCitations(citations: Citation[]) {
    if (!citations.length) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {citations.map((citation) => (
          <button
            key={citation.index}
            onClick={(event) => onCitation(citation, event.currentTarget)}
            data-testid="citation"
            className="min-h-10 rounded-md border border-indigo-700 bg-indigo-950/60 px-3 py-1 text-left text-xs font-medium text-indigo-200 hover:bg-indigo-900/70"
          >
            {citation.document_title} · p. {citation.page_number}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-[92%] rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-100" data-testid="assistant-message">
      {response.sections?.length ? (
        <div className="space-y-4">
          {response.sections.map((section, index) => (
            <section key={index} className={section.kind === "background" ? "rounded-md bg-slate-900 p-3" : undefined}>
              <h2 className="mb-1 font-semibold">{section.kind === "background" ? workspaceCopy.background : workspaceCopy.documentEvidence}</h2>
              <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{section.text}</ReactMarkdown></div>
              {renderCitations(response.citations.filter((citation) => section.citation_indices.includes(citation.index)))}
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className={clsx("prose prose-invert prose-sm max-w-none", !response.found && "text-slate-300")}>
            {response.found ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{response.answer.replace(/\s*\[S\d+(?:\s*,\s*S\d+)*\]/g, "")}</ReactMarkdown> :
              <p>{response.warning ? response.warning : workspaceCopy.noEvidence}</p>}
          </div>
          {response.found && renderCitations(response.citations)}
        </>
      )}
      <details className="mt-3 text-xs text-slate-300">
        <summary className="cursor-pointer font-medium">{workspaceCopy.answerDetails}</summary>
        <p className="mt-2">{response.provider} · retrieval {response.retrieval_ms} ms · answer {response.latency_ms} ms</p>
        <ol className="mt-2 space-y-2 border-t border-slate-800 pt-2 text-xs text-slate-300">
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
      </details>
    </div>
  );
}
