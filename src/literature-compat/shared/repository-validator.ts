import { spawn } from "node:child_process";
import type { RepositoryCandidate } from "../contracts.ts";
import { literatureResponseCache, type MemoryCache } from "../cache.ts";

const ALLOWED_HOSTS = new Set(["github.com", "gitlab.com", "bitbucket.org", "codeberg.org"]);

export interface RepositoryValidationResult {
  ok: boolean;
  url?: string;
  reason?: "unsupported_repository_host" | "not_repository_root" | "association_unverified" | "repository_unreachable" | "repository_verification_timeout";
}

export interface RepositoryValidatorOptions {
  timeoutMs?: number;
  cache?: MemoryCache;
  run?: (url: string, timeoutMs: number, signal?: AbortSignal) => Promise<boolean>;
}

export function normalizeRepositoryUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol) || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return undefined;
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return undefined;
    let rootSegments: string[];
    if (url.hostname.toLowerCase() === "gitlab.com") {
      const marker = segments.findIndex((segment) => segment === "-");
      rootSegments = marker > 1 ? segments.slice(0, marker) : segments;
    } else rootSegments = segments.slice(0, 2);
    const repository = rootSegments.at(-1)?.replace(/\.git$/i, "");
    if (!repository) return undefined;
    rootSegments[rootSegments.length - 1] = repository;
    return `https://${url.hostname.toLowerCase()}/${rootSegments.join("/")}`;
  } catch {
    return undefined;
  }
}

function gitLsRemote(url: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("repository verification timed out")), timeoutMs);
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    const child = spawn("git", ["ls-remote", url, "HEAD"], {
      stdio: ["ignore", "ignore", "ignore"],
      signal: controller.signal,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (controller.signal.aborted && !signal?.aborted) reject(new Error("repository verification timed out"));
      else reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve(code === 0);
    });
  });
}

export class RepositoryValidator {
  readonly timeoutMs: number;
  readonly cache: MemoryCache;
  readonly run: NonNullable<RepositoryValidatorOptions["run"]>;

  constructor(options: RepositoryValidatorOptions = {}) {
    this.timeoutMs = Math.max(100, options.timeoutMs ?? 20_000);
    this.cache = options.cache ?? literatureResponseCache;
    this.run = options.run ?? gitLsRemote;
  }

  async validate(candidate: RepositoryCandidate, signal?: AbortSignal): Promise<RepositoryValidationResult> {
    if (!["paper_analysis_code", "paper_model_code", "supplementary_code"].includes(candidate.relation)) {
      return { ok: false, reason: "association_unverified" };
    }
    let parsed: URL;
    try { parsed = new URL(candidate.url); } catch { return { ok: false, reason: "not_repository_root" }; }
    if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) return { ok: false, reason: "unsupported_repository_host" };
    const url = normalizeRepositoryUrl(candidate.url);
    if (!url) return { ok: false, reason: "not_repository_root" };
    try {
      const reachable = await this.cache.getOrLoad(`repository:reachable:v1:${url}`, () => this.run(url, this.timeoutMs, signal), 10 * 60_000);
      return reachable ? { ok: true, url } : { ok: false, url, reason: "repository_unreachable" };
    } catch (error) {
      return { ok: false, url, reason: String(error).includes("timed out") ? "repository_verification_timeout" : "repository_unreachable" };
    }
  }
}
