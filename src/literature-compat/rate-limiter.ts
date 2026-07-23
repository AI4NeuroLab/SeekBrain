export interface RetryQueueOptions {
  concurrency?: number;
  minimumIntervalMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}

function retryAfterMilliseconds(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

export class RetryQueue {
  readonly concurrency: number;
  readonly minimumIntervalMs: number;
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly random: () => number;
  active = 0;
  lastStartedAt = 0;
  readonly pending: Array<() => void> = [];

  constructor(options: RetryQueueOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 1);
    this.minimumIntervalMs = Math.max(0, options.minimumIntervalMs ?? 100);
    this.maxRetries = Math.max(0, options.maxRetries ?? 2);
    this.baseDelayMs = Math.max(1, options.baseDelayMs ?? 500);
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.random = options.random ?? Math.random;
  }

  async schedule(task: () => Promise<Response>): Promise<Response> {
    if (this.active >= this.concurrency) await new Promise<void>((resolve) => this.pending.push(resolve));
    this.active += 1;
    try {
      const intervalWait = this.minimumIntervalMs - (Date.now() - this.lastStartedAt);
      if (intervalWait > 0) await this.sleep(intervalWait);
      this.lastStartedAt = Date.now();
      for (let attempt = 0; ; attempt += 1) {
        const response = await task();
        if (![429, 500, 502, 503, 504].includes(response.status) || attempt >= this.maxRetries) return response;
        const exponential = this.baseDelayMs * 2 ** attempt;
        const jitter = Math.floor(exponential * 0.2 * this.random());
        await this.sleep(retryAfterMilliseconds(response) ?? exponential + jitter);
      }
    } finally {
      this.active -= 1;
      this.pending.shift()?.();
    }
  }
}

const queues = new Map<string, RetryQueue>();

export function sharedRetryQueue(identity: string, options: RetryQueueOptions = {}): RetryQueue {
  let queue = queues.get(identity);
  if (!queue) {
    queue = new RetryQueue(options);
    queues.set(identity, queue);
  }
  return queue;
}
