import { Router } from "express";
import { execSync, exec, spawn } from "child_process";
import os from "os";
import fs from "fs";
import path from "path";

const router = Router();

function run(cmd: string, fallback = ""): string {
  try { return execSync(cmd, { timeout: 5000, encoding: "utf8" }).trim(); }
  catch { return fallback; }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

router.get("/system/info", async (_req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    const diskRaw = run("df -h --output=source,fstype,size,used,avail,pcent,target 2>/dev/null | tail -n +2");
    const disk = diskRaw.split("\n").filter(Boolean).map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        source: parts[0] ?? "",
        fstype: parts[1] ?? "",
        size: parts[2] ?? "",
        used: parts[3] ?? "",
        avail: parts[4] ?? "",
        usePercent: parts[5] ?? "",
        mountedOn: parts[6] ?? "",
      };
    }).filter(d => !["tmpfs","devtmpfs","squashfs","overlay"].includes(d.fstype));

    const networkInterfaces: { name: string; address: string; family: string }[] = [];
    const nets = os.networkInterfaces();
    for (const [name, addrs] of Object.entries(nets)) {
      for (const addr of addrs ?? []) {
        if (!addr.internal) {
          networkInterfaces.push({ name, address: addr.address, family: addr.family });
        }
      }
    }

    const hostname = os.hostname();
    const osType = `${os.type()} ${os.release()}`;
    const kernel = run("uname -r");
    const uptimeSec = os.uptime();
    const uptime = formatUptime(uptimeSec);
    const arch = os.arch();
    const platform = os.platform();

    let osRelease = "";
    try {
      const rel = fs.readFileSync("/etc/os-release", "utf8");
      const match = rel.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
      if (match) osRelease = match[1];
    } catch { /* ignore */ }

    const loggedUsers = run("who | awk '{print $1}' | sort -u", "").split("\n").filter(Boolean);

    res.json({
      hostname,
      os: osRelease || osType,
      kernel,
      arch,
      platform,
      uptime,
      uptimeSeconds: uptimeSec,
      cpu: {
        model: cpus[0]?.model?.trim() ?? "Unknown",
        cores: cpus.length,
        loadAvg: { "1m": loadAvg[0].toFixed(2), "5m": loadAvg[1].toFixed(2), "15m": loadAvg[2].toFixed(2) },
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: ((usedMem / totalMem) * 100).toFixed(1),
      },
      disk,
      network: networkInterfaces,
      loggedUsers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get system info";
    res.status(500).json({ error: message });
  }
});

router.get("/system/pm2", (_req, res) => {
  exec("pm2 jlist 2>/dev/null", (err, stdout) => {
    if (err || !stdout.trim()) {
      return res.json({ available: false, processes: [] });
    }
    try {
      const raw = JSON.parse(stdout) as {
        name: string;
        pm_id: number;
        pid: number;
        pm2_env?: {
          status?: string;
          pm_uptime?: number;
          restart_time?: number;
          exec_interpreter?: string;
          pm_exec_path?: string;
          cwd?: string;
          node_version?: string;
          watch?: boolean;
        };
        monit?: { memory?: number; cpu?: number };
      }[];

      const processes = raw.map((p) => ({
        id: p.pm_id,
        name: p.name,
        pid: p.pid,
        status: p.pm2_env?.status ?? "unknown",
        cpu: p.monit?.cpu ?? 0,
        memory: p.monit?.memory ?? 0,
        uptime: p.pm2_env?.pm_uptime ?? 0,
        restarts: p.pm2_env?.restart_time ?? 0,
        interpreter: p.pm2_env?.exec_interpreter ?? "node",
        script: p.pm2_env?.pm_exec_path ?? "",
        cwd: p.pm2_env?.cwd ?? "",
        watch: p.pm2_env?.watch ?? false,
        nodeVersion: p.pm2_env?.node_version ?? "",
      }));

      res.json({ available: true, processes });
    } catch {
      res.json({ available: false, processes: [] });
    }
  });
});

router.get("/system/pm2/by-cwd", (req, res) => {
  const cwd = req.query.path as string;
  if (!cwd) return res.status(400).json({ error: "path required" });
  exec("pm2 jlist 2>/dev/null", (err, stdout) => {
    if (err || !stdout.trim()) return res.json({ process: null });
    try {
      const raw = JSON.parse(stdout) as { name: string; pm_id: number; pm2_env?: Record<string, unknown> }[];
      const proc = raw.find((p) => (p.pm2_env as Record<string, unknown>)?.pm_cwd === cwd);
      if (!proc) return res.json({ process: null });
      const env = (proc.pm2_env ?? {}) as Record<string, unknown>;
      res.json({
        process: {
          name: proc.name,
          id: proc.pm_id,
          out: (env.pm_out_log_path as string) || null,
          err: (env.pm_err_log_path as string) || null,
          cwd: (env.pm_cwd as string) || null,
        },
      });
    } catch {
      res.json({ process: null });
    }
  });
});

