interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Result<T = Record<string, unknown>> {
  success: boolean;
  results: T[];
}

interface R2ObjectBody {
  body: ReadableStream;
  etag: string;
  httpMetadata?: { contentType?: string };
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}

declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database;
    WALLPAPERS: R2Bucket;
  };
}
