import { appendFile } from "node:fs/promises";

export type EventKind =
  | "llm_call"
  | "tool_call"
  | "tool_result"
  | "memory_read"
  | "memory_write"
  | "observation"
  | "ccloud_action";

export interface RewindInitOptions {
  agentSlug: string;
  owner: string;
  apiUrl?: string; // default http://localhost:3000
  apiKey?: string; // sent as x-api-key when the API has auth enabled
  batchSize?: number; // flush when this many events buffer (default 20)
  flushIntervalMs?: number; // or after this long (default 500)
  bufferFile?: string; // durability sink if the API is down
  maxRetries?: number; // per-batch retry attempts (default 4)
}

interface Config {
  agentSlug: string;
  owner: string;
  apiUrl: string;
  apiKey?: string;
  batchSize: number;
  flushIntervalMs: number;
  bufferFile: string;
  maxRetries: number;
}

function jsonHeaders(apiKey?: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) h["x-api-key"] = apiKey;
  return h;
}

interface PendingEvent {
  seq: number;
  kind: EventKind;
  payload: Record<string, unknown>;
  parentEvent?: string | null;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** A live run. Owns its monotonic `seq` counter and an event buffer. */
class RewindRun {
  readonly runId: string;
  private readonly cfg: Config;
  private seq = 0;
  private buffer: PendingEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private flushing = false;

  constructor(runId: string, cfg: Config) {
    this.runId = runId;
    this.cfg = cfg;
  }

  /** Buffer an event. Returns its seq (useful as a parentEvent reference). */
  emit(
    kind: EventKind,
    payload: Record<string, unknown>,
    parentEvent?: string | null
  ): number {
    const seq = this.seq++;
    this.buffer.push({ seq, kind, payload, parentEvent: parentEvent ?? null });
    if (this.buffer.length >= this.cfg.batchSize) {
      void this.flush();
    } else {
      this.scheduleFlush();
    }
    return seq;
  }

  /**
   * Wrap a map of tool functions so each invocation auto-emits `tool_call`
   * (with args) before and `tool_result` (with result or error) after.
   */
  wrapTools<T extends Record<string, (...args: any[]) => any>>(tools: T): T {
    const wrapped: Record<string, (...args: any[]) => Promise<unknown>> = {};
    for (const [name, fn] of Object.entries(tools)) {
      wrapped[name] = async (...args: unknown[]): Promise<unknown> => {
        this.emit("tool_call", { tool: name, args });
        try {
          const result = await (fn as (...a: unknown[]) => unknown)(...args);
          this.emit("tool_result", { tool: name, result });
          return result;
        } catch (err) {
          this.emit("tool_result", { tool: name, error: String(err) });
          throw err;
        }
      };
    }
    return wrapped as T;
  }

  /**
   * Monkeypatch a Bedrock client's `send` so every call emits an `llm_call`
   * event (model, request input, response output, latency). Generic on the
   * client shape so the SDK needs no @aws-sdk dependency.
   */
  wrapLLM<C extends { send: (command: any) => Promise<any> }>(client: C): C {
    const original = client.send.bind(client);
    client.send = (async (command: any): Promise<unknown> => {
      const startedAt = Date.now();
      let response: any;
      try {
        response = await original(command);
        return response;
      } finally {
        this.emit("llm_call", {
          model: command?.input?.modelId,
          input: command?.input,
          output: response?.output ?? null,
          usage: response?.usage ?? null,
          latencyMs: Date.now() - startedAt,
        });
      }
    }) as C["send"];
    return client;
  }

  private scheduleFlush(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.cfg.flushIntervalMs);
  }

  /** Send everything currently buffered. Safe to call concurrently. */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.flushing = true;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await this.send(batch);
    } catch (err) {
      await this.persist(batch, err); // durability: never lose events
    } finally {
      this.flushing = false;
      if (this.buffer.length > 0) this.scheduleFlush();
    }
  }

  private async send(batch: PendingEvent[]): Promise<void> {
    const body = JSON.stringify({ runId: this.runId, events: batch });
    let attempt = 0;
    for (;;) {
      try {
        const res = await fetch(`${this.cfg.apiUrl}/events`, {
          method: "POST",
          headers: jsonHeaders(this.cfg.apiKey),
          body,
        });
        if (!res.ok) {
          throw new Error(`POST /events ${res.status}: ${await res.text()}`);
        }
        return;
      } catch (err) {
        attempt++;
        if (attempt > this.cfg.maxRetries) throw err;
        await sleep(2 ** attempt * 100); // 200, 400, 800, 1600 ms
      }
    }
  }

  private async persist(batch: PendingEvent[], err: unknown): Promise<void> {
    const line =
      JSON.stringify({
        runId: this.runId,
        events: batch,
        failedAt: new Date().toISOString(),
        error: String(err),
      }) + "\n";
    try {
      await appendFile(this.cfg.bufferFile, line, "utf8");
    } catch {
      console.error("[rewind] could not buffer events to disk:", line);
    }
  }

  /** Flush remaining events and stop the timer. Call when the run is done. */
  async end(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    await this.flush();
  }
}

class RewindClient {
  private cfg: Config | undefined;

  init(opts: RewindInitOptions): void {
    this.cfg = {
      agentSlug: opts.agentSlug,
      owner: opts.owner,
      apiUrl: opts.apiUrl ?? "http://localhost:3000",
      apiKey: opts.apiKey ?? process.env.REWIND_API_KEY,
      batchSize: opts.batchSize ?? 20,
      flushIntervalMs: opts.flushIntervalMs ?? 500,
      bufferFile: opts.bufferFile ?? ".rewind-buffer.jsonl",
      maxRetries: opts.maxRetries ?? 4,
    };
  }

  private requireCfg(): Config {
    if (!this.cfg) throw new Error("Rewind.init() must be called before startRun()");
    return this.cfg;
  }

  /** Open a run (POST /runs). Upserts the agent by slug server-side. */
  async startRun(label?: string, region = "us-east-1"): Promise<RewindRun> {
    const cfg = this.requireCfg();
    const res = await fetch(`${cfg.apiUrl}/runs`, {
      method: "POST",
      headers: jsonHeaders(cfg.apiKey),
      body: JSON.stringify({
        agentSlug: cfg.agentSlug,
        owner: cfg.owner,
        label,
        region,
      }),
    });
    if (!res.ok) {
      throw new Error(`POST /runs ${res.status}: ${await res.text()}`);
    }
    const { runId } = (await res.json()) as { runId: string };
    return new RewindRun(runId, cfg);
  }
}

/** Singleton. `Rewind.init(...)` once, then `Rewind.startRun(...)`. */
export const Rewind = new RewindClient();
export type { RewindRun };