router.get("/system/pm2/:name", (req, res) => {
  exec("pm2 jlist 2>/dev/null", (err, stdout) => {
    if (err || !stdout.trim()) return res.status(503).json({ error: "PM2 not available" });
    try {
      const raw = JSON.parse(stdout) as { name: string; pm_id: number; pid: number; pm2_env?: Record<string, unknown>; monit?: { memory?: number; cpu?: number } }[];
      const proc = raw.find((p) => p.name === req.params.name || String(p.pm_id) === req.params.name);
      if (!proc) return res.status(404).json({ error: "Process not found" });
      const env = (proc.pm2_env ?? {}) as Record<string, unknown>;
      res.json({
        id: proc.pm_id,
        name: proc.name,
        pid: proc.pid,
        status: (env.status as string) ?? "unknown",
        cpu: proc.monit?.cpu ?? 0,
        memory: proc.monit?.memory ?? 0,
        uptime: (env.pm_uptime as number) ?? 0,
        restarts: (env.restart_time as number) ?? 0,
        interpreter: (env.exec_interpreter as string) ?? "node",
        script: (env.pm_exec_path as string) ?? "",
        cwd: (env.cwd as string) ?? "",
        watch: (env.watch as boolean) ?? false,
        nodeVersion: (env.node_version as string) ?? "",
        logFile: (env.pm_out_log_path as string) ?? "",
        errorFile: (env.pm_err_log_path as string) ?? "",
        execMode: (env.exec_mode as string) ?? "fork",
        createdAt: (env.created_at as number) ?? 0,
      });
    } catch {
      res.status(500).json({ error: "Failed to parse PM2 data" });
    }
  });
});

router.get("/system/pm2/:name/logs", (req, res) => {
  exec("pm2 jlist 2>/dev/null", (err, stdout) => {
    if (err || !stdout.trim()) return res.status(503).json({ error: "PM2 not available" });
    try {
      const raw = JSON.parse(stdout) as { name: string; pm_id: number; pm2_env?: Record<string, unknown> }[];
      const proc = raw.find((p) => p.name === req.params.name || String(p.pm_id) === req.params.name);
      if (!proc) return res.status(404).json({ error: "Process not found" });
      const env = (proc.pm2_env ?? {}) as Record<string, unknown>;
      const outLog = (env.pm_out_log_path as string) ?? "";
      const errLog = (env.pm_err_log_path as string) ?? "";
      const lines = parseInt(req.query.lines as string) || 80;
      const readLog = (file: string): string[] => {
        if (!file || !fs.existsSync(file)) return [];
        try {
          return execSync(`tail -n ${lines} "${file}" 2>/dev/null`, { timeout: 3000, encoding: "utf8" })
            .split("\n").filter(Boolean);
        } catch { return []; }
      };
      res.json({ stdout: readLog(outLog), stderr: readLog(errLog), outFile: outLog, errFile: errLog });
    } catch {
      res.status(500).json({ error: "Failed to read logs" });
    }
  });
});

router.post("/system/pm2/:name/restart", (req, res) => {
  const name = req.params.name;
  exec(`pm2 flush "${name}" 2>&1 && pm2 restart "${name}" 2>&1`, { timeout: 20000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message, output: stdout });
    res.json({ ok: true, output: stdout.trim() });
  });
});

router.post("/system/pm2/:name/stop", (req, res) => {
  exec(`pm2 stop "${req.params.name}" 2>&1`, { timeout: 10000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message, output: stdout });
    res.json({ ok: true, output: stdout.trim() });
  });
});

router.post("/system/pm2/:name/start", (req, res) => {
  exec(`pm2 start "${req.params.name}" 2>&1`, { timeout: 10000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message, output: stdout });
    res.json({ ok: true, output: stdout.trim() });
  });
});

router.post("/system/pm2/:name/flush", (req, res) => {
  exec(`pm2 flush "${req.params.name}" 2>&1`, { timeout: 10000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message, output: stdout });
    res.json({ ok: true, output: stdout.trim() });
  });
});

