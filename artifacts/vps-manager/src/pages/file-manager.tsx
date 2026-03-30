import { useSearch, useLocation } from "wouter";
import {
  useListFiles, getListFilesQueryKey,
  useReadFile, getReadFileQueryKey,
  useWriteFile,
  useDeleteFile,
  useCreateDirectory,
  useRenameFile,
  useExecCommand,
} from "@workspace/api-client-react";
import { useState, useEffect, useRef } from "react";
import {
  Folder, FileText, File as FileIcon, Image, Code2, Database,
  ChevronRight, ArrowLeft, RefreshCw, FolderPlus, FilePlus,
  Trash2, Edit2, MoveRight, X, Save, Terminal, AlertTriangle,
  HardDrive, Home, Play, ChevronDown, Copy, Check, Eraser,
  PanelLeft, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

type FileType = "directory" | "file" | "symlink" | "other";

function EntryIcon({ name, type, size = 18 }: { name: string; type: FileType; size?: number }) {
  const s = { width: size, height: size, flexShrink: 0 as const };
  if (type === "directory") return <Folder style={s} className="text-amber-400 fill-amber-400/20" />;
  if (type === "symlink") return <FileIcon style={s} className="text-sky-400" />;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["db", "sqlite", "sqlite3"].includes(ext)) return <Database style={s} className="text-orange-400" />;
  if (["png", "jpg", "jpeg", "gif", "svg", "ico", "webp", "bmp"].includes(ext)) return <Image style={s} className="text-purple-400" />;
  if (["js", "ts", "tsx", "jsx", "py", "sh", "bash", "rb", "go", "rs", "c", "cpp", "h", "java", "php", "sql", "yaml", "yml", "json", "toml", "ini", "conf", "env", "xml", "html", "css", "scss", "md", "txt", "log"].includes(ext))
    return <Code2 style={s} className="text-blue-400" />;
  return <FileIcon style={s} className="text-muted-foreground" />;
}

type DialogMode = "mkdir" | "newfile" | "rename" | "move";

const stripAnsi = (str: string) =>
  str.replace(/\x1B\[[0-9;]*[a-zA-Z]|\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)|\x1B[A-Z\\[\]^_]|\r/g, "");

// ── Component ─────────────────────────────────────────────────────────────────

