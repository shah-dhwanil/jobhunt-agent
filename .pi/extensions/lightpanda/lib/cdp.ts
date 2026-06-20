/**
 * Minimal Chrome DevTools Protocol (CDP) client
 *
 * Communicates with LightPanda's CDP WebSocket server to enable
 * interactive browsing (navigate, click, type, extract, evaluate JS).
 *
 * Uses Node.js built-in WebSocket (available since Node 21+).
 */

// ── Types ──

interface CDPResponse {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

interface CDPEvent {
  method: string;
  params: Record<string, unknown>;
}

type CDPMessage = CDPResponse | CDPEvent;

interface TargetInfo {
  targetId: string;
  type: string;
  title: string;
  url: string;
  attached: boolean;
  browserContextId?: string;
}

interface PageInfo {
  targetId: string;
  websocketUrl: string;
  title: string;
  url: string;
}

// ── CDP Client ──

export class CDPClient {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private eventHandlers = new Map<string, (params: Record<string, unknown>) => void>();
  private connected = false;
  private connectPromise: Promise<void> | null = null;
  private disconnectHandlers: Array<() => void> = [];

  /**
   * Connect to a CDP WebSocket endpoint
   */
  async connect(url: string, timeoutMs = 10000): Promise<void> {
    if (this.connected) return;

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`CDP connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.connected = true;
          clearTimeout(timeout);
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          try {
            const msg: CDPMessage = JSON.parse(event.data as string);
            this.handleMessage(msg);
          } catch {
            // Ignore malformed messages
          }
        };

        this.ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error(`CDP WebSocket connection failed to ${url}`));
        };

        this.ws.onclose = () => {
          this.connected = false;
          // Reject all pending requests
          for (const [, entry] of this.pending) {
            entry.reject(new Error("CDP connection closed"));
          }
          this.pending.clear();
          for (const handler of this.disconnectHandlers) {
            handler();
          }
        };
      } catch (err) {
        clearTimeout(timeout);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });

    return this.connectPromise;
  }

  /**
   * Send a CDP command and wait for response
   *
   * When connected to the browser-level WebSocket, page-level commands
   * (Page.*, Runtime.*, Input.*, DOM.*) require a `sessionId` obtained
   * from Target.attachToTarget. Omit sessionId for browser-level commands
   * like Target.*.
   *
   * @param method    CDP method name (e.g. "Page.navigate", "Runtime.evaluate")
   * @param params    Command parameters
   * @param timeoutMs Timeout in ms (default: 15000)
   * @param sessionId Optional session ID for target-attached commands.
   *                  MUST be set for Page, Runtime, Input, DOM commands
   *                  when using a browser-level connection.
   */
  async send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 15000,
    sessionId?: string
  ): Promise<T> {
    if (!this.ws || !this.connected) {
      throw new Error("CDP not connected");
    }

    const id = ++this.messageId;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (v: unknown) => {
          clearTimeout(timeout);
          resolve(v as T);
        },
        reject: (e: Error) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      const message = sessionId
        ? JSON.stringify({ id, method, params, sessionId })
        : JSON.stringify({ id, method, params });
      this.ws!.send(message);
    });
  }

  /**
   * Register a handler for CDP events
   */
  on(event: string, handler: (params: Record<string, unknown>) => void): void {
    this.eventHandlers.set(event, handler);
  }

  /**
   * Remove an event handler
   */
  off(event: string): void {
    this.eventHandlers.delete(event);
  }

  /**
   * Register a disconnect handler
   */
  onDisconnect(handler: () => void): void {
    this.disconnectHandlers.push(handler);
  }

  /**
   * Disconnect from the CDP server
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.pending.clear();
    this.disconnectHandlers = [];
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  // ── Private ──

  private handleMessage(msg: CDPMessage): void {
    if ("id" in msg && msg.id !== undefined) {
      // This is a response to a command
      const entry = this.pending.get(msg.id);
      if (entry) {
        this.pending.delete(msg.id);
        if (msg.error) {
          entry.reject(
            new Error(`CDP error [${msg.error.code}]: ${msg.error.message}`)
          );
        } else {
          entry.resolve(msg.result ?? {});
        }
      }
    } else if ("method" in msg && msg.method) {
      // This is an event
      const handler = this.eventHandlers.get(msg.method);
      if (handler) {
        handler(msg.params);
      }
    }
  }
}

// ── Browser helpers ──

/**
 * Get page info from a running LightPanda CDP server via HTTP
 */
export async function getTargets(
  host: string,
  port: number
): Promise<PageInfo[]> {
  const url = `http://${host}:${port}/json/list`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to list targets: ${response.status}`);
  }
  const targets = (await response.json()) as Array<{
    id: string;
    type: string;
    title: string;
    url: string;
    webSocketDebuggerUrl: string;
  }>;

  return targets
    .filter((t) => t.type === "page")
    .map((t) => ({
      targetId: t.id,
      websocketUrl: t.webSocketDebuggerUrl,
      title: t.title,
      url: t.url,
    }));
}

/**
 * Get the browser WebSocket endpoint URL via HTTP
 */
export async function getBrowserWSURL(
  host: string,
  port: number
): Promise<string> {
  const url = `http://${host}:${port}/json/version`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to get browser info: ${response.status}`);
  }
  const info = (await response.json()) as {
    webSocketDebuggerUrl?: string;
  };
  if (!info.webSocketDebuggerUrl) {
    throw new Error("No WebSocket debugger URL in browser response");
  }
  return info.webSocketDebuggerUrl;
}

/**
 * Wait for the CDP HTTP endpoints to become available
 */
export async function waitForCDPServer(
  host: string,
  port: number,
  timeoutMs = 15000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`http://${host}:${port}/json/version`);
      if (resp.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`CDP server at ${host}:${port} did not become ready within ${timeoutMs}ms`);
}
