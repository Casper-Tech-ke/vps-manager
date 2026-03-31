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
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to get system info" });
  }
});

router.post("/system/clear-cache", (_req, res) => {
  exec("sync", (syncErr) => {
    if (syncErr) {
      return res.status(500).json({ error: "sync failed: " + syncErr.message });
    }
    exec("echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true", (cacheErr) => {
      const msg = cacheErr
        ? "Filesystem synced (cache drop requires root privileges)"
        : "Filesystem synced and page cache cleared";
      res.json({ ok: true, message: msg });
    });
  });
});

export default router;