export default function FileManager() {
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(searchString);
  const currentPath = searchParams.get("path") || "/";

  // Right panel: "file" | "terminal" | null
  const [rightPanel, setRightPanel] = useState<"file" | "terminal" | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  // File list drawer (visible when right panel is active)
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Dialogs (mkdir / newfile / rename / move)
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [dialogInput, setDialogInput] = useState("");
  const [actionTarget, setActionTarget] = useState<{ path: string; type: FileType } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; type: FileType } | null>(null);

  // Terminal
  const [termCmd, setTermCmd] = useState("");
  const [termHistory, setTermHistory] = useState<{ cmd: string; stdout: string; stderr: string; code: number }[]>([]);
  const termRef = useRef<HTMLDivElement>(null);
  const termInputRef = useRef<HTMLInputElement>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | "all" | null>(null);

  const qc = useQueryClient();
  const { toast } = useToast();

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: listing, isLoading, error: listError, refetch } = useListFiles(
    { path: currentPath },
    { query: { queryKey: getListFilesQueryKey({ path: currentPath }) } }
  );

  const { data: fileData, isLoading: fileLoading } = useReadFile(
    { path: selectedFile! },
    { query: { enabled: !!selectedFile, queryKey: getReadFileQueryKey({ path: selectedFile! }) } }
  );

  useEffect(() => {
    if (fileData) { setFileContent(fileData.content); setIsEditing(false); }
  }, [fileData]);

  useEffect(() => {
    setSelectedFile(null);
    setRightPanel(null);
    setIsEditing(false);
  }, [currentPath]);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [termHistory]);

  // Focus terminal input when panel opens
  useEffect(() => {
    if (rightPanel === "terminal") {
      setTimeout(() => termInputRef.current?.focus(), 50);
    }
  }, [rightPanel]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const writeMut = useWriteFile({
    mutation: {
      onSuccess: (_, vars) => {
        toast({ title: "Saved" });
        setIsEditing(false);
        qc.invalidateQueries({ queryKey: getReadFileQueryKey({ path: vars.data.path }) });
        qc.invalidateQueries({ queryKey: getListFilesQueryKey({ path: currentPath }) });
      },
      onError: (e: any) => toast({ title: "Save failed", description: e?.error, variant: "destructive" }),
    },
  });

  const deleteMut = useDeleteFile({
    mutation: {
      onSuccess: () => {
        toast({ title: "Deleted" });
        setDeleteTarget(null);
        if (rightPanel === "file") { setRightPanel(null); setSelectedFile(null); }
        qc.invalidateQueries({ queryKey: getListFilesQueryKey({ path: currentPath }) });
      },
      onError: (e: any) => toast({ title: "Delete failed", description: e?.error, variant: "destructive" }),
    },
  });

  const mkdirMut = useCreateDirectory({
    mutation: {
      onSuccess: () => {
        toast({ title: "Folder created" });
        setDialogMode(null);
        qc.invalidateQueries({ queryKey: getListFilesQueryKey({ path: currentPath }) });
      },
      onError: (e: any) => toast({ title: "Failed", description: e?.error, variant: "destructive" }),
    },
  });

  const newFileMut = useWriteFile({
    mutation: {
      onSuccess: (_, vars) => {
        toast({ title: "File created" });
        setDialogMode(null);
        qc.invalidateQueries({ queryKey: getListFilesQueryKey({ path: currentPath }) });
        openFile(vars.data.path);
      },
      onError: (e: any) => toast({ title: "Failed", description: e?.error, variant: "destructive" }),
    },
  });

  const renameMut = useRenameFile({
    mutation: {
      onSuccess: () => {
        toast({ title: dialogMode === "move" ? "Moved" : "Renamed" });
        setDialogMode(null);
        if (rightPanel === "file") { setRightPanel(null); setSelectedFile(null); }
        qc.invalidateQueries({ queryKey: getListFilesQueryKey({ path: currentPath }) });
      },
      onError: (e: any) => toast({ title: "Failed", description: e?.error, variant: "destructive" }),
    },
  });

  const execMut = useExecCommand({
    mutation: {
      onSuccess: (result) => {
        setTermHistory((prev) => [...prev, {
          cmd: termCmd,
          stdout: stripAnsi(result.stdout),
          stderr: stripAnsi(result.stderr),
          code: result.exitCode,
        }]);
        setTermCmd("");
      },
      onError: (e: any) => toast({ title: "Exec failed", description: e?.error, variant: "destructive" }),
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const goTo = (p: string) => navigate(`/?path=${encodeURIComponent(p)}`);

  const openFile = (path: string) => {
    setSelectedFile(path);
    setRightPanel("file");
    setDrawerOpen(false);
  };

  const openTerminal = () => {
    setRightPanel("terminal");
    setDrawerOpen(false);
  };

  const closeRightPanel = () => {
    setRightPanel(null);
    setSelectedFile(null);
    setIsEditing(false);
  };

  const openDialog = (mode: DialogMode, item?: { path: string; type: FileType }) => {
    setDialogMode(mode);
    setActionTarget(item ?? null);
    setDialogInput(
      mode === "rename" && item ? (item.path.split("/").pop() ?? "") :
      mode === "move" && item ? item.path : ""
    );
  };

  const submitDialog = () => {
    if (!dialogInput.trim()) return;
    if (dialogMode === "mkdir") {
      mkdirMut.mutate({ data: { path: currentPath === "/" ? `/${dialogInput}` : `${currentPath}/${dialogInput}` } });
    } else if (dialogMode === "newfile") {
      newFileMut.mutate({ data: { path: currentPath === "/" ? `/${dialogInput}` : `${currentPath}/${dialogInput}`, content: "" } });
    } else if (dialogMode === "rename" && actionTarget) {
      const parent = actionTarget.path.substring(0, actionTarget.path.lastIndexOf("/")) || "";
      renameMut.mutate({ data: { oldPath: actionTarget.path, newPath: `${parent}/${dialogInput}` } });
    } else if (dialogMode === "move" && actionTarget) {
      renameMut.mutate({ data: { oldPath: actionTarget.path, newPath: dialogInput } });
    }
  };

  const runCommand = () => {
    const cmd = termCmd.trim();
    if (!cmd || execMut.isPending) return;
    if (cmd === "clear") { setTermHistory([]); setTermCmd(""); return; }
    execMut.mutate({ data: { command: cmd, cwd: currentPath !== "/" ? currentPath : null } });
  };

  const copyText = (text: string, id: number | "all") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(id);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  const buildBlockText = (e: typeof termHistory[0]) =>
    `$ ${e.cmd}\n${e.stdout}${e.stderr}`.trimEnd();

  const buildAllText = () => termHistory.map(buildBlockText).join("\n\n");

  // ── Computed ──────────────────────────────────────────────────────────────

  const crumbs = currentPath.split("/").filter(Boolean);
  const isPending = mkdirMut.isPending || newFileMut.isPending || renameMut.isPending;
  const rightPanelOpen = rightPanel !== null;

  // ── File list (reused in main view + drawer) ──────────────────────────────

  const FileList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <ScrollArea className="flex-1">
      {isLoading ? (
        <div className="p-3 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-md" />)}
        </div>
      ) : listError ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground p-4">
          <AlertTriangle className="w-8 h-8 text-destructive/60" />
          <p className="font-mono text-sm">Cannot read directory</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : (
        <div>
          {listing?.parentPath != null && (
            <div
              className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 cursor-pointer border-b border-border/30 transition-colors"
              onClick={() => { goTo(listing.parentPath!); onNavigate?.(); }}
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="font-mono text-sm text-muted-foreground">..</span>
            </div>
          )}
          {listing?.entries.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <Folder className="w-9 h-9 opacity-20" />
              <p className="text-sm font-mono opacity-50">Empty folder</p>
            </div>
          )}
          {listing?.entries.map((entry) => {
            const isSelected = selectedFile === entry.path;
            const entryType = entry.type as FileType;
            return (
              <div
                key={entry.path}
                className={`group relative flex items-center gap-3 px-4 py-3 border-b border-border/30 cursor-pointer transition-colors select-none ${
                  isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-accent/40"
                }`}
                onClick={() => {
                  if (entry.type === "directory") { goTo(entry.path); onNavigate?.(); }
                  else { openFile(entry.path); }
                }}
              >
                <EntryIcon name={entry.name} type={entryType} size={19} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm truncate" title={entry.name}>{entry.name}</span>
                    {entry.type === "symlink" && (
                      <Badge variant="outline" className="text-[10px] px-1 h-4 py-0 font-mono flex-shrink-0">link</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground/60">
                    {entry.type !== "directory" && <span className="font-mono">{formatSize(entry.size)}</span>}
                    <span>{formatDate(entry.modifiedAt)}</span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {entry.type !== "directory" && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openFile(entry.path); }}>
                        <FileText className="w-4 h-4 mr-2" /> Open
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openDialog("rename", { path: entry.path, type: entryType }); }}>
                      <Edit2 className="w-4 h-4 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openDialog("move", { path: entry.path, type: entryType }); }}>
                      <MoveRight className="w-4 h-4 mr-2" /> Move
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ path: entry.path, type: entryType }); }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}
    </ScrollArea>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">

      {/* ── Top bar ── */}
      <header className="flex-shrink-0 h-14 bg-card border-b border-border flex items-center gap-2 px-3">

        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <HardDrive className="w-5 h-5 text-primary" />
          <span className="font-mono font-bold text-sm text-primary hidden sm:block">FileMgr</span>
        </div>

        {/* File list toggle — shown when right panel is active */}
        {rightPanelOpen && (
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setDrawerOpen(true)}
            title="Browse files"
          >
            <PanelLeft className="w-4 h-4" />
          </Button>
        )}

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-none font-mono text-sm">
          <Button
            variant="ghost" size="sm"
            className="h-7 px-2 flex-shrink-0 text-muted-foreground hover:text-primary"
            onClick={() => goTo("/")}
          >
            <Home className="w-3.5 h-3.5" />
          </Button>
          {crumbs.map((crumb, idx) => {
            const p = "/" + crumbs.slice(0, idx + 1).join("/");
            const isLast = idx === crumbs.length - 1;
            return (
              <div key={p} className="flex items-center flex-shrink-0">
                <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
                <Button
                  variant="ghost" size="sm"
                  className={`h-7 px-1.5 font-mono text-sm ${isLast ? "text-foreground" : "text-muted-foreground"}`}
                  onClick={() => goTo(p)}
                >
                  {crumb}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Right toolbar */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!rightPanelOpen && listing?.parentPath != null && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(listing.parentPath!)} title="Go up">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          {!rightPanelOpen && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}

          {/* Terminal toggle */}
          <Button
            variant={rightPanel === "terminal" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => rightPanel === "terminal" ? closeRightPanel() : openTerminal()}
            title="Terminal"
          >
            <Terminal className="w-4 h-4" />
          </Button>

          {/* New dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="h-8 font-mono text-xs gap-1.5">
                New <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openDialog("newfile")}>
                <FilePlus className="w-4 h-4 mr-2" /> New File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog("mkdir")}>
                <FolderPlus className="w-4 h-4 mr-2" /> New Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex flex-1 min-h-0">

        {/* File list — full width when no right panel */}
        {!rightPanelOpen && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/20 border-b border-border font-mono text-xs text-muted-foreground font-medium flex-shrink-0 select-none">
              <div className="col-span-7">Name</div>
              <div className="col-span-2 text-right hidden sm:block">Size</div>
              <div className="col-span-3 text-right hidden sm:block">Modified</div>
            </div>
            <FileList />
            <div className="h-7 border-t border-border bg-card/20 flex items-center px-4 flex-shrink-0">
              <span className="font-mono text-xs text-muted-foreground/50">{listing?.entries.length ?? 0} items</span>
            </div>
          </div>
        )}

        {/* ── File viewer / editor ── */}
        {rightPanel === "file" && selectedFile && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
            <div className="h-12 border-b border-border bg-card/40 flex items-center justify-between px-4 flex-shrink-0 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Code2 className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="font-mono text-sm truncate text-primary" title={selectedFile}>
                  {selectedFile.split("/").pop()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isEditing ? (
                  <>
                    <Button
                      variant="outline" size="sm" className="h-7 font-mono text-xs"
                      onClick={() => { setIsEditing(false); setFileContent(fileData?.content ?? ""); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm" className="h-7 font-mono text-xs"
                      onClick={() => writeMut.mutate({ data: { path: selectedFile, content: fileContent } })}
                      disabled={writeMut.isPending}
                    >
                      <Save className="w-3 h-3 mr-1.5" />
                      {writeMut.isPending ? "Saving…" : "Save"}
                    </Button>
                  </>
                ) : (
                  <>
                    {!fileData?.isBinary && (
                      <Button variant="outline" size="sm" className="h-7 font-mono text-xs" onClick={() => setIsEditing(true)}>
                        <Edit2 className="w-3 h-3 mr-1.5" /> Edit
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={closeRightPanel}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              {fileLoading ? (
                <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span className="font-mono text-sm">Loading…</span>
                </div>
              ) : fileData?.isBinary ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <FileIcon className="w-14 h-14 opacity-10" />
                  <p className="font-mono text-sm">Binary file — cannot display</p>
                  <p className="text-xs opacity-50 font-mono">{formatSize(fileData.size)}</p>
                </div>
              ) : isEditing ? (
                <Textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="flex-1 h-full font-mono text-sm bg-transparent border-0 rounded-none resize-none focus-visible:ring-0 p-4 leading-relaxed"
                  spellCheck={false}
                />
              ) : (
                <ScrollArea className="flex-1">
                  <pre className="p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-muted-foreground">
                    {fileContent || <span className="italic opacity-30">Empty file</span>}
                  </pre>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        {/* ── Terminal (inline panel) ── */}
        {rightPanel === "terminal" && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Terminal header */}
            <div className="h-12 border-b border-border bg-card/40 flex items-center justify-between px-4 flex-shrink-0 gap-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="font-mono text-sm text-primary">Terminal</span>
                <span className="font-mono text-xs text-muted-foreground/60 ml-1 hidden sm:block">{currentPath}</span>
              </div>
              <div className="flex items-center gap-1">
                {termHistory.length > 0 && (
                  <>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 px-2 font-mono text-xs text-muted-foreground hover:text-foreground gap-1.5"
                      onClick={() => copyText(buildAllText(), "all")}
                    >
                      {copiedIdx === "all"
                        ? <><Check className="w-3.5 h-3.5 text-green-400" /> Copied</>
                        : <><Copy className="w-3.5 h-3.5" /> Copy all</>}
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setTermHistory([])}
                      title="Clear"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={closeRightPanel}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Output */}
            <div ref={termRef} className="flex-1 overflow-y-auto bg-black p-4 font-mono text-xs leading-relaxed">
              {termHistory.length === 0 && (
                <div className="text-muted-foreground/30 italic">Type a command below…</div>
              )}
              {termHistory.map((entry, i) => (
                <div key={i} className="mb-4 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-primary/70">$ {entry.cmd}</div>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-muted-foreground hover:text-foreground p-0.5 rounded"
                      onClick={() => copyText(buildBlockText(entry), i)}
                    >
                      {copiedIdx === i ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  {entry.stdout && <pre className="text-green-300/80 whitespace-pre-wrap break-all mt-0.5">{entry.stdout}</pre>}
                  {entry.stderr && <pre className="text-red-400/80 whitespace-pre-wrap break-all mt-0.5">{entry.stderr}</pre>}
                  {entry.code !== 0 && <div className="text-red-500/60 text-[10px] mt-0.5">exit: {entry.code}</div>}
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border flex-shrink-0 bg-black">
              <span className="font-mono text-sm text-primary/60 flex-shrink-0">$</span>
              <Input
                ref={termInputRef}
                value={termCmd}
                onChange={(e) => setTermCmd(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runCommand(); }}
                placeholder="command…"
                className="flex-1 font-mono text-sm bg-transparent border-0 focus-visible:ring-0 px-0 h-8"
              />
              <Button size="sm" className="h-8 px-3 flex-shrink-0" onClick={runCommand} disabled={!termCmd.trim() || execMut.isPending}>
                <Play className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── File list drawer (when right panel is active) ── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-80 p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
            <SheetTitle className="font-mono flex items-center gap-2 text-sm">
              <FolderOpen className="w-4 h-4 text-primary" />
              {currentPath}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 flex flex-col">
            <FileList onNavigate={() => setDrawerOpen(false)} />
          </div>
          <div className="h-7 border-t border-border bg-card/20 flex items-center justify-between px-4 flex-shrink-0">
            <span className="font-mono text-xs text-muted-foreground/50">{listing?.entries.length ?? 0} items</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 font-mono text-xs" onClick={() => { refetch(); }}>
              <RefreshCw className="w-3 h-3 mr-1" /> Refresh
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Create / Rename / Move dialog ── */}
      <Dialog open={!!dialogMode} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">
              {dialogMode === "mkdir" ? "New Folder" :
               dialogMode === "newfile" ? "New File" :
               dialogMode === "rename" ? "Rename" : "Move To"}
            </DialogTitle>
            {(dialogMode === "rename" || dialogMode === "move") && actionTarget && (
              <DialogDescription className="font-mono text-xs break-all">{actionTarget.path}</DialogDescription>
            )}
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Input
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
              placeholder={
                dialogMode === "mkdir" ? "folder-name" :
                dialogMode === "newfile" ? "filename.txt" :
                dialogMode === "rename" ? "new-name" : "/absolute/destination/path"
              }
              className="font-mono text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && dialogInput.trim()) submitDialog(); }}
            />
            {dialogMode === "move" && (
              <p className="text-xs text-muted-foreground font-mono">Enter the full absolute destination path</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancel</Button>
            <Button onClick={submitDialog} disabled={!dialogInput.trim() || isPending}>
              {isPending ? "Working…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Confirm Delete
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-sm break-all">
              Delete <span className="text-foreground font-medium">{deleteTarget?.path}</span>?
              {deleteTarget?.type === "directory" && (
                <span className="block mt-1 text-destructive text-xs">This recursively deletes all contents.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono"
              onClick={() => {
                if (deleteTarget) {
                  deleteMut.mutate({ params: { path: deleteTarget.path, recursive: deleteTarget.type === "directory" } });
                }
              }}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
