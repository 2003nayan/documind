import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Database,
  FileSearch,
  FileText,
  Layers,
  MessageSquareQuote,
  ScanLine,
  Search,
  ShieldCheck,
  Table2,
} from "lucide-react";

const REPO = "https://github.com/2003nayan/documind";

function Github({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

const STEPS = [
  { icon: FileText, title: "Parse", body: "Docling reads layout, tables and scanned pages (OCR) into page-aware chunks that keep bounding boxes." },
  { icon: Search, title: "Retrieve", body: "Hybrid search: BGE-small dense vectors plus BM25 keywords in Qdrant, fused with reciprocal-rank fusion." },
  { icon: MessageSquareQuote, title: "Answer and verify", body: "Gemini answers only from retrieved passages. The server checks every citation and withholds answers it cannot ground." },
];

const FEATURES = [
  { icon: BadgeCheck, title: "Verified citations", body: "Each citation must point to a retrieved passage and quote text that is really there. No made-up page numbers." },
  { icon: ScanLine, title: "Scans and OCR", body: "Pages without a usable text layer are OCR'd offline, or transcribed by a vision model for live uploads." },
  { icon: Table2, title: "Tables and figures", body: "Tables become their own chunks (Markdown + CSV), so values like ratings and MPG stay retrievable." },
  { icon: FileSearch, title: "Click to the source", body: "Citations open the PDF on the cited page and outline the exact region the answer came from." },
  { icon: ShieldCheck, title: "Safe public demo", body: "Per-IP quotas, page and size limits, session-scoped uploads that expire after 24 hours." },
  { icon: Layers, title: "Pluggable LLMs", body: "Gemini model chain with automatic fallback, optional OpenRouter, and an extractive mode that needs no API key." },
];

const METRICS: [string, string, string][] = [
  ["Gold page in top 5 results (Recall@5)", "100%", "100%"],
  ["MRR@10", "0.81", "0.83"],
  ["Answer contains the expected fact", "65%", "92%"],
  ["Unanswerable questions refused", "1 / 3", "3 / 3"],
  ["Cited page is a gold page", "77%", "83%"],
  ["Median latency (retrieval / LLM)", "8 ms / –", "15 ms / 0.9 s"],
];

const STACK = ["Next.js 15", "React 19", "Tailwind", "react-pdf", "FastAPI", "Docling", "PyMuPDF", "FastEmbed", "Qdrant", "PostgreSQL (Neon)", "Gemini", "uv", "GitHub Actions"];

const HOSTING: [string, string][] = [
  ["Vercel Hobby", "Frontend and API proxy"],
  ["Render free (512 MB)", "FastAPI backend; sleeps after 15 min idle"],
  ["Qdrant Cloud free", "Dense + sparse vectors"],
  ["Neon free", "Metadata, chats, quotas, uploaded PDFs"],
  ["Gemini API free tier", "Answers and vision OCR"],
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3 text-sm">
          <span className="text-lg font-bold tracking-tight text-indigo-700">DocuMind</span>
          <a href="#how" className="hidden text-slate-600 hover:text-slate-900 sm:block">How it works</a>
          <a href="#results" className="hidden text-slate-600 hover:text-slate-900 sm:block">Results</a>
          <a href="#stack" className="hidden text-slate-600 hover:text-slate-900 sm:block">Stack</a>
          <a href={REPO} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1.5 text-slate-600 hover:text-slate-900">
            <Github className="h-4 w-4" /> GitHub
          </a>
          <Link href="/app" className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700">
            Open demo
          </Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgba(99,102,241,0.18),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
          <p className="mx-auto mb-4 w-fit rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Multimodal document intelligence · RAG with verified citations
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Ask complex PDFs. <span className="text-indigo-600">Get answers you can check.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            DocuMind reads technical manuals, scanned reports and tables, then answers questions with citations that jump to
            the exact page and passage. Answers the sources do not support are refused.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/app" className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white shadow-sm hover:bg-indigo-700">
              Try the live demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a href={REPO} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50">
              <Github className="h-4 w-4" /> View source
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-500">Runs on free tiers: the first request after idle can take ~50 s while the server wakes up.</p>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-slate-400">STEP {i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm md:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-2 font-semibold"><Database className="h-4 w-4 text-indigo-600" /> Offline (laptop)</h3>
            <p className="mt-2 font-mono text-xs leading-6 text-slate-600">
              PDF → Docling (layout · TableFormer · OCR) → page-aware chunks → BGE-small + BM25 → Qdrant + Postgres
            </p>
            <p className="mt-2 text-slate-600">The heavy pipeline needs ~3 GB RAM, so sample documents are processed ahead of time.</p>
          </div>
          <div>
            <h3 className="flex items-center gap-2 font-semibold"><Search className="h-4 w-4 text-indigo-600" /> Online (deployed)</h3>
            <p className="mt-2 font-mono text-xs leading-6 text-slate-600">
              Next.js → FastAPI → hybrid search (RRF) → Gemini → citation validation → answer + page highlights
            </p>
            <p className="mt-2 text-slate-600">Live uploads use a lightweight PyMuPDF path plus vision OCR to fit a 512 MB server.</p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">What it does</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6">
                <f.icon className="h-5 w-5 text-indigo-600" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="results" className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight">Measured, not claimed</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-600">
          29 hand-written questions over 3 public PDFs (a 1930s scanned NACA report, the 2024 Fuel Economy Guide and a DOE motor
          handbook), covering scanned text, tables, figures and unanswerable questions.
        </p>
        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Metric</th>
                <th className="px-4 py-3 font-medium">Extractive baseline</th>
                <th className="px-4 py-3 font-medium text-indigo-700">Gemini 3.5 Flash-Lite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {METRICS.map(([m, a, b]) => (
                <tr key={m}>
                  <td className="px-4 py-3 text-slate-700">{m}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{a}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          The 2 Gemini misses were refusals on retrieved pages, never wrong answers. Reproduce with <code>eval/run_eval.py</code>.
        </p>
      </section>

      <section id="stack" className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Stack</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {STACK.map((s) => (
                <span key={s} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Built on free tiers</h2>
            <ul className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white text-sm">
              {HOSTING.map(([name, role]) => (
                <li key={name} className="flex justify-between gap-4 px-4 py-2.5">
                  <span className="font-medium text-slate-800">{name}</span>
                  <span className="text-right text-slate-500">{role}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">See it answer</h2>
        <p className="mt-2 text-slate-600">Pick a sample document, ask a question, then click a citation.</p>
        <Link href="/app" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700">
          Open the demo <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        Built by Nayan Katiyara ·{" "}
        <a href={REPO} className="underline hover:text-slate-800" target="_blank" rel="noreferrer">Source on GitHub</a>
      </footer>
    </div>
  );
}
