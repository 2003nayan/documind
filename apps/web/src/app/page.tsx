import { workspaceCopy } from "@/lib/workspace-copy";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CircleX,
  Database,
  FileSearch,
  FileText,
  Layers,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
} from "lucide-react";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { Counter, Reveal } from "@/components/landing/Motion";

const REPO = "https://github.com/2003nayan/documind";

function Github({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

const PIPELINE = [
  { icon: FileText, title: "PDF", body: "Manuals, scans, tables" },
  { icon: ScanLine, title: "Parse", body: "Docling layout · OCR · TableFormer" },
  { icon: Search, title: "Retrieve", body: "BGE-small + BM25 · RRF fusion" },
  { icon: Sparkles, title: "Generate", body: "Gemini, grounded in passages" },
  { icon: BadgeCheck, title: "Verify", body: "Every citation checked server-side" },
];

const METRICS = [
  { to: 92, suffix: "%", label: "answers contain the expected fact", note: "65% for the extractive baseline" },
  { to: 100, suffix: "%", label: "gold page in the top 5 results", note: "Recall@5, hybrid search" },
  { to: 83, suffix: "%", label: "citations land on a correct page", note: "cited-page accuracy" },
  { to: 3, suffix: " / 3", label: "unanswerable questions refused", note: "no made-up answers" },
];

const STACK = ["Next.js 15", "React 19", "TypeScript", "Tailwind", "react-pdf", "FastAPI", "Docling", "PyMuPDF", "FastEmbed", "BGE-small", "BM25", "Qdrant", "PostgreSQL", "Neon", "Gemini", "OpenRouter", "uv", "pytest", "GitHub Actions"];

const HOSTING: [string, string][] = [
  ["Vercel Hobby", "Frontend + API proxy"],
  ["Render free · 512 MB", "FastAPI backend"],
  ["Qdrant Cloud free", "Dense + sparse vectors"],
  ["Neon free", "Metadata, chats, uploads"],
  ["Gemini free tier", "Answers + vision OCR"],
];

function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      {sub && <p className="mt-4 text-slate-400">{sub}</p>}
    </Reveal>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-200 selection:bg-indigo-500/40">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3 text-sm">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30">
              <FileSearch className="h-4 w-4 text-white" />
            </span>
            DocuMind
          </Link>
          <a href="#how" className="hidden text-slate-400 transition hover:text-white md:block">How it works</a>
          <a href="#results" className="hidden text-slate-400 transition hover:text-white md:block">Results</a>
          <a href="#engineering" className="hidden text-slate-400 transition hover:text-white md:block">Engineering</a>
          <a href={REPO} target="_blank" rel="noreferrer" aria-label="GitHub" className="ml-auto flex items-center gap-1.5 text-slate-400 transition hover:text-white">
            <Github className="h-4 w-4" /> <span className="hidden sm:inline">GitHub</span>
          </a>
          <Link href="/app" className="rounded-lg bg-white px-3.5 py-1.5 font-semibold text-slate-900 transition hover:bg-indigo-100">
            Launch app
          </Link>
        </nav>
      </header>

      <section className="relative isolate">
        <div className="bg-grid absolute inset-0 -z-10" />
        <div className="aurora absolute -top-40 left-1/2 -z-10 h-[36rem] w-[36rem] -translate-x-[70%] rounded-full bg-indigo-600/30 blur-[120px]" />
        <div className="aurora absolute -top-20 left-1/2 -z-10 h-[30rem] w-[30rem] translate-x-[10%] rounded-full bg-fuchsia-600/20 blur-[120px] [animation-delay:-6s]" />
        <div className="aurora absolute top-80 left-1/2 -z-10 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[120px] [animation-delay:-10s]" />

        <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 text-center sm:pt-28">
          <Reveal>
            <a href={REPO} target="_blank" rel="noreferrer" className="group mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 backdrop-blur transition hover:border-indigo-400/50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
              Open source · Multimodal RAG · Runs on ₹0 infrastructure
              <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
            </a>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="mx-auto mt-8 max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Ask questions about your PDFs.
              <br />
              <span className="text-shine">See the sources.</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
              Ask about a report, manual, or datasheet. Open a citation to see the supporting quote and page in the PDF.
            </p>
          </Reveal>
          <Reveal delay={300} className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/app#sample"
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3.5 font-semibold text-white shadow-[0_0_40px_-6px_rgba(129,140,248,0.8)] transition hover:shadow-[0_0_60px_-4px_rgba(192,132,252,0.9)]"
            >
              {workspaceCopy.trySample} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link href="/app#upload" className="cursor-pointer inline-flex items-center rounded-xl border border-white/15 px-5 py-3 font-semibold text-white hover:bg-white/10">
              {workspaceCopy.uploadPdf}
            </Link>
          </Reveal>
          <Reveal delay={450} className="mt-16">
            <HeroDemo />
          </Reveal>
        </div>
      </section>

      <div className="relative border-y border-white/5 bg-white/[0.02] py-5 [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)]">
        <div className="marquee flex w-max gap-10 text-sm font-medium text-slate-500">
          {[...STACK, ...STACK].map((s, i) => (
            <span key={i} className="flex items-center gap-10">
              {s} <span className="h-1 w-1 rounded-full bg-slate-700" />
            </span>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-28">
        <SectionTitle
          eyebrow="The problem"
          title={<>Chatbots cite pages. <span className="text-slate-500">Nobody checks them.</span></>}
          sub="Ask a normal LLM about a 90-year-old scanned report and you get a confident answer and a page number. DocuMind refuses to show a citation it can't prove."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <Reveal className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-300">
              <Bot className="h-4 w-4" /> Typical chatbot <span className="font-normal text-rose-300/60">(illustrative)</span>
            </div>
            <p className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">What is the specific weight of standard air?</p>
            <p className="mt-3 rounded-xl border border-white/5 bg-slate-900 px-4 py-3 text-sm text-slate-300">
              Standard air weighs about 0.075 lb/ft³ <span className="text-rose-300">(see page 9)</span>.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-rose-200/80">
              <li className="flex items-center gap-2"><CircleX className="h-4 w-4" /> No source passage shown</li>
              <li className="flex items-center gap-2"><CircleX className="h-4 w-4" /> Page number never checked</li>
            </ul>
          </Reveal>
          <Reveal delay={150} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 shadow-[0_0_80px_-30px_rgba(52,211,153,0.5)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <FileSearch className="h-4 w-4" /> DocuMind
            </div>
            <p className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">What is the specific weight of standard air?</p>
            <p className="mt-3 rounded-xl border border-white/5 bg-slate-900 px-4 py-3 text-sm text-slate-300">
              1.2255 kg/m³ <span className="rounded border border-indigo-400/40 bg-indigo-500/20 px-1.5 py-px text-xs text-indigo-200">[1] p.2</span>
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-emerald-200/90">
              <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> Quote found in a retrieved passage</li>
              <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> Click to see it outlined on page 2</li>
            </ul>
          </Reveal>
        </div>
      </section>

      <section id="how" className="relative border-t border-white/5 bg-gradient-to-b from-indigo-950/20 to-transparent py-28">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle eyebrow="How it works" title="From pixels to proof in five steps" />
          <div className="mt-16 flex flex-col items-stretch lg:flex-row lg:items-center">
            {PIPELINE.map((s, i) => (
              <div key={s.title} className="contents">
                <Reveal delay={i * 120} className="lg:flex-1">
                  <div className="group relative rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-center transition hover:-translate-y-1 hover:border-indigo-400/40">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 text-indigo-200 ring-1 ring-white/10 transition group-hover:shadow-[0_0_30px_-4px_rgba(129,140,248,0.7)]">
                      <s.icon className="h-6 w-6" />
                    </span>
                    <h3 className="mt-4 font-semibold text-white">{s.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.body}</p>
                  </div>
                </Reveal>
                {i < PIPELINE.length - 1 && (
                  <>
                    <div className="relative mx-auto h-8 w-px bg-gradient-to-b from-indigo-500/10 via-indigo-400/50 to-indigo-500/10 lg:hidden">
                      <span className="flow-y absolute -left-[3px] h-[7px] w-[7px] rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(103,232,249,0.7)]" />
                    </div>
                    <div className="relative hidden h-px w-10 shrink-0 bg-gradient-to-r from-indigo-500/10 via-indigo-400/50 to-indigo-500/10 lg:block">
                      <span className="flow-x absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(103,232,249,0.7)]" style={{ animationDelay: `${i * 300}ms` }} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="results" className="relative py-28">
        <div className="absolute inset-x-0 top-1/2 -z-0 mx-auto h-72 max-w-4xl -translate-y-1/2 rounded-full bg-indigo-600/10 blur-[100px]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <SectionTitle
            eyebrow="Evaluation"
            title="Measured, not claimed"
            sub="29 hand-written questions over 3 public PDFs: a scanned 1933 NACA report, the 2024 Fuel Economy Guide and a DOE motor handbook."
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map((m, i) => (
              <Reveal key={m.label} delay={i * 100} className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
                <div className="bg-gradient-to-br from-white to-indigo-300 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
                  <Counter to={m.to} suffix={m.suffix} />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-200">{m.label}</p>
                <p className="mt-1 text-xs text-slate-500">{m.note}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-6 text-center text-xs text-slate-500">
            Gemini 3.5 Flash-Lite, median LLM latency 0.9 s. The 2 misses were refusals, never wrong answers. Reproduce with{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-slate-400">eval/run_eval.py</code>.
          </Reveal>
        </div>
      </section>

      <section id="engineering" className="border-t border-white/5 py-28">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle eyebrow="Engineering" title="Built like a product, not a notebook" />
          <div className="mt-14 grid auto-rows-[minmax(180px,auto)] gap-4 md:grid-cols-3">
            <Reveal className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/15 via-slate-900 to-slate-900 p-7 md:col-span-2">
              <BadgeCheck className="h-6 w-6 text-indigo-300" />
              <h3 className="mt-4 text-xl font-semibold text-white">Citation validation</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                The model must cite retrieved passage IDs and quote them. The server checks each quote against the passage
                text, drops citations it can&apos;t match, and withholds answers with none left.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 font-mono text-[11px]">
                <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-300">[1] S3 · p.5 ✓</span>
                <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-300">[2] S1 · p.7 ✓</span>
                <span className="rounded-md border border-rose-400/30 bg-rose-400/10 px-2 py-1 text-rose-300 line-through">[3] S9 · p.12</span>
              </div>
            </Reveal>
            <Reveal delay={100} className="rounded-2xl border border-white/10 bg-slate-900/70 p-7">
              <ScanLine className="h-6 w-6 text-cyan-300" />
              <h3 className="mt-4 text-lg font-semibold text-white">Scans and OCR</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">Docling OCR offline; Gemini vision for scanned live uploads.</p>
            </Reveal>
            <Reveal className="rounded-2xl border border-white/10 bg-slate-900/70 p-7">
              <Table2 className="h-6 w-6 text-fuchsia-300" />
              <h3 className="mt-4 text-lg font-semibold text-white">Tables stay tables</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">TableFormer output becomes its own chunk, so MPG and efficiency values stay findable.</p>
            </Reveal>
            <Reveal delay={100} className="rounded-2xl border border-white/10 bg-slate-900/70 p-7">
              <Layers className="h-6 w-6 text-amber-300" />
              <h3 className="mt-4 text-lg font-semibold text-white">LLM fallback chain</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">Flash-Lite → Flash → extractive mode when Google returns 503s or empty output.</p>
            </Reveal>
            <Reveal delay={200} className="rounded-2xl border border-white/10 bg-slate-900/70 p-7">
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
              <h3 className="mt-4 text-lg font-semibold text-white">Safe public demo</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">Per-IP quotas, size and page caps, session-scoped uploads that expire in 24 h.</p>
            </Reveal>
            <Reveal className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900 p-7 md:col-span-3 md:grid md:grid-cols-[auto_1fr] md:gap-10">
              <div>
                <div className="bg-gradient-to-br from-white to-emerald-300 bg-clip-text text-6xl font-bold tracking-tight text-transparent">₹0</div>
                <p className="mt-2 text-sm text-slate-400">per month · no credit card</p>
              </div>
              <div className="mt-6 grid gap-6 md:mt-0 md:grid-cols-2">
                <ul className="space-y-2 text-sm">
                  {HOSTING.map(([name, role]) => (
                    <li key={name} className="flex justify-between gap-4 border-b border-white/5 pb-2">
                      <span className="font-medium text-slate-200">{name}</span>
                      <span className="text-right text-slate-500">{role}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-3 text-sm text-slate-400">
                  <p className="flex gap-2"><Database className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> Docling needs ~3 GB RAM, so the samples are parsed offline and the 512 MB server only searches and answers.</p>
                  <p className="flex gap-2"><Search className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> The free backend sleeps when idle: the first request can take up to a minute.</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="px-6 pb-28">
        <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-8 py-16 text-center shadow-[0_0_120px_-30px_rgba(167,139,250,0.8)]">
          <div className="bg-grid absolute inset-0 opacity-40" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">See it for yourself.</h2>
            <p className="mx-auto mt-4 max-w-xl text-indigo-100">
              Pick a sample document, ask anything, and click a citation. Or upload your own PDF.
            </p>
            <Link href="/app" className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 font-semibold text-indigo-700 shadow-xl transition hover:scale-[1.03]">
              Launch DocuMind <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        Built by Nayan Katiyara ·{" "}
        <a href={REPO} className="text-slate-400 underline-offset-4 hover:text-white hover:underline" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