router.post("/system/pm2/:name/rebuild-restart", (req, res) => {
  const name = req.params.name;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (event: string, data: Record<string, unknown>) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // flush if underlying socket supports it
    if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
      (res as unknown as { flush: () => void }).flush();
    }
  };

  exec("pm2 jlist 2>/dev/null", { timeout: 8000 }, (err, stdout) => {
    if (err || !stdout.trim()) {
      send("error", { message: "PM2 not available" });
      return res.end();
    }
    let raw: { name: string; pm2_env?: Record<string, unknown> }[];
    try { raw = JSON.parse(stdout); } catch {
      send("error", { message: "Failed to parse PM2 data" });
      return res.end();
    }
    const proc = raw.find((p) => p.name === name);
    if (!proc) {
      send("error", { message: `Process "${name}" not found` });
      return res.end();
    }
    const cwd = (proc.pm2_env?.pm_cwd as string) || (proc.pm2_env?.cwd as string) || "";
    if (!cwd) {
      send("error", { message: "Cannot determine process working directory" });
      return res.end();
    }
    const pkgPath = path.join(cwd, "package.json");
    if (!fs.existsSync(pkgPath)) {
      send("error", { message: `No package.json found in ${cwd}` });
      return res.end();
    }
    let pkg: { scripts?: Record<string, string> };
    try { pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")); } catch {
      send("error", { message: "Failed to read package.json" });
      return res.end();
    }
    const buildScript = pkg.scripts?.build;
    if (!buildScript) {
      send("error", { message: "No \"build\" script found in package.json" });
      return res.end();
    }
    // Detect package manager
    const pm = fs.existsSync(path.join(cwd, "pnpm-lock.yaml")) ? "pnpm"
      : fs.existsSync(path.join(cwd, "yarn.lock")) ? "yarn"
      : "npm";
    send("info", { message: `Running ${pm} run build in ${cwd}…` });

    const child = spawn("bash", ["-c", `cd "${cwd}" && ${pm} run build 2>&1`], {
      detached: false,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    child.stdout.on("data", (chunk: Buffer) => {
      send("output", { text: chunk.toString() });
    });
    child.stderr.on("data", (chunk: Buffer) => {
      send("output", { text: chunk.toString() });
    });
    child.on("close", (code) => {
      if (code !== 0) {
        send("error", { message: `Build exited with code ${code}` });
        return res.end();
      }
      send("info", { message: "Build complete. Flushing logs and restarting…" });
      exec(`pm2 flush "${name}" 2>&1 && pm2 restart "${name}" 2>&1`, { timeout: 20000 }, (restartErr, restartOut) => {
        if (restartErr) {
          send("error", { message: `Restart failed: ${restartErr.message}` });
        } else {
          send("done", { ok: true, output: restartOut.trim() });
        }
        res.end();
      });
    });
    req.on("close", () => { try { child.kill(); } catch { /* ignore */ } });
  });
});

