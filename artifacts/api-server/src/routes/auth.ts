import { Router } from "express";

const router = Router();

router.get("/auth/verify", (req, res) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "API_KEY not configured on server" });
  }
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || token !== apiKey) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }
  return res.json({ ok: true });
});

router.post("/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

export default router;
