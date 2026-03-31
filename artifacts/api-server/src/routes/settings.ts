import { Router } from "express";
import { getApiKey, setApiKey, getMaskedKey } from "../key-store";

const router = Router();

router.get("/settings", (_req, res) => {
  res.json({ maskedKey: getMaskedKey() });
});

router.post("/settings/key", (req, res) => {
  const { newKey, currentKey } = req.body as { newKey?: string; currentKey?: string };

  if (!currentKey || currentKey !== getApiKey()) {
    res.status(400).json({ error: "Current key is incorrect" });
    return;
  }
  if (!newKey || newKey.trim().length < 8) {
    res.status(400).json({ error: "New key must be at least 8 characters" });
    return;
  }
  if (newKey.trim() === getApiKey()) {
    res.status(400).json({ error: "New key must be different from the current key" });
    return;
  }

  setApiKey(newKey.trim());
  res.json({ ok: true, maskedKey: getMaskedKey() });
});

export default router;
