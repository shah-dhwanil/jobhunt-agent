/**
 * LightPanda Fetch Tool
 *
 * Uses the `lightpanda fetch` CLI command to extract web page content
 * with anti-detection measures built-in.
 */

import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { getRandomUserAgent, randomDelay, sleep } from "./stealth.js";

// ── Types ──

export interface FetchParams {
  url: string;
  mode?: "markdown" | "html" | "text";
  proxy?: string;
  userAgent?: string;
  timeout?: number;
  waitMs?: number;
  stripMode?: "js" | "ui" | "css" | "full";
  waitSelector?: string;
  obeyRobotsTxt?: boolean;
  disableTLSVerify?: boolean;
  injectScript?: string;
}

export interface FetchResult {
  content: string;
  statusCode: number;
  contentType: string;
  url: string;
  timing: {
    fetchMs: number;
    totalMs: number;
  };
}

// ── Find lightpanda binary ──

let _binaryPath: string | null = null;

function findBinary(): string {
  if (_binaryPath) return _binaryPath;

  // Check environment variable first
  if (process.env.LIGHTPANDA_PATH) {
    _binaryPath = process.env.LIGHTPANDA_PATH;
    return _binaryPath;
  }

  // Check common locations
  const candidates = [
    "/home/codespace/.local/bin/lightpanda",
    "/usr/local/bin/lightpanda",
    "/usr/bin/lightpanda",
  ];

  for (const p of candidates) {
    try {
      accessSync(p, constants.X_OK);
      _binaryPath = p;
      return p;
    } catch {
      // try next
    }
  }

  // Fall back to PATH
  _binaryPath = "lightpanda";
  return _binaryPath;
}

// ── Main fetch function ──

export async function lightpandaFetch(
  params: FetchParams,
  signal?: AbortSignal
): Promise<FetchResult> {
  const startTime = Date.now();
  const binary = findBinary();

  // Apply anti-detection: add human-like delay before fetching
  if (!signal?.aborted) {
    await sleep(randomDelay(300, 1500));
  }

  // Build CLI arguments
  const args: string[] = ["fetch"];

  // Output mode
  const dumpMode = params.mode === "html" ? "html" : params.mode === "text" ? "semantic_tree_text" : "markdown";
  args.push("--dump", dumpMode);

  // Strip mode (default: strip JS for clean output)
  if (params.stripMode) {
    args.push("--strip-mode", params.stripMode);
  } else if (params.mode === "markdown" || !params.mode) {
    // By default strip JS for cleaner markdown output
    args.push("--strip-mode", "js");
  }

  // Wait time (default 2s to let JS render)
  const waitMs = params.waitMs ?? (params.mode === "text" ? 1000 : 3000);
  args.push("--wait-ms", String(waitMs));

  // Wait for selector if provided
  if (params.waitSelector) {
    args.push("--wait-selector", params.waitSelector);
  }

  // User agent (LightPanda's --user-agent forbids "Mozilla" so we use --user-agent-suffix)
  // LightPanda sends "Lightpanda/X.Y" by default; we append a realistic suffix
  if (params.userAgent) {
    // Custom UA suffix
    args.push("--user-agent-suffix", ` ${params.userAgent}`);
  } else {
    // Realistic suffix to avoid detection as "Lightpanda"
    args.push("--user-agent-suffix", " like Gecko");
  }

  // Proxy
  if (params.proxy) {
    args.push("--http-proxy", params.proxy);
  }

  // Obey robots.txt
  if (params.obeyRobotsTxt) {
    args.push("--obey-robots");
  }

  // Disable TLS verification (useful for proxies with self-signed certs)
  if (params.disableTLSVerify) {
    args.push("--insecure-disable-tls-host-verification");
  }

  // Inject script (run before page scripts)
  if (params.injectScript) {
    args.push("--inject-script", params.injectScript);
  }

  // Use JSON output for structured results (status, headers, content)
  args.push("--json");

  // Timeout for HTTP transfer
  const httpTimeout = params.timeout ? Math.min(params.timeout, 60000) : 30000;
  args.push("--http-timeout", String(httpTimeout));

  // URL
  args.push(params.url);

  // Execute the fetch
  const fetchStart = Date.now();

  const result = await new Promise<{ stdout: string; stderr: string; exitCode: number; signal: string | null }>(
    (resolve, reject) => {
      const child = spawn(binary, args, {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: (params.timeout ?? 60000) + 10000, // slightly more than http timeout
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", (code, sig) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
          signal: sig,
        });
      });

      child.on("error", (err) => {
        reject(err);
      });

      // Handle abort signal
      if (signal) {
        signal.addEventListener(
          "abort",
          () => {
            child.kill("SIGTERM");
          },
          { once: true }
        );
      }
    }
  );

  const fetchMs = Date.now() - fetchStart;
  const totalMs = Date.now() - startTime;

  if (result.exitCode !== 0) {
    throw new Error(
      `LightPanda fetch failed (exit ${result.exitCode}): ${result.stderr || result.stdout.slice(0, 500)}`
    );
  }

  // Parse JSON output (from --json flag)
  let statusCode = 200;
  let contentType = "text/markdown";
  let content = result.stdout;

  try {
    const parsed = JSON.parse(result.stdout);
    if (parsed && typeof parsed === "object") {
      statusCode = parsed.http_status ?? 200;
      content = parsed.content ?? result.stdout;

      // Determine content type
      const dumpType = parsed.dump;
      contentType =
        dumpType === "html"
          ? "text/html"
          : dumpType === "markdown"
            ? "text/markdown"
            : dumpType === "semantic_tree_text"
              ? "text/plain"
              : params.mode === "html"
                ? "text/html"
                : "text/markdown";
    }
  } catch {
    // Not valid JSON response - use raw stdout as content
    content = result.stdout;
  }

  return {
    content,
    statusCode,
    contentType,
    url: params.url,
    timing: {
      fetchMs,
      totalMs,
    },
  };
}
