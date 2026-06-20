/**
 * LightPanda Browser Extension for pi
 *
 * Provides tools to access the web using the LightPanda headless browser
 * with robust anti-detection measures.
 *
 * Tools:
 *   lightpanda_fetch         - One-shot page fetch with anti-detection
 *   lightpanda_browse_start  - Start an interactive CDP browse session
 *   lightpanda_browse_act    - Perform actions in a session (navigate, click, type, extract, etc.)
 *   lightpanda_browse_stop   - End a browsing session
 *   lightpanda_status        - Check LightPanda installation and session status
 *
 * Anti-detection features:
 *   - Realistic browser User-Agent suffixes
 *   - Random human-like timing delays between actions
 *   - Support for HTTP proxies with basic/bearer auth
 *   - Randomized click positions (human-like)
 *   - Character-by-character typing with speed variation
 *   - Random viewport dimensions
 *   - configurable wait-ms for JS-rendered content
 */

import type { ExtensionAPI, ToolResult } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { lightpandaFetch } from "./lib/fetch.js";
import {
  browseStart,
  browseAct,
  browseStop,
  cleanupAllSessions,
  listSessions,
  type BrowseActParams,
  type BrowseActResult,
} from "./lib/browse.js";

export default function (pi: ExtensionAPI) {
  // ── Clean up browser sessions on shutdown ──
  pi.on("session_shutdown", async () => {
    cleanupAllSessions();
  });

  // ── Tool: lightpanda_fetch ──
  pi.registerTool({
    name: "lightpanda_fetch",
    label: "Web Fetch",
    description:
      "Fetch and extract a web page's content using the LightPanda headless browser. " +
      "Executes JavaScript and returns clean markdown by default. Includes anti-detection " +
      "measures: realistic User-Agent, random delays, proxy support, JS stripping. " +
      "Best for reading articles, documentation, extracting data, or scraping content.",
    promptSnippet: "Fetch a web page and return its content",
    promptGuidelines: [
      "Use lightpanda_fetch when you need to read a web page, scrape content, extract data, or check what's on a website",
      "Supports anti-bot detection: realistic User-Agent suffix, random delays, optional proxy, JS stripping for cleaner output",
      "For interactive browsing (click buttons, fill forms, navigate multi-page flows), use the lightpanda_browse_start/act/stop tools",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch and extract content from" }),
      mode: Type.Optional(
        Type.Union(
          [
            Type.Literal("markdown"),
            Type.Literal("html"),
            Type.Literal("text"),
          ] as const,
          {
            description:
              "Output format: 'markdown' (default, best for LLM reading), 'html' (raw HTML), or 'text' (plain text via semantic tree)",
          }
        )
      ),
      proxy: Type.Optional(
        Type.String({
          description:
            "HTTP proxy URL, e.g. http://user:pass@host:port or http://host:port",
        })
      ),
      userAgent: Type.Optional(
        Type.String({
          description:
            "Custom User-Agent suffix. If omitted, a realistic 'like Gecko' suffix is appended to the default LightPanda UA.",
        })
      ),
      timeout: Type.Optional(
        Type.Number({
          description: "Maximum time in ms for the HTTP transfer (default: 30000, max: 60000)",
        })
      ),
      waitMs: Type.Optional(
        Type.Number({
          description:
            "Time in ms to wait after page load before extracting content (default: 3000 for markdown/html, 1000 for text). Helps with JS-rendered content.",
        })
      ),
      waitSelector: Type.Optional(
        Type.String({
          description:
            "CSS selector to wait for before extracting (e.g. '.content', '#main', '[data-loaded=true]')",
        })
      ),
      stripMode: Type.Optional(
        Type.Union(
          [
            Type.Literal("js"),
            Type.Literal("ui"),
            Type.Literal("css"),
            Type.Literal("full"),
          ] as const,
          {
            description:
              "Comma-separated tag groups to strip: 'js' (scripts), 'ui' (img/video/css), 'css' (styles), 'full' (all except text)",
          }
        )
      ),
      obeyRobotsTxt: Type.Optional(
        Type.Boolean({
          description: "Obey robots.txt rules (default: false)",
        })
      ),
      disableTLSVerify: Type.Optional(
        Type.Boolean({
          description:
            "Disable TLS host verification (use with caution, useful for self-signed certs via proxy)",
        })
      ),
      injectScript: Type.Optional(
        Type.String({
          description:
            "JavaScript expression to inject and execute before other page scripts run",
        })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        url: string;
        mode?: "markdown" | "html" | "text";
        proxy?: string;
        userAgent?: string;
        timeout?: number;
        waitMs?: number;
        waitSelector?: string;
        stripMode?: "js" | "ui" | "css" | "full";
        obeyRobotsTxt?: boolean;
        disableTLSVerify?: boolean;
        injectScript?: string;
      },
      signal?: AbortSignal,
      _onUpdate?: () => void
    ): Promise<ToolResult> {
      try {
        const result = await lightpandaFetch(
          {
            url: params.url,
            mode: params.mode,
            proxy: params.proxy,
            userAgent: params.userAgent,
            timeout: params.timeout,
            waitMs: params.waitMs,
            waitSelector: params.waitSelector,
            stripMode: params.stripMode,
            obeyRobotsTxt: params.obeyRobotsTxt,
            disableTLSVerify: params.disableTLSVerify,
            injectScript: params.injectScript,
          },
          signal
        );

        // Truncate content if too long for LLM context
        const maxContentLen = 50000;
        const content =
          result.content.length > maxContentLen
            ? result.content.slice(0, maxContentLen) +
              `\n\n[... TRUNCATED: ${result.content.length - maxContentLen} more bytes. Use a more specific selector or strip mode to reduce output.]`
            : result.content;

        const statusLine =
          result.statusCode >= 400
            ? `⚠️  HTTP ${result.statusCode}`
            : `✅ HTTP ${result.statusCode}`;

        return {
          content: [
            {
              type: "text",
              text:
                `${statusLine} | ${result.url}\n` +
                `📊 ${result.timing.fetchMs}ms fetch, ${result.timing.totalMs}ms total\n` +
                `📄 ${result.content.length} bytes\n\n` +
                content,
            },
          ],
          details: {
            url: result.url,
            statusCode: result.statusCode,
            contentType: result.contentType,
            contentLength: result.content.length,
            timingMs: result.timing,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ Fetch failed: ${message}` }],
          details: { error: message },
          isError: true,
        };
      }
    },
  });

  // ── Tool: lightpanda_browse_start ──
  pi.registerTool({
    name: "lightpanda_browse_start",
    label: "Browse Start",
    description:
      "Start a new interactive browsing session with LightPanda. " +
      "Returns a session ID for use with lightpanda_browse_act and lightpanda_browse_stop. " +
      "Use this when you need to interact with a page (click buttons, fill forms, navigate between pages).",
    promptSnippet: "Start an interactive browser session",
    promptGuidelines: [
      "Use lightpanda_browse_start for interactive browsing (click, type, extract, navigate flows)",
      "After starting, use lightpanda_browse_act to perform actions, and lightpanda_browse_stop to end the session",
    ],
    parameters: Type.Object({
      initialUrl: Type.Optional(
        Type.String({
          description: "Optional URL to navigate to on session start",
        })
      ),
      proxy: Type.Optional(
        Type.String({
          description: "HTTP proxy URL for all requests in this session",
        })
      ),
      obeyRobotsTxt: Type.Optional(
        Type.Boolean({ description: "Obey robots.txt (default: false)" })
      ),
      disableTLSVerify: Type.Optional(
        Type.Boolean({
          description: "Disable TLS host verification (use with caution)",
        })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        initialUrl?: string;
        proxy?: string;
        obeyRobotsTxt?: boolean;
        disableTLSVerify?: boolean;
      },
      _signal?: AbortSignal
    ): Promise<ToolResult> {
      try {
        const result = await browseStart({
          initialUrl: params.initialUrl,
          proxy: params.proxy,
          obeyRobotsTxt: params.obeyRobotsTxt,
          disableTLSVerify: params.disableTLSVerify,
        });

        return {
          content: [
            {
              type: "text",
              text:
                `✅ Browser session started\n` +
                `🆔 Session ID: \`${result.sessionId}\`\n` +
                `🔗 CDP Endpoint: ${result.wsEndpoint}\n` +
                `📋 Status: ${result.status}\n\n` +
                `Use \`lightpanda_browse_act\` with session ID \`${result.sessionId}\` to:\n` +
                `- navigate (go to a URL)\n` +
                `- click (click an element by CSS selector)\n` +
                `- type (type text into an input)\n` +
                `- extract (get visible text from page/element)\n` +
                `- evaluate (run JavaScript)\n` +
                `- screenshot (capture page screenshot)\n` +
                `- scroll (scroll the page)\n` +
                `- getHTML (get outer HTML)\n\n` +
                `Use \`lightpanda_browse_stop\` with \`${result.sessionId}\` when done.`,
            },
          ],
          details: {
            sessionId: result.sessionId,
            wsEndpoint: result.wsEndpoint,
            status: result.status,
            availableActions: [
              "navigate",
              "click",
              "type",
              "extract",
              "evaluate",
              "screenshot",
              "scroll",
              "getHTML",
            ],
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to start browser session: ${message}`,
            },
          ],
          details: { error: message },
          isError: true,
        };
      }
    },
  });

  // ── Tool: lightpanda_browse_act ──
  pi.registerTool({
    name: "lightpanda_browse_act",
    label: "Browse Act",
    description:
      "Perform an action in an active LightPanda browse session. " +
      "Actions: navigate (go to URL), click (click element by CSS selector), " +
      "type (type text into element), extract (get visible text), " +
      "evaluate (run JS), screenshot (capture PNG), scroll, getHTML.",
    promptSnippet: "Perform an action in a browser session",
    parameters: Type.Object({
      sessionId: Type.String({
        description:
          "Session ID from lightpanda_browse_start",
      }),
      action: Type.Union(
        [
          Type.Literal("navigate"),
          Type.Literal("click"),
          Type.Literal("type"),
          Type.Literal("extract"),
          Type.Literal("evaluate"),
          Type.Literal("screenshot"),
          Type.Literal("scroll"),
          Type.Literal("getHTML"),
        ] as const,
        {
          description:
            "Action to perform: navigate (go to URL), click (by CSS selector), type (into focused element), extract (visible text), evaluate (JS expression), screenshot (PNG), scroll, getHTML (outer HTML)",
        }
      ),
      selector: Type.Optional(
        Type.String({
          description:
            "CSS selector for click/type/extract/getHTML actions (e.g. '#search', '.btn-primary', 'input[name=q]')",
        })
      ),
      text: Type.Optional(
        Type.String({
          description:
            "Text to type into the element (for 'type' action)",
        })
      ),
      expression: Type.Optional(
        Type.String({
          description:
            "JavaScript expression to evaluate (for 'evaluate' action, e.g. 'document.title' or 'JSON.stringify(window.__DATA__)')",
        })
      ),
      url: Type.Optional(
        Type.String({
          description: "URL to navigate to (for 'navigate' action)",
        })
      ),
      scrollY: Type.Optional(
        Type.Number({
          description:
            "Pixels to scroll vertically (for 'scroll' action, default: 500)",
        })
      ),
      timeout: Type.Optional(
        Type.Number({
          description: "Action timeout in ms (default: 15000)",
        })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        sessionId: string;
        action: string;
        selector?: string;
        text?: string;
        expression?: string;
        url?: string;
        scrollY?: number;
        timeout?: number;
      },
      _signal?: AbortSignal
    ): Promise<ToolResult> {
      try {
        const result: BrowseActResult = await browseAct({
          sessionId: params.sessionId,
          action: params.action as BrowseActParams["action"],
          selector: params.selector,
          text: params.text,
          expression: params.expression,
          url: params.url,
          scrollY: params.scrollY,
          timeout: params.timeout,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Action '${params.action}' failed: ${result.error}`,
              },
            ],
            details: { sessionId: params.sessionId, action: params.action, error: result.error },
            isError: true,
          };
        }

        let responseText = `✅ ${params.action} succeeded`;
        if (result.url) responseText += `\n🌐 URL: ${result.url}`;
        if (result.title) responseText += `\n📰 Title: ${result.title}`;

        const content: Array<{ type: string; text?: string; source?: Record<string, string> }> = [];

        if (result.screenshotBase64) {
          content.push({
            type: "text",
            text: responseText + "\n\n📸 Screenshot captured:",
          });
          content.push({
            type: "image",
            source: {
              type: "base64",
              mediaType: "image/png",
              data: result.screenshotBase64,
            },
          });
        } else if (result.data !== undefined) {
          // Truncate data if too long
          const maxLen = 30000;
          const data =
            result.data.length > maxLen
              ? result.data.slice(0, maxLen) +
                `\n\n[... ${result.data.length - maxLen} more characters truncated]`
              : result.data;
          content.push({
            type: "text",
            text: responseText + `\n\n${data}`,
          });
        } else {
          content.push({
            type: "text",
            text: responseText,
          });
        }

        return {
          content,
          details: {
            sessionId: params.sessionId,
            action: params.action,
            success: true,
            hasData: result.data !== undefined,
            hasScreenshot: !!result.screenshotBase64,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ Action failed: ${message}` }],
          details: { sessionId: params.sessionId, action: params.action, error: message },
          isError: true,
        };
      }
    },
  });

  // ── Tool: lightpanda_browse_stop ──
  pi.registerTool({
    name: "lightpanda_browse_stop",
    label: "Browse Stop",
    description:
      "Stop and clean up a LightPanda browse session. " +
      "Always call this when you're done with a browsing session to free resources.",
    promptSnippet: "Stop a browser session and free resources",
    parameters: Type.Object({
      sessionId: Type.String({
        description: "Session ID from lightpanda_browse_start to stop",
      }),
    }),
    async execute(
      _toolCallId: string,
      params: { sessionId: string }
    ): Promise<ToolResult> {
      try {
        const result = await browseStop(params.sessionId);
        if (result.success) {
          return {
            content: [
              {
                type: "text",
                text: `✅ ${result.message}`,
              },
            ],
            details: { sessionId: params.sessionId, stopped: true },
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `ℹ️ ${result.message}`,
              },
            ],
            details: { sessionId: params.sessionId, stopped: false },
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ Error: ${message}` }],
          details: { sessionId: params.sessionId, error: message },
          isError: true,
        };
      }
    },
  });

  // ── Tool: lightpanda_status ──
  pi.registerTool({
    name: "lightpanda_status",
    label: "LP Status",
    description:
      "Check if LightPanda is installed and list active browse sessions.",
    promptSnippet: "Check LightPanda installation and sessions",
    parameters: Type.Object({}),
    async execute(): Promise<ToolResult> {
      const binaryPath = process.env.LIGHTPANDA_PATH || "lightpanda";
      let version = "unknown";
      let installed = false;

      try {
        const { execSync } = await import("node:child_process");
        const output = execSync(`${binaryPath} version`, {
          encoding: "utf-8",
          timeout: 5000,
        });
        version = output.trim();
        installed = true;
      } catch {
        installed = false;
      }

      const activeSessions = listSessions();

      let text = installed
        ? `✅ LightPanda v${version} is installed\n`
        : `❌ LightPanda not found at "${binaryPath}". Install with: curl -fsSL https://pkg.lightpanda.io/install.sh | bash\n`;

      if (activeSessions.length > 0) {
        text += `\n📊 Active sessions (${activeSessions.length}):\n`;
        for (const s of activeSessions) {
          text += `  🆔 ${s.id} | ${s.url} | idle ${Math.round(s.uptime / 1000)}s\n`;
        }
      } else {
        text += `\n📊 No active browse sessions\n`;
      }

      return {
        content: [{ type: "text", text }],
        details: {
          installed,
          version,
          binaryPath,
          activeSessions: activeSessions.length,
        },
      };
    },
  });
}