router.get("/system/git", (_req, res) => {
  try {
    const searchRoots = ["/root", "/home", "/var/www", "/opt"];
    const repos: { path: string; branch: string; remote: string; lastCommit: string; dirty: boolean }[] = [];
    const checked = new Set<string>();

    const tryAddRepo = (dir: string) => {
      if (checked.has(dir) || !fs.existsSync(path.join(dir, ".git"))) return;
      checked.add(dir);
      repos.push({
        path: dir,
        branch: run(`git -C "${dir}" rev-parse --abbrev-ref HEAD 2>/dev/null`),
        remote: run(`git -C "${dir}" remote get-url origin 2>/dev/null`),
        lastCommit: run(`git -C "${dir}" log -1 --format="%h %s" 2>/dev/null`),
        dirty: run(`git -C "${dir}" status --porcelain 2>/dev/null`).length > 0,
      });
    };

    const pm2CWDs: string[] = [];
    try {
      const pm2Out = execSync("pm2 jlist 2>/dev/null", { timeout: 5000, encoding: "utf8" });
      if (pm2Out.trim()) {
        (JSON.parse(pm2Out) as { pm2_env?: { cwd?: string } }[])
          .forEach((p) => { if (p.pm2_env?.cwd) pm2CWDs.push(p.pm2_env.cwd); });
      }
    } catch { /* pm2 not available */ }

    [...searchRoots, ...pm2CWDs].forEach((base) => {
      if (!fs.existsSync(base)) return;
      tryAddRepo(base);
      try {
        fs.readdirSync(base, { withFileTypes: true })
          .filter((d) => d.isDirectory() && !d.name.startsWith("."))
          .forEach((d) => tryAddRepo(path.join(base, d.name)));
      } catch { /* permission denied */ }
    });

    res.json({ repos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to scan git repos";
    res.status(500).json({ error: message });
  }
});

router.get("/system/sites", (_req, res) => {
  const sitesDir = "/etc/nginx/sites-enabled";
  if (!fs.existsSync(sitesDir)) return res.json({ sites: [] });

  interface GitInfo {
    branch: string;
    remote: string;
    lastCommit: string;
    dirty: boolean;
    gitRoot: string;
  }

  interface SiteEntry {
    name: string;
    domain: string;
    root: string | null;
    proxyPass: string | null;
    ssl: boolean;
    status: number | null;
    git: GitInfo | null;
  }

  const findGitRoot = (startDir: string): string | null => {
    let cur = startDir;
    for (let i = 0; i < 8; i++) {
      if (fs.existsSync(path.join(cur, ".git"))) return cur;
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    return null;
  };

  const getGitInfo = (dir: string): GitInfo | null => {
    if (!dir) return null;
    const gitRoot = findGitRoot(dir);
    if (!gitRoot) return null;
    try {
      const rawRemote = run(`git -C "${gitRoot}" remote get-url origin 2>/dev/null`);
      if (!rawRemote) return null;
      // Strip embedded tokens from HTTPS URLs
      const remote = rawRemote.replace(/https?:\/\/[^@]+@/, "https://");
      // Branch — use remote default branch if local HEAD has no commits yet
      let branch = run(`git -C "${gitRoot}" rev-parse --abbrev-ref HEAD 2>/dev/null`);
      if (!branch || branch === "HEAD") {
        const fetchHeadFile = path.join(gitRoot, ".git", "FETCH_HEAD");
        if (fs.existsSync(fetchHeadFile)) {
          const fh = fs.readFileSync(fetchHeadFile, "utf8").split("\n")[0];
          branch = fh.match(/branch '([^']+)'/)?.[1] ?? "main";
        } else {
          branch = "main";
        }
      }
      // Last commit — try local HEAD first, then FETCH_HEAD
      let lastCommit = run(`git -C "${gitRoot}" log -1 --format="%h %s" 2>/dev/null`);
      if (!lastCommit) {
        lastCommit = run(`git -C "${gitRoot}" log -1 --format="%h %s" FETCH_HEAD 2>/dev/null`);
      }
      const dirty = run(`git -C "${gitRoot}" status --porcelain 2>/dev/null`).length > 0;
      return { branch, remote, lastCommit, dirty, gitRoot };
    } catch { return null; }
  };

  const sites: SiteEntry[] = [];

  try {
    const files = fs.readdirSync(sitesDir).filter((f) => f !== "default");
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(sitesDir, file), "utf8");
        const domainMatches = [...content.matchAll(/server_name\s+([^;]+);/g)]
          .flatMap((m) => m[1].trim().split(/\s+/))
          .filter((d) => d !== "_" && !d.startsWith("~") && d.includes("."));
        const domain = domainMatches[0] ?? null;
        if (!domain) continue;

        const root = content.match(/root\s+([^;]+);/)?.[1]?.trim() ?? null;
        const proxyPassMatch = content.match(/proxy_pass\s+(https?:\/\/[^;]+);/)?.[1]?.trim() ?? null;
        const ssl = content.includes("listen 443");

        // Find git: check root dir first; for proxy-only sites resolve port → CWD via /proc
        let gitDir: string | null = root;
        // Only look up proc CWD when there's no static root (pure proxy site)
        if (!gitDir && proxyPassMatch) {
          const portMatch = proxyPassMatch.match(/:(\d+)/);
          if (portMatch) {
            const port = portMatch[1];
            try {
              const ssOut = run(`ss -tlnp 2>/dev/null | grep ':${port} '`);
              const pidMatch = ssOut.match(/pid=(\d+)/);
              if (pidMatch) {
                const procCwd = run(`readlink /proc/${pidMatch[1]}/cwd 2>/dev/null`);
                if (procCwd && fs.existsSync(procCwd)) gitDir = procCwd;
              }
            } catch { /* ignore */ }
          }
        }

        const git = gitDir ? getGitInfo(gitDir) : null;
        sites.push({ name: file, domain, root, proxyPass: proxyPassMatch, ssl, status: null, git });
      } catch { /* skip bad config */ }
    }
  } catch {
    return res.status(500).json({ error: "Cannot read nginx sites" });
  }

  const checks = sites.map(
    (site) =>
      new Promise<void>((resolve) => {
        const scheme = site.ssl ? "https" : "http";
        exec(
          `curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 8 -L "${scheme}://${site.domain}" 2>/dev/null`,
          { timeout: 12000 },
          (_, stdout) => {
            const code = parseInt(stdout.trim(), 10);
            site.status = isNaN(code) || code === 0 ? null : code;
            resolve();
          }
        );
      })
  );

  Promise.all(checks).then(() => res.json({ sites }));
});

