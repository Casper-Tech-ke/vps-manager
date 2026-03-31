import type { Request, Response, NextFunction } from "express";

// ── Bot / automated-client User-Agent patterns ─────────────────────────────
const BOT_UA = [
  /^curl\//i, /^wget\//i, /^python-requests/i, /^python-urllib/i,
  /^Go-http-client/i, /^Java\//i, /^okhttp\//i, /^HTTPie\//i,
  /^axios\//i, /^node-fetch/i, /^node-superagent/i, /^got\//i,
  /^PostmanRuntime/i, /^insomnia\//i, /^Paw\//i, /^RapidAPI/i,
  /^libwww-perl/i, /^Scrapy/i, /^php-curl/i, /^Ruby/i,
  /Googlebot/i, /Bingbot/i, /Slurp/i, /DuckDuckBot/i,
  /bot[^t]/i, /spider/i, /crawl/i, /scan/i, /shodan/i,
];

// ── In-memory rate limiter + IP ban list ───────────────────────────────────
interface RateEntry { count: number; resetAt: number }

const rateMap   = new Map<string, RateEntry>();
const bannedIps = new Set<string>();

const RATE_LIMIT  = 120;          // requests allowed per window
const RATE_WINDOW = 60_000;       // 1 minute in ms
const BAN_STRIKES = 10;           // ban after this many refused requests

// Per-IP refusal counter (auto-bans persistent hammering)
const strikeMap = new Map<string, number>();

// Private / loopback ranges that must never be banned.
// These come from the Nginx reverse-proxy running on the same host.
const TRUSTED_PREFIXES = ["127.", "::1", "10.", "172.16.", "172.17.", "172.18.",
  "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
  "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168."];

function getIp(req: Request): string {
  // With `app.set("trust proxy", 1)`, Express sets req.ip to the real
  // client IP taken from X-Forwarded-For — NOT the Nginx socket address.
  return req.ip ?? req.socket.remoteAddress ?? "0.0.0.0";
}

function isTrustedIp(ip: string): boolean {
  return TRUSTED_PREFIXES.some((prefix) => ip.startsWith(prefix));
}

function addStrike(ip: string): void {
  const n = (strikeMap.get(ip) ?? 0) + 1;
  strikeMap.set(ip, n);
  if (n >= BAN_STRIKES) bannedIps.add(ip);
}

function ratePassed(ip: string): boolean {
  const now  = Date.now();
  const slot = rateMap.get(ip);
  if (!slot || now > slot.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  slot.count++;
  return slot.count <= RATE_LIMIT;
}

// Tidy up expired rate entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, slot] of rateMap) {
    if (now > slot.resetAt) rateMap.delete(ip);
  }
}, 600_000);

// ── Honeypot trap ──────────────────────────────────────────────────────────
export function honeypotTrap(req: Request, res: Response): void {
  const ip = getIp(req);
  if (!isTrustedIp(ip)) {
    bannedIps.add(ip);
    strikeMap.set(ip, BAN_STRIKES);
  }
  res.status(404).end();
}

// ── Main guard middleware ──────────────────────────────────────────────────
export function botGuard(req: Request, res: Response, next: NextFunction): void {
  const ip = getIp(req);

  // Loopback / private IPs (Nginx proxy, health-checkers on the same host)
  // are never rate-limited or banned.
  if (isTrustedIp(ip)) {
    next();
    return;
  }

  // 1. Permanently banned IP
  if (bannedIps.has(ip)) {
    res.status(403).end();
    return;
  }

  // 2. Rate limit
  if (!ratePassed(ip)) {
    bannedIps.add(ip);    // auto-ban rate abusers
    res.status(429).set("Retry-After", "60").end();
    return;
  }

  // 3. User-Agent block — missing UA or known bot/tool UA
  const ua = req.headers["user-agent"] ?? "";
  if (!ua || BOT_UA.some((p) => p.test(ua))) {
    addStrike(ip);
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
