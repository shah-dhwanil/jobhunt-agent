/**
 * Anti-detection / stealth module for LightPanda
 *
 * Provides browser fingerprint randomization, realistic user agents,
 * proxy rotation support, and human-like timing delays to avoid
 * bot detection when browsing the web.
 */

// ── Realistic desktop User-Agent pool (fresh as of 2026) ──
const USER_AGENTS = [
  // Chrome 130+ on Windows 11
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  // Chrome on macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  // Edge on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  // Firefox on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
  // Firefox on macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:134.0) Gecko/20100101 Firefox/134.0",
];

// ── Realistic viewport dimensions ──
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 2560, height: 1440 },
  { width: 1680, height: 1050 },
];

// ── Accept-Language headers ──
const ACCEPT_LANGUAGES = [
  "en-US,en;q=0.9",
  "en-GB,en;q=0.9,en-US;q=0.8",
  "en-US,en;q=0.9,es;q=0.8",
  "en-US,en;q=0.9,de;q=0.8",
  "en-CA,en;q=0.9,fr-CA;q=0.8",
];

// ── Realistic referers by domain pattern ──
const REFERERS = [
  "https://www.google.com/",
  "https://www.bing.com/",
  "https://duckduckgo.com/",
  "https://search.yahoo.com/",
  "https://www.google.com/search?q=web+automation",
  "https://www.google.com/search?q=data+extraction",
];

/**
 * Pick a random item from an array
 */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get a random realistic desktop User-Agent string
 */
export function getRandomUserAgent(): string {
  return pick(USER_AGENTS);
}

/**
 * Get a random viewport configuration
 */
export function getRandomViewport(): { width: number; height: number } {
  return pick(VIEWPORTS);
}

/**
 * Get a random Accept-Language header
 */
export function getRandomAcceptLanguage(): string {
  return pick(ACCEPT_LANGUAGES);
}

/**
 * Generate a realistic human-like delay in milliseconds
 *
 * @param minMs - Minimum delay (default 500)
 * @param maxMs - Maximum delay (default 3000)
 */
export function randomDelay(minMs = 500, maxMs = 3000): number {
  // Use a normal-ish distribution by averaging two random values
  const base = Math.random() * (maxMs - minMs) + minMs;
  const jitter = Math.random() * (maxMs - minMs) * 0.3;
  return Math.round(base + jitter);
}

/**
 * Sleep for a given duration (returns a promise)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get a random referer URL
 */
export function getRandomReferer(): string {
  return pick(REFERERS);
}

/**
 * Common Sec-Ch-Ua headers that pair with Chrome UAs
 */
export function getSecChUa(userAgent: string): string {
  if (userAgent.includes("Chrome/130")) {
    return '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"';
  }
  if (userAgent.includes("Chrome/131")) {
    return '"Chromium";v="131", "Google Chrome";v="131", "Not?A_Brand";v="99"';
  }
  return '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"';
}

/**
 * Determine if a UA is Chrome-based (for Sec-Ch-Ua header decisions)
 */
export function isChromeUA(ua: string): boolean {
  return ua.includes("Chrome/");
}