router.get("/system/github-ssh", (_req, res) => {
  const sshDir = "/root/.ssh";
  const keyTypes = ["id_ed25519", "id_rsa", "id_ecdsa", "id_dsa"];
  const keys: { type: string; publicKey: string; fingerprint: string }[] = [];

  for (const keyType of keyTypes) {
    const pubPath = path.join(sshDir, `${keyType}.pub`);
    const privPath = path.join(sshDir, keyType);
    if (fs.existsSync(pubPath) && fs.existsSync(privPath)) {
      const publicKey = (() => { try { return fs.readFileSync(pubPath, "utf8").trim(); } catch { return ""; } })();
      const fingerprint = run(`ssh-keygen -lf "${pubPath}" 2>/dev/null | awk '{print $2}'`);
      if (publicKey) keys.push({ type: keyType, publicKey, fingerprint });
    }
  }

  exec(
    `ssh -T git@github.com -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=8 2>&1`,
    { timeout: 12000 },
    (_, stdout) => {
      const out = (stdout ?? "").trim();
      const connected = out.includes("successfully authenticated") || /^Hi .+!/.test(out);
      const authUser = out.match(/Hi (.+?)!/)?.[1] ?? null;
      res.json({ keys, connected, authUser, sshTestOutput: out });
    }
  );
});

router.post("/system/git-pull", (req, res) => {
  const { dir } = req.body as { dir?: string };
  if (!dir) return res.status(400).json({ error: "dir is required" });

  // Walk up to find the git root (mirrors getGitInfo logic)
  const findGitRoot = (startDir: string): string | null => {
    let cur = startDir;
    for (let i = 0; i < 8; i++) {
      if (fs.existsSync(path.join(cur, ".git"))) return cur;
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    return null;
  };

  const gitRoot = findGitRoot(dir);
  if (!gitRoot) return res.status(400).json({ error: `No git repository found at or above: ${dir}` });

  // Determine default remote branch (main or master)
  const remoteBranch = run(`git -C "${gitRoot}" ls-remote --symref origin HEAD 2>/dev/null`)
    .match(/ref: refs\/heads\/(\S+)\s+HEAD/)?.[1] ?? "main";

  // Ensure local branch exists and tracks remote
  const localBranch = run(`git -C "${gitRoot}" rev-parse --abbrev-ref HEAD 2>/dev/null`);
  const hasCommits = run(`git -C "${gitRoot}" rev-parse HEAD 2>/dev/null`).length > 0;

  let pullCmd: string;
  if (!hasCommits) {
    // Fresh repo with existing files — fetch then reset hard (handles untracked files safely)
    pullCmd = `git -C "${gitRoot}" fetch origin ${remoteBranch} 2>&1 && git -C "${gitRoot}" reset --hard origin/${remoteBranch} 2>&1`;
  } else {
    // Repo with commits — ensure tracking then pull
    const trackSetup = (localBranch === "HEAD" || localBranch === "")
      ? `git -C "${gitRoot}" checkout -B ${remoteBranch} origin/${remoteBranch} 2>&1 && `
      : `git -C "${gitRoot}" branch --set-upstream-to=origin/${remoteBranch} ${remoteBranch} 2>/dev/null; `;
    pullCmd = `${trackSetup}git -C "${gitRoot}" pull origin ${remoteBranch} --no-rebase 2>&1`;
  }

  exec(
    pullCmd,
    { timeout: 60000, encoding: "utf8" },
    (err, stdout) => {
      const output = stdout?.trim() ?? "";
      if (err && !output) {
        return res.status(500).json({ ok: false, error: err.message, output: "" });
      }
      res.json({ ok: !err, output, gitRoot });
    }
  );
});

router.post("/system/clear-cache", (_req, res) => {
  exec("sync", (syncErr) => {
    if (syncErr) {
      return res.status(500).json({ error: "sync failed: " + syncErr.message });
    }
    exec("echo 3 > /proc/sys/vm/drop_caches", (cacheErr) => {
      if (cacheErr) {
        res.json({
          ok: true,
          cacheDropped: false,
          message: "Filesystem synced. Cache drop skipped — root privileges required.",
        });
      } else {
        res.json({
          ok: true,
          cacheDropped: true,
          message: "Filesystem synced and page cache dropped.",
        });
      }
    });
  });
});

export default router;
