export type DocumentInfo = {
  id: string;
  title: string;
  filename: string;
  source: "sample" | "upload";
  pipeline: "full" | "lite";
  parser: string;
  status: "PROCESSING" | "READY" | "FAILED";
  error: string | null;
  page_count: number;
  created_at: string;
  expires_at: string | null;
};

export type BBox = { left: number; top: number; right: number; bottom: number };

export type PageInfo = {
  page_number: number;
  width: number;
  height: number;
  has_text_layer: boolean;
  ocr_used: boolean;
};

export type DocumentDetail = DocumentInfo & { pages: PageInfo[]; chunk_count: number };

export type ChunkInfo = {
  chunk_id: string;
  document_id: string;
  page_number: number;
  chunk_type: "text" | "table" | "figure";
  section: string | null;
  content: string;
  bboxes: BBox[];
};

export type Citation = {
  index: number;
  chunk_id: string;
  document_id: string;
  document_title: string;
  page_number: number;
  quote: string;
  bboxes: BBox[];
};

export type ChatResponse = {
  conversation_id: string;
  answer: string;
  sections?: { kind: "document" | "background"; text: string; citation_indices: number[] }[];
  found: boolean;
  citations: Citation[];
  retrieved: ChunkInfo[];
  provider: string;
  model: string;
  latency_ms: number;
  retrieval_ms: number;
  warning: string | null;
};

export type AppConfig = {
  llm_provider: string;
  vision_enabled: boolean;
  uploads_enabled: boolean;
  max_upload_mb: number;
  max_upload_pages: number;
  uploads_per_ip_per_day: number;
  chats_per_ip_per_day: number;
  upload_ttl_hours: number;
};

export function sessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("documind_session");
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem("documind_session", id);
  }
  return id;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "X-Session-Id": sessionId(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let message = res.status >= 502 && res.status <= 504
      ? "The service is temporarily unavailable. Please try again shortly."
      : `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {}
    throw new ApiError(message, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  config: () => request<AppConfig>("/config"),
  documents: () => request<DocumentInfo[]>("/documents"),
  document: (id: string) => request<DocumentDetail>(`/documents/${id}`),
  chunks: (id: string, params: { page?: number; chunk_type?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.chunk_type) q.set("chunk_type", params.chunk_type);
    return request<ChunkInfo[]>(`/documents/${id}/chunks?${q}`);
  },
  chat: (question: string, document_ids: string[], conversation_id?: string) =>
    request<ChatResponse>("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, document_ids, conversation_id }),
    }),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ document: DocumentInfo; warnings: string[] }>("/documents", {
      method: "POST",
      body: form,
    });
  },
  remove: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
  fileUrl: (id: string) => `/api/documents/${id}/file`,
};
