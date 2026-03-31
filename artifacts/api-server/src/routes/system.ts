import { Router } from "express";
import { execSync, exec } from "child_process";
import os from "os";
import fs from "fs";

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
