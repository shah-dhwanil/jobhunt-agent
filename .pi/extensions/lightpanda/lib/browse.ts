/**
 * LightPanda Browse Tool
 *
 * Manages interactive browsing sessions using LightPanda's CDP server.
 * Supports: navigate, click, type, extract text, evaluate JavaScript, screenshots.
 * Sessions are tracked by session ID across tool calls.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { CDPClient, getTargets, getBrowserWSURL, waitForCDPServer } from "./cdp.js";
import { getRandomUserAgent, getRandomViewport, randomDelay, sleep } from "./stealth.js";

// ── Session Manager ──

interface BrowseSession {
  process: ChildProcessWithoutNullStreams;
  cdp: CDPClient;
  browserWS: string;
  targetId: string | null;
  /** Session ID obtained from Target.attachToTarget — required for all page-level CDP commands */
  pageSessionId: string | null;
  pageUrl: string;
  lastAction: number;
  host: string;
  port: number;
}

const sessions = new Map<string, BrowseSession>();
let sessionCounter = 0;

// Binary path (cached)
let _binaryPath: string | null = null;

function findBinary(): string {
  if (_binaryPath) return _binaryPath;
  if (process.env.LIGHTPANDA_PATH) {
    _binaryPath = process.env.LIGHTPANDA_PATH;
  } else {
    _binaryPath = "lightpanda";
  }
  return _binaryPath;
}

// ── Tool Types ──

export interface BrowseStartParams {
  proxy?: string;
  userAgent?: string;
  obeyRobotsTxt?: boolean;
  disableTLSVerify?: boolean;
  initialUrl?: string;
}

export interface BrowseActParams {
  sessionId: string;
  action: "navigate" | "click" | "type" | "extract" | "evaluate" | "screenshot" | "scroll" | "getHTML";
  /** CSS selector for click/type/extract actions */
  selector?: string;
  /** Text to type (for type action) */
  text?: string;
  /** JavaScript expression (for evaluate action) */
  expression?: string;
  /** URL (for navigate action) */
  url?: string;
  /** Scroll amount in pixels */
  scrollY?: number;
  /** Timeout in ms for the action */
  timeout?: number;
}

export interface BrowseActResult {
  sessionId: string;
  action: string;
  success: boolean;
  data?: string;
  url?: string;
  title?: string;
  error?: string;
  screenshotBase64?: string;
}

// ── Tools ──

/**
 * Start a new browsing session
 */
