import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { Footer } from "@/components/footer";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, RefreshCw, RotateCcw, Square, Play, Trash2,
  CheckCircle2, XCircle, AlertCircle, FolderOpen,
  FileText, Terminal, Cpu, MemoryStick, Clock, Hash,
  ChevronRight, Layers, Copy, Check, Wrench, ChevronDown, ChevronUp,
} from "lucide-react";

interface Pm2Detail {
  id: number;
  name: string;
  pid: number;
  status: string;
  cpu: number;
  memory: number;
  uptime: number;
  restarts: number;
  interpreter: string;
  script: string;
  cwd: string;
  watch: boolean;
  nodeVersion: string;
  logFile: string;
  errorFile: string;
  execMode: string;
  createdAt: number;
}

interface Logs {
  stdout: string[];
  stderr: string[];
  outFile: string;
  errFile: string;
}

function fmtBytes(b: number) {
  if (!b) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return (b / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

function fmtUptime(ms: number) {
  if (!ms) return "—";
  const s = Math.floor((Date.now() - ms) / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

type LogTab = "combined" | "stdout" | "stderr";

export default function Pm2DetailPage() {
  const { name } = useParams<{ name: string }>();
  const [, navigate] = useLocation();
  const { apiKey } = useAuth();
  const { toast } = useToast();

  const [proc, setProc] = useState<Pm2Detail | null>(null);
  const [logs, setLogs] = useState<Logs | null>(null);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [logTab, setLogTab] = useState<LogTab>("combined");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [logCopied, setLogCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [buildLines, setBuildLines] = useState<{ text: string; type: "info" | "output" | "error" | "done" }[]>([]);
  const [showBuildPanel, setShowBuildPanel] = useState(false);
  const buildEndRef = useRef<HTMLDivElement>(null);

  const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

  const fetchProc = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`/api/system/pm2/${encodeURIComponent(name)}`, { headers });
      if (res.ok) setProc(await res.json());
      else if (res.status === 404) navigate("/");
    } catch { /* ignore */ }
    setLoading(false);
  }, [name, apiKey]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/system/pm2/${encodeURIComponent(name)}/logs?lines=100`, { headers });
      if (res.ok) setLogs(await res.json());
    } catch { /* ignore */ }
    setLogsLoading(false);
  }, [name, apiKey]);

  useEffect(() => {
    fetchProc();
    fetchLogs();
  }, [fetchProc, fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => { fetchProc(true); fetchLogs(); }, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, fetchProc, fetchLogs]);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function doAction(action: "restart" | "stop" | "start" | "flush") {
    setActing(action);
    try {
      const res = await fetch(`/api/system/pm2/${encodeURIComponent(name)}/${action}`, {
        method: "POST",
        headers,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action failed");
      toast({ title: `${action.charAt(0).toUpperCase() + action.slice(1)} successful` });
      setTimeout(() => { fetchProc(true); fetchLogs(); }, 1200);
    } catch (e) {
      toast({ title: `${action} failed`, description: (e as Error).message, variant: "destructive" });
    }
    setActing(null);
  }

  async function doRebuildRestart() {
    setActing("rebuild");
    setBuildLines([]);
    setShowBuildPanel(true);
    try {
      const res = await fetch(`/api/system/pm2/${encodeURIComponent(name)}/rebuild-restart`, {
        method: "POST",
        headers,
      });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let success = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const blocks = buf.split("\n\n");
        buf = blocks.pop() ?? "";
        for (const block of blocks) {
          const lines = block.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event: "));
          const dataLine = lines.find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.replace("event: ", "").trim();
          let data: Record<string, unknown> = {};
          try { data = JSON.parse(dataLine.replace("data: ", "")); } catch { /* skip */ }
          if (event === "output") {
            const text = String(data.text ?? "");
            text.split("\n").filter(Boolean).forEach((line) =>
              setBuildLines((prev) => [...prev, { text: line, type: "output" }])
            );
          } else if (event === "info") {
            setBuildLines((prev) => [...prev, { text: String(data.message ?? ""), type: "info" }]);
          } else if (event === "error") {
            setBuildLines((prev) => [...prev, { text: String(data.message ?? ""), type: "error" }]);
            toast({ title: "Rebuild failed", description: String(data.message ?? ""), variant: "destructive" });
          } else if (event === "done") {
            success = true;
            setBuildLines((prev) => [...prev, { text: "✓ Rebuild & restart complete", type: "done" }]);
          }
        }
        // Auto-scroll build output
        setTimeout(() => buildEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
      if (success) {
        toast({ title: "Rebuild & restart successful" });
        setTimeout(() => { fetchProc(true); fetchLogs(); }, 1500);
      }
    } catch (e) {
      toast({ title: "Rebuild failed", description: (e as Error).message, variant: "destructive" });
      setBuildLines((prev) => [...prev, { text: (e as Error).message, type: "error" }]);
    }
    setActing(null);
  }

  const isOnline = proc?.status === "online";
  const isStopped = proc?.status === "stopped";
  const StatusIcon = isOnline ? CheckCircle2 : isStopped ? XCircle : AlertCircle;
  const statusColor = isOnline ? "#0ff4c6" : isStopped ? "#ff6b6b" : "#f59e0b";

  const combinedLogs = [
    ...(logs?.stdout ?? []).map((l) => ({ line: l, type: "out" as const })),
    ...(logs?.stderr ?? []).map((l) => ({ line: l, type: "err" as const })),
  ].sort((a, b) => {
    const ta = a.line.match(/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/)?.[0] ?? "";
    const tb = b.line.match(/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/)?.[0] ?? "";
    return ta.localeCompare(tb);
  });

  const displayedLogs =
    logTab === "stdout" ? (logs?.stdout ?? []).map((l) => ({ line: l, type: "out" as const }))
    : logTab === "stderr" ? (logs?.stderr ?? []).map((l) => ({ line: l, type: "err" as const }))
    : combinedLogs;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#08090d" }}>
      {/* Header */}
      <div
        className="px-6 py-6 border-b"
        style={{
          background: "radial-gradient(ellipse 80% 80% at 50% 0%, rgba(110,92,255,.1) 0%, transparent 70%)",
          borderColor: "rgba(110,92,255,.15)",
        }}
      >
        <div className="max-w-screen-xl mx-auto">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(110,92,255,.15)", border: "1px solid rgba(110,92,255,.3)" }}>
                <Layers className="w-5 h-5" style={{ color: "#6e5cff" }} />
              </div>
              <div>
                {loading ? (
                  <Skeleton className="h-7 w-40 mb-1" />
                ) : (
                  <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                    {proc?.name ?? name}
                    <span className="flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}40` }}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {proc?.status ?? "—"}
                    </span>
                  </h1>
                )}
                {proc && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    id:{proc.id} · pid:{proc.pid || "—"} · {proc.execMode} · {proc.interpreter}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs border-border/50"
                onClick={() => { fetchProc(true); fetchLogs(); }}
                disabled={!!acting}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
              <button
                onClick={() => setAutoRefresh((v) => !v)}
                className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${autoRefresh ? "text-[#0ff4c6]" : "text-muted-foreground"}`}
                style={{
                  background: autoRefresh ? "rgba(15,244,198,.1)" : "transparent",
                  border: `1px solid ${autoRefresh ? "rgba(15,244,198,.3)" : "rgba(255,255,255,.08)"}`,
                }}
              >
                {autoRefresh ? "● Live" : "○ Paused"}
              </button>
              <Button
                size="sm"
                onClick={() => doAction("restart")}
                disabled={!!acting}
                className="h-8 gap-1.5 text-xs"
                style={{ background: "rgba(110,92,255,.2)", color: "#a8a0ff", border: "1px solid rgba(110,92,255,.4)" }}
              >
                <RotateCcw className={`w-3.5 h-3.5 ${acting === "restart" ? "animate-spin" : ""}`} />
                {acting === "restart" ? "Restarting…" : "Restart"}
              </Button>
              {isOnline ? (
                <Button
                  size="sm"
                  onClick={() => doAction("stop")}
                  disabled={!!acting}
                  className="h-8 gap-1.5 text-xs"
                  style={{ background: "rgba(255,107,107,.15)", color: "#ff6b6b", border: "1px solid rgba(255,107,107,.35)" }}
                >
                  <Square className="w-3.5 h-3.5" />
                  {acting === "stop" ? "Stopping…" : "Stop"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => doAction("start")}
                  disabled={!!acting}
                  className="h-8 gap-1.5 text-xs"
                  style={{ background: "rgba(15,244,198,.15)", color: "#0ff4c6", border: "1px solid rgba(15,244,198,.35)" }}
                >
                  <Play className="w-3.5 h-3.5" />
                  {acting === "start" ? "Starting…" : "Start"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => doAction("flush")}
                disabled={!!acting}
                variant="outline"
                className="h-8 gap-1.5 text-xs border-border/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {acting === "flush" ? "Flushing…" : "Flush Logs"}
              </Button>
              <Button
                size="sm"
                onClick={doRebuildRestart}
                disabled={!!acting}
                className="h-8 gap-1.5 text-xs"
                style={{ background: "rgba(15,244,198,.12)", color: "#0ff4c6", border: "1px solid rgba(15,244,198,.3)" }}
              >
                <Wrench className={`w-3.5 h-3.5 ${acting === "rebuild" ? "animate-spin" : ""}`} />
                {acting === "rebuild" ? "Building…" : "Rebuild & Restart"}
              </Button>
              {buildLines.length > 0 && (
                <button
                  onClick={() => setShowBuildPanel((v) => !v)}
                  className="h-8 px-2 rounded-md text-xs font-mono text-muted-foreground/60 hover:text-foreground flex items-center gap-1 transition-colors"
                  style={{ border: "1px solid rgba(255,255,255,.08)" }}
                >
                  {showBuildPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Build output
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">
        {/* Build output panel */}
        {showBuildPanel && buildLines.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(15,244,198,.2)", background: "#0a0e14" }}>
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid rgba(15,244,198,.1)", background: "rgba(15,244,198,.04)" }}>
              <div className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5" style={{ color: "#0ff4c6" }} />
                <span className="text-xs font-mono font-bold" style={{ color: "#0ff4c6" }}>Build Output</span>
                {acting === "rebuild" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded animate-pulse font-medium"
                    style={{ background: "rgba(15,244,198,.12)", color: "#0ff4c6" }}>RUNNING</span>
                )}
              </div>
              <button onClick={() => setShowBuildPanel(false)} className="text-muted-foreground/40 hover:text-foreground text-xs">✕</button>
            </div>
            <div className="p-4 max-h-72 overflow-y-auto font-mono text-xs space-y-0.5">
              {buildLines.map((line, i) => (
                <div key={i} className={
                  line.type === "error" ? "text-red-400" :
                  line.type === "info" ? "text-[#0ff4c6]/80" :
                  line.type === "done" ? "text-[#0ff4c6] font-bold" :
                  "text-foreground/60"
                }>{line.text}</div>
              ))}
              <div ref={buildEndRef} />
            </div>
          </div>
        )}

        {/* Stats row */}
        {proc && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Cpu, label: "CPU", value: `${proc.cpu.toFixed(1)}%`, color: "#6e5cff" },
              { icon: MemoryStick, label: "Memory", value: fmtBytes(proc.memory), color: "#0ff4c6" },
              { icon: Clock, label: "Uptime", value: fmtUptime(proc.uptime), color: "#6e5cff" },
              { icon: Hash, label: "Restarts", value: String(proc.restarts), color: "#0ff4c6" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-xl p-4"
                style={{ background: "#0f1117", border: "1px solid rgba(110,92,255,.15)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</span>
                </div>
                <div className="text-xl font-black text-foreground">{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Process info + CWD files */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Process info */}
          <div className="rounded-2xl p-5"
            style={{ background: "#0f1117", border: "1px solid rgba(110,92,255,.18)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="w-4 h-4" style={{ color: "#6e5cff" }} />
              <h2 className="text-sm font-bold text-foreground">Process Info</h2>
            </div>
            {loading ? (
              <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-5 rounded" />)}</div>
            ) : proc ? (
              <div className="space-y-3 text-xs">
                {[
                  ["Script", proc.script || "—"],
                  ["Working Dir", proc.cwd || "—"],
                  ["Interpreter", `${proc.interpreter}${proc.nodeVersion ? ` (${proc.nodeVersion})` : ""}`],
                  ["Exec Mode", proc.execMode],
                  ["Watch", proc.watch ? "enabled" : "disabled"],
                  ["Log File", proc.logFile || "—"],
                  ["Error File", proc.errorFile || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <span className="text-muted-foreground flex-shrink-0 font-medium">{k}</span>
                    <span className="font-mono text-foreground text-right truncate max-w-[220px]" title={v}>{v}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* CWD files */}
          <div className="rounded-2xl p-5"
            style={{ background: "#0f1117", border: "1px solid rgba(110,92,255,.18)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" style={{ color: "#0ff4c6" }} />
                <h2 className="text-sm font-bold text-foreground">Working Directory</h2>
              </div>
              {proc?.cwd && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs border-border/50"
                  onClick={() => navigate(`/files?path=${encodeURIComponent(proc.cwd)}`)}
                >
                  <FolderOpen className="w-3 h-3" />
                  Open
                </Button>
              )}
            </div>
            {proc?.cwd ? (
              <CwdFileList cwd={proc.cwd} headers={headers} navigate={navigate} />
            ) : (
              <p className="text-xs text-muted-foreground/50">No working directory</p>
            )}
          </div>
        </div>

        {/* Logs section */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "#0f1117", border: "1px solid rgba(110,92,255,.18)" }}>
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid rgba(110,92,255,.1)", background: "rgba(110,92,255,.04)" }}>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: "#6e5cff" }} />
              <h2 className="text-sm font-bold text-foreground">Logs</h2>
              <span className="text-xs text-muted-foreground/50">— last 100 lines</span>
            </div>
            <div className="flex items-center gap-1">
              {(["combined", "stdout", "stderr"] as LogTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLogTab(tab)}
                  className="h-6 px-2.5 rounded text-xs font-medium transition-colors"
                  style={{
                    background: logTab === tab ? "rgba(110,92,255,.2)" : "transparent",
                    color: logTab === tab ? "#a8a0ff" : "var(--muted-foreground)",
                    border: `1px solid ${logTab === tab ? "rgba(110,92,255,.4)" : "transparent"}`,
                  }}
                >
                  {tab === "combined" ? "All" : tab}
                  {tab === "stderr" && logs && logs.stderr.length > 0 && (
                    <span className="ml-1 text-[10px] text-[#ff6b6b]">({logs.stderr.length})</span>
                  )}
                </button>
              ))}
              {displayedLogs.length > 0 && (
                <button
                  onClick={() => {
                    const text = displayedLogs.map((e) => e.line).join("\n");
                    navigator.clipboard.writeText(text).then(() => {
                      setLogCopied(true);
                      setTimeout(() => setLogCopied(false), 2000);
                    });
                  }}
                  className="h-6 px-2 rounded text-xs font-medium flex items-center gap-1 transition-colors ml-1"
                  style={{
                    background: "transparent",
                    color: logCopied ? "#0ff4c6" : "var(--muted-foreground)",
                    border: `1px solid ${logCopied ? "rgba(15,244,198,.3)" : "transparent"}`,
                  }}
                  title="Copy all logs"
                >
                  {logCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{logCopied ? "Copied" : "Copy all"}</span>
                </button>
              )}
            </div>
          </div>

          <div className="font-mono text-xs overflow-y-auto" style={{ maxHeight: "420px", background: "#070809" }}>
            {logsLoading ? (
              <div className="p-4 space-y-1.5">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-4 rounded w-full" />)}
              </div>
            ) : displayedLogs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground/40 text-xs">No log output</div>
            ) : (
              <div className="p-3 space-y-0.5">
                {displayedLogs.map((entry, i) => (
                  <div key={i} className="flex gap-2 group hover:bg-white/[0.02] px-1 rounded leading-5">
                    <span className="text-muted-foreground/30 select-none w-6 text-right flex-shrink-0">
                      {i + 1}
                    </span>
                    <span
                      className="break-all"
                      style={{ color: entry.type === "err" ? "#ff8a80" : "rgba(255,255,255,.75)" }}
                    >
                      {entry.line}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function CwdFileList({
  cwd,
  headers,
  navigate,
}: {
  cwd: string;
  headers: Record<string, string>;
  navigate: (to: string) => void;
}) {
  const [files, setFiles] = useState<{ name: string; isDirectory: boolean; size: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/files/list?path=${encodeURIComponent(cwd)}`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.entries) {
          setFiles(
            data.entries
              .slice(0, 20)
              .map((e: { name: string; isDirectory: boolean; size: number }) => e)
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cwd]);

  if (loading) return <div className="space-y-1.5">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-5 rounded" />)}</div>;

  if (!files.length) return <p className="text-xs text-muted-foreground/40">Directory empty or unreadable</p>;

  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground/50 font-mono mb-2 truncate">{cwd}</p>
      {files.map((f) => (
        <button
          key={f.name}
          onClick={() => navigate(`/files?path=${encodeURIComponent(cwd + "/" + f.name)}`)}
          className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.04] transition-colors text-left group"
        >
          <span className="text-base leading-none flex-shrink-0">
            {f.isDirectory ? "📁" : "📄"}
          </span>
          <span className="text-xs font-mono text-foreground truncate flex-1">{f.name}</span>
          {!f.isDirectory && (
            <span className="text-xs text-muted-foreground/40 flex-shrink-0">
              {f.size > 0 ? (f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)}M` : f.size > 1024 ? `${(f.size / 1024).toFixed(0)}K` : `${f.size}B`) : ""}
            </span>
          )}
          <ChevronRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-muted-foreground/60 flex-shrink-0" />
        </button>
      ))}
      {files.length === 20 && (
        <button
          onClick={() => navigate(`/files?path=${encodeURIComponent(cwd)}`)}
          className="w-full text-xs text-muted-foreground/50 hover:text-[#6e5cff] mt-1 text-center transition-colors"
        >
          View all files →
        </button>
      )}
    </div>
  );
}
