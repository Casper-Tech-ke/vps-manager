import { Router } from "express";
import https from "https";

const router = Router();

const GH_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN ?? "";
const GH_BASE = "api.github.com";

function ghRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const options: https.RequestOptions = {
      hostname: GH_BASE,
      path,
      method,
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "xcasper-manager/1.0",
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (c: Buffer) => { raw += c.toString(); });
      res.on("end", () => {
        try { resolve({ status: res.statusCode ?? 500, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode ?? 500, data: raw }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// GET /github/profile — fetch authenticated user profile
router.get("/github/profile", async (_req, res) => {
  if (!GH_TOKEN) return res.status(503).json({ error: "GITHUB_PERSONAL_ACCESS_TOKEN not configured" });
  try {
    const { status, data } = await ghRequest("GET", "/user");
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /github/profile — update authenticated user profile
router.patch("/github/profile", async (req, res) => {
  if (!GH_TOKEN) return res.status(503).json({ error: "GITHUB_PERSONAL_ACCESS_TOKEN not configured" });
  const allowed = ["name", "email", "blog", "twitter_username", "company", "location", "hireable", "bio"];
  const body: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in req.body) body[k] = req.body[k];
  }
  try {
    const { status, data } = await ghRequest("PATCH", "/user", body);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /github/social-accounts — list social accounts
router.get("/github/social-accounts", async (_req, res) => {
  if (!GH_TOKEN) return res.status(503).json({ error: "GITHUB_PERSONAL_ACCESS_TOKEN not configured" });
  try {
    const { status, data } = await ghRequest("GET", "/user/social_accounts");
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /github/social-accounts — add social accounts
router.post("/github/social-accounts", async (req, res) => {
  if (!GH_TOKEN) return res.status(503).json({ error: "GITHUB_PERSONAL_ACCESS_TOKEN not configured" });
  try {
    const { status, data } = await ghRequest("POST", "/user/social_accounts", { account_urls: req.body.account_urls });
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /github/social-accounts — remove social accounts
router.delete("/github/social-accounts", async (req, res) => {
  if (!GH_TOKEN) return res.status(503).json({ error: "GITHUB_PERSONAL_ACCESS_TOKEN not configured" });
  try {
    const { status, data } = await ghRequest("DELETE", "/user/social_accounts", { account_urls: req.body.account_urls });
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