export async function browseStart(params: BrowseStartParams): Promise<{
  sessionId: string;
  wsEndpoint: string;
  status: string;
}> {
  const binary = findBinary();
  const sessionId = `lpb-${++sessionCounter}`;
  const host = "127.0.0.1";
  const port = 9222;

  // Ensure port is available (simple check - normally would need port-finding logic)
  const serveArgs: string[] = [
    "serve",
    "--host", host,
    "--port", String(port),
    "--log-level", "error",
  ];

  // Apply anti-detection configuration
  if (params.proxy) {
    serveArgs.push("--http-proxy", params.proxy);
  }
  if (params.obeyRobotsTxt) {
    serveArgs.push("--obey-robots");
  }
  if (params.disableTLSVerify) {
    serveArgs.push("--insecure-disable-tls-host-verification");
  }

  // User agent
  const ua = params.userAgent || getRandomUserAgent();
  // LightPanda --user-agent doesn't allow "Mozilla" in it, so we use suffix
  serveArgs.push("--user-agent-suffix", ` ${ua.replace(/^Mozilla\/5\.0\s*/, "").slice(0, 100)}`);

  // Spawn the CDP server
  const proc = spawn(binary, serveArgs, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Collect stderr for debugging
  let stderrBuf = "";
  proc.stderr.on("data", (d: Buffer) => {
    stderrBuf += d.toString();
  });

  // Wait for server to be ready
  await waitForCDPServer(host, port, 15000);

  // Get browser WebSocket URL
  const browserWS = await getBrowserWSURL(host, port);

  // Connect CDP client
  const cdp = new CDPClient();
  await cdp.connect(browserWS);

  // Create a new page target
  const createResult = await cdp.send<{ targetId: string }>("Target.createTarget", {
    url: "about:blank",
  });

  const targetId = createResult.targetId;

  // CRITICAL: Attach to the target to get a session ID.
  // Page-level commands (Page.*, Runtime.*, Input.*, DOM.*) MUST include
  // this sessionId when sent through the browser-level WebSocket connection.
  // Without it, commands silently fail or time out.
  const attachResult = await cdp.send<{ sessionId: string }>(
    "Target.attachToTarget",
    { targetId, flatten: true },
    10000
  );
  const pageSessionId = attachResult.sessionId;

  // Navigate if initial URL provided
  if (params.initialUrl) {
    await cdp.send("Page.enable", {}, 5000, pageSessionId);
    await cdp.send("Page.navigate", { url: params.initialUrl }, 10000, pageSessionId);
    // Wait for page to load
    await sleep(randomDelay(1000, 2000));
  }

  // Store session
  sessions.set(sessionId, {
    process: proc,
    cdp,
    browserWS,
    targetId,
    pageSessionId,
    pageUrl: params.initialUrl || "about:blank",
    lastAction: Date.now(),
    host,
    port,
  });

  return {
    sessionId,
    wsEndpoint: browserWS,
    status: `Browser started. ${params.initialUrl ? `Navigated to ${params.initialUrl}` : "Ready."}`,
  };
}

/**
 * Perform an action in a browse session
 */
export async function browseAct(params: BrowseActParams): Promise<BrowseActResult> {
  const session = sessions.get(params.sessionId);
  if (!session) {
    return {
      sessionId: params.sessionId,
      action: params.action,
      success: false,
      error: `Session ${params.sessionId} not found. Start a session first with lightpanda_browse_start.`,
    };
  }

  const cdp = session.cdp;
  const timeout = params.timeout ?? 15000;

  if (!cdp.isConnected()) {
    return {
      sessionId: params.sessionId,
      action: params.action,
      success: false,
      error: "CDP connection lost. Start a new session.",
    };
  }

  try {
    // Add human-like delay between actions
    if (Date.now() - session.lastAction > 100) {
      await sleep(randomDelay(200, 800));
    }

    switch (params.action) {
      // ── Navigate ──
      case "navigate": {
        if (!params.url) {
          return {
            sessionId: params.sessionId,
            action: "navigate",
            success: false,
            error: "URL is required for navigate action",
          };
        }

        await cdp.send("Page.enable", {}, 5000, session.pageSessionId);
        const navResult = await cdp.send<{ frameId?: string }>(
          "Page.navigate",
          { url: params.url },
          timeout,
          session.pageSessionId
        );
        session.pageUrl = params.url;

        // Wait for page load
        await sleep(randomDelay(1500, 3000));

        // Get page title
        let title = "";
        try {
          const titleResult = await cdp.send<{ result: { value: string } }>(
            "Runtime.evaluate",
            { expression: "document.title" },
            5000,
            session.pageSessionId
          );
          title = String(titleResult.result?.value ?? "");
        } catch {
          // title may fail
        }

        session.lastAction = Date.now();
        return {
          sessionId: params.sessionId,
          action: "navigate",
          success: true,
          url: params.url,
          title,
        };
      }

      // ── Click ──
      case "click": {
        if (!params.selector) {
          return {
            sessionId: params.sessionId,
            action: "click",
            success: false,
            error: "CSS selector is required for click action",
          };
        }

        // Get element position
        const boxResult = await cdp.send<{ result: { value: { x: number; y: number; width: number; height: number } | null } }>(
          "Runtime.evaluate",
          {
            expression: `
              (() => {
                const el = document.querySelector(${JSON.stringify(params.selector)});
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { x: r.x + r.width/2, y: r.y + r.height/2, width: r.width, height: r.height };
              })()
            `,
          },
          timeout,
          session.pageSessionId
        );

        const box = boxResult.result?.value;
        if (!box) {
          return {
            sessionId: params.sessionId,
            action: "click",
            success: false,
            error: `Element not found: ${params.selector}`,
          };
        }

        // Add slight randomness to click position (human-like)
        const clickX = box.x + (Math.random() - 0.5) * Math.min(box.width * 0.3, 5);
        const clickY = box.y + (Math.random() - 0.5) * Math.min(box.height * 0.3, 5);

        // Dispatch mouse events
        await cdp.send("Input.dispatchMouseEvent", {
          type: "mousePressed",
          x: Math.round(clickX),
          y: Math.round(clickY),
          button: "left",
          clickCount: 1,
        }, timeout, session.pageSessionId);
        await sleep(randomDelay(50, 150));
        await cdp.send("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x: Math.round(clickX),
          y: Math.round(clickY),
          button: "left",
          clickCount: 1,
        }, timeout, session.pageSessionId);

        await sleep(randomDelay(500, 1500));

        session.lastAction = Date.now();
        return {
          sessionId: params.sessionId,
          action: "click",
          success: true,
          url: session.pageUrl,
        };
      }

      // ── Type ──
      case "type": {
        if (!params.selector) {
          return {
            sessionId: params.sessionId,
            action: "type",
            success: false,
            error: "CSS selector is required for type action",
          };
        }

        // Focus the element
        await cdp.send(
          "Runtime.evaluate",
          {
            expression: `
              (() => {
                const el = document.querySelector(${JSON.stringify(params.selector)});
                if (el) {
                  el.focus();
                  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                    el.value = '';
                  }
                }
                return !!el;
              })()
            `,
          },
          timeout,
          session.pageSessionId
        );

        // Type text character by character with human-like delays
        const text = params.text ?? "";
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          await cdp.send("Input.dispatchKeyEvent", {
            type: "keyDown",
            key: char,
            text: char,
          }, timeout, session.pageSessionId);
          await sleep(randomDelay(30, 120));
          await cdp.send("Input.dispatchKeyEvent", {
            type: "keyUp",
            key: char,
          }, timeout, session.pageSessionId);
          // Random typing speed variation
          if (Math.random() < 0.05) {
            await sleep(randomDelay(200, 500));
          }
        }

        session.lastAction = Date.now();
        return {
          sessionId: params.sessionId,
          action: "type",
          success: true,
        };
      }

      // ── Extract Text ──
      case "extract": {
        const expression = params.selector
          ? `(() => {
              const el = document.querySelector(${JSON.stringify(params.selector)});
              return el ? el.textContent.trim() : null;
            })()`
          : "document.body.innerText";

        const result = await cdp.send<{ result: { value: string } }>(
          "Runtime.evaluate",
          {
            expression,
            awaitPromise: true,
          },
          timeout,
          session.pageSessionId
        );

        session.lastAction = Date.now();
        return {
          sessionId: params.sessionId,
          action: "extract",
          success: true,
          data: String(result.result?.value ?? ""),
        };
      }

      // ── Evaluate JS ──
      case "evaluate": {
        if (!params.expression) {
          return {
            sessionId: params.sessionId,
            action: "evaluate",
            success: false,
            error: "JavaScript expression is required for evaluate action",
          };
        }

        const result = await cdp.send<{ result: { value: unknown; type: string } }>(
          "Runtime.evaluate",
          {
            expression: params.expression,
            awaitPromise: true,
            returnByValue: true,
          },
          timeout,
          session.pageSessionId
        );

        session.lastAction = Date.now();
        return {
          sessionId: params.sessionId,
          action: "evaluate",
          success: true,
          data: JSON.stringify(result.result?.value ?? null, null, 2),
        };
      }

      // ── Screenshot ──
      case "screenshot": {
        try {
          const result = await cdp.send<{ data: string }>(
            "Page.captureScreenshot",
            { format: "png", fromSurface: true },
            timeout,
            session.pageSessionId
          );

          session.lastAction = Date.now();
          return {
            sessionId: params.sessionId,
            action: "screenshot",
            success: true,
            screenshotBase64: result.data,
          };
        } catch (err) {
          return {
            sessionId: params.sessionId,
            action: "screenshot",
            success: false,
            error: `Screenshot not supported by this LightPanda version: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      // ── Scroll ──
      case "scroll": {
        await cdp.send(
          "Runtime.evaluate",
          {
            expression: `window.scrollBy(0, ${params.scrollY ?? 500})`,
          },
          timeout,
          session.pageSessionId
        );
        await sleep(randomDelay(300, 800));

        session.lastAction = Date.now();
        return {
          sessionId: params.sessionId,
          action: "scroll",
          success: true,
        };
      }

      // ── Get HTML ──
      case "getHTML": {
        const expression = params.selector
          ? `(() => {
              const el = document.querySelector(${JSON.stringify(params.selector)});
              return el ? el.outerHTML : null;
            })()`
          : "document.documentElement.outerHTML";

        const result = await cdp.send<{ result: { value: string } }>(
          "Runtime.evaluate",
          {
            expression,
            awaitPromise: true,
          },
          timeout,
          session.pageSessionId
        );

        session.lastAction = Date.now();
        return {
          sessionId: params.sessionId,
          action: "getHTML",
          success: true,
          data: String(result.result?.value ?? ""),
        };
      }

      default:
        return {
          sessionId: params.sessionId,
          action: params.action,
          success: false,
          error: `Unknown action: ${params.action}. Valid: navigate, click, type, extract, evaluate, screenshot, scroll, getHTML`,
        };
    }
  } catch (err) {
    return {
      sessionId: params.sessionId,
      action: params.action,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Stop a browsing session
 */
export async function browseStop(sessionId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const session = sessions.get(sessionId);
  if (!session) {
    return { success: false, message: `Session ${sessionId} not found` };
  }

  try {
    await session.cdp.disconnect();
  } catch {
    // ignore disconnect errors
  }

  try {
    session.process.kill("SIGTERM");
    // Give it a moment, then force kill
    setTimeout(() => {
      try {
        session.process.kill("SIGKILL");
      } catch {
        // already dead
      }
    }, 2000);
  } catch {
    // process may already be dead
  }

  sessions.delete(sessionId);

  return { success: true, message: `Session ${sessionId} stopped` };
}

/**
 * Clean up all sessions (called on session shutdown)
 */
export function cleanupAllSessions(): void {
  for (const [id] of sessions) {
    browseStop(id).catch(() => {});
  }
  sessions.clear();
}

/**
 * Check if a session is active
 */
export function isSessionActive(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  return !!session && session.cdp.isConnected();
}

/**
 * List active sessions
 */
export function listSessions(): Array<{ id: string; url: string; uptime: number }> {
  const result: Array<{ id: string; url: string; uptime: number }> = [];
  for (const [id, session] of sessions) {
    result.push({
      id,
      url: session.pageUrl,
      uptime: Date.now() - session.lastAction,
    });
  }
  return result;
}
