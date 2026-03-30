import { Router } from "express";
import { exec } from "child_process";
import { ExecCommandBody } from "@workspace/api-zod";

const router = Router();

router.post("/terminal/exec", (req, res) => {
  const parsed = ExecCommandBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const { command, cwd } = parsed.data;
  const options = {
    cwd: cwd ?? process.cwd(),
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4,
    shell: "/bin/bash" as string | undefined,
  };

  exec(command, options, (err, stdout, stderr) => {
    res.json({
      stdout: stdout ?? "",
      stderr: stderr ?? "",
      exitCode: err?.code ?? (err ? 1 : 0),
    });
  });
});

export default router;
