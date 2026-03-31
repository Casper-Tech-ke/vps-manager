import fs from "fs";
import path from "path";

const KEY_FILE = path.resolve(process.cwd(), ".xcm_key");

let _cachedKey: string | null = null;

export function getApiKey(): string | null {
  if (_cachedKey) return _cachedKey;
  try {
    const raw = fs.readFileSync(KEY_FILE, "utf8").trim();
    if (raw) { _cachedKey = raw; return _cachedKey; }
  } catch {}
  _cachedKey = process.env.API_KEY ?? null;
  return _cachedKey;
}

export function setApiKey(newKey: string): void {
  fs.writeFileSync(KEY_FILE, newKey.trim(), "utf8");
  _cachedKey = newKey.trim();
  process.env.API_KEY = _cachedKey;
}

export function getMaskedKey(): string {
  const key = getApiKey() ?? "";
  if (key.length <= 6) return "••••••";
  return key.slice(0, 4) + "••••••••" + key.slice(-2);
}
