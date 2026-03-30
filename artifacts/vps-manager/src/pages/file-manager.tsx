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
  HardDrive, Home, Play, ChevronDown,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

// ── Helpers ─────────────────────────────────────────────────────────────────

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
  } catch {
    return "";
  }
}

type FileType = "directory" | "file" | "symlink" | "other";

function EntryIcon({ name, type, size = 18 }: { name: string; type: FileType; size?: number }) {
  const s = { width: size, height: size, flexShrink: 0 as const };
  if (type === "directory") return <Folder style={s} className="text-amber-400 fill-amber-400/20" />;
  if (type === "symlink") return <FileIcon style={s} className="text-sky-400" />;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["db", "sqlite", "sqlite3"].includes(ext)) return <Database style={s} className="text-orange-400" />;
  if (["png", "jpg", "jpeg", "gif", "svg", "ico", "webp", "bmp"].includes(ext)) return <Image style={s} className="text-purple-400" />;
  if (["js", "ts", "tsx", "jsx", "py", "sh", "bash", "rb", "go", "rs", "c", "cpp", "h", "java", "php", "sql", "yaml", "yml", "json", "toml", "ini", "conf", "env", "xml", "html", "css", "scss", "md", "txt", "log"].includes(ext)) return <Code2 style={s} className="text-blue-400" />;
  return <FileIcon style={s} className="text-muted-foreground" />;
}

type DialogMode = "mkdir" | "newfile" | "rename" | "move" | "terminal";

// ── Component ────────────────────────────────────────────────────────────────

export default function FileManager() {
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(searchString);
  const currentPath = searchParams.get("path") || "/";

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [dialogInput, setDialogInput] = useState("");
  const [actionTarget, setActionTarget] = useState<{ path: string; type: FileType } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ path: string; type: FileType } | null>(null);

  const [termCmd, setTermCmd] = useState("");
  const [termHistory, setTermHistory] = useState<{ cmd: string; stdout: string; stderr: string; code: number }[]>([]);
  const termRef = useRef<HTMLDivElement>(null);

  const qc = useQueryClient();
  const { toast } = useToast();

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: listing, isLoading, error: listError, refetch } = useListFiles(
    { path: currentPath },
    { query: { queryKey: getListFilesQueryKey({ path: currentPath }) } }
  );

  const { data: fileData, isLoading: fileLoading } = useReadFile(
    { path: selectedFile! },
    {
      query: {
        enabled: !!selectedFile,
        queryKey: getReadFileQueryKey({ path: selectedFile! }),
      },
    }
  );

  useEffect(() => {
    if (fileData) {
      setFileContent(fileData.content);
      setIsEditing(false);
    }
  }, [fileData]);

  useEffect(() => {
    setSelectedFile(null);
    setIsEditing(false);
  }, [currentPath]);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [termHistory]);

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
        if (selectedFile) setSelectedFile(null);
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
        setSelectedFile(vars.data.path);
      },
      onError: (e: any) => toast({ title: "Failed", description: e?.error, variant: "destructive" }),
    },
  });

  const renameMut = useRenameFile({
    mutation: {
      onSuccess: () => {
        toast({ title: dialogMode === "move" ? "Moved" : "Renamed" });
        setDialogMode(null);
        setSelectedFile(null);
        qc.invalidateQueries({ queryKey: getListFilesQueryKey({ path: currentPath }) });
      },
      onError: (e: any) => toast({ title: "Failed", description: e?.error, variant: "destructive" }),
    },
  });

  const execMut = useExecCommand({
    mutation: {
      onSuccess: (result) => {
        setTermHistory((prev) => [
          ...prev,
          { cmd: termCmd, stdout: result.stdout, stderr: result.stderr, code: result.exitCode },
        ]);
        setTermCmd("");
      },
      onError: (e: any) => toast({ title: "Exec failed", description: e?.error, variant: "destructive" }),
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const goTo = (p: string) => navigate(`/?path=${encodeURIComponent(p)}`);

  const openDialog = (mode: DialogMode, item?: { path: string; type: FileType }) => {
    setDialogMode(mode);
    setActionTarget(item ?? null);
    if (mode === "rename" && item) {
      setDialogInput(item.path.split("/").pop() ?? "");
    } else if (mode === "move" && item) {
      setDialogInput(item.path);
    } else {
      setDialogInput("");
    }
  };

  const submitDialog = () => {
    if (!dialogInput.trim()) return;
    if (dialogMode === "mkdir") {
      const p = currentPath === "/" ? `/${dialogInput}` : `${currentPath}/${dialogInput}`;
      mkdirMut.mutate({ data: { path: p } });
    } else if (dialogMode === "newfile") {
      const p = currentPath === "/" ? `/${dialogInput}` : `${currentPath}/${dialogInput}`;
      newFileMut.mutate({ data: { path: p, content: "" } });
    } else if (dialogMode === "rename" && actionTarget) {
      const parent = actionTarget.path.substring(0, actionTarget.path.lastIndexOf("/")) || "";
      const newPath = (parent === "" ? "" : parent) + "/" + dialogInput;
      renameMut.mutate({ data: { oldPath: actionTarget.path, newPath } });
    } else if (dialogMode === "move" && actionTarget) {
      renameMut.mutate({ data: { oldPath: actionTarget.path, newPath: dialogInput } });
    }
  };

  const runCommand = () => {
    if (!termCmd.trim() || execMut.isPending) return;
    execMut.mutate({ data: { command: termCmd, cwd: currentPath !== "/" ? currentPath : null } });
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  const crumbs = currentPath.split("/").filter(Boolean);
  const isPending = mkdirMut.isPending || newFileMut.isPending || renameMut.isPending || writeMut.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">

      {/* Top bar */}
      <header className="flex-shrink-0 h-14 bg-card border-b border-border flex items-center gap-2 px-3">
        <div className="flex items-center gap-2 mr-1">
          <HardDrive className="w-5 h-5 text-primary" />
          <span className="font-mono font-bold text-sm text-primary hidden sm:block">FileMgr</span>
        </div>
        <div className="w-px h-5 bg-border mx-1" />

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

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {listing?.parentPath != null && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(listing.parentPath!)} title="Go up">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openDialog("terminal")}>
                <Terminal className="w-4 h-4 mr-2" /> Terminal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">

        {/* File list */}
        <div className={`flex flex-col min-h-0 border-r border-border transition-all ${selectedFile ? "hidden md:flex md:w-1/2" : "flex-1"}`}>

          {/* Column headers (desktop) */}
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-muted/20 border-b border-border font-mono text-xs text-muted-foreground font-medium flex-shrink-0 select-none">
            <div className="col-span-6">Name</div>
            <div className="col-span-3 text-right">Size</div>
            <div className="col-span-3 text-right">Modified</div>
          </div>

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-3 space-y-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : listError ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground p-6">
                <AlertTriangle className="w-10 h-10 text-destructive/60" />
                <p className="font-mono text-sm text-center">Cannot read this directory</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : (
              <div>
                {listing?.parentPath != null && (
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/40 cursor-pointer border-b border-border/30 transition-colors"
                    onClick={() => goTo(listing.parentPath!)}
                  >
                    <ArrowLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono text-sm text-muted-foreground">..</span>
                  </div>
                )}

                {listing?.entries.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-52 text-muted-foreground gap-3">
                    <Folder className="w-10 h-10 opacity-20" />
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
                        if (entry.type === "directory") goTo(entry.path);
                        else setSelectedFile(entry.path);
                      }}
                    >
                      <EntryIcon name={entry.name} type={entryType} size={20} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm truncate" title={entry.name}>{entry.name}</span>
                          {entry.type === "symlink" && (
                            <Badge variant="outline" className="text-[10px] px-1 h-4 py-0 font-mono flex-shrink-0">link</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 md:hidden">
                          <span className="text-xs text-muted-foreground font-mono">
                            {entry.type !== "directory" ? formatSize(entry.size) : ""}
                          </span>
                          <span className="text-xs text-muted-foreground/60">{formatDate(entry.modifiedAt)}</span>
                        </div>
                      </div>

                      {/* Desktop size/date */}
                      <div className="hidden md:flex items-center gap-2 flex-shrink-0 w-48 justify-end">
                        <span className="text-xs text-muted-foreground font-mono w-20 text-right">
                          {entry.type !== "directory" ? formatSize(entry.size) : ""}
                        </span>
                        <span className="text-xs text-muted-foreground/60 w-24 text-right">{formatDate(entry.modifiedAt)}</span>
                      </div>

                      {/* Context menu */}
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
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedFile(entry.path); }}>
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

          <div className="h-7 border-t border-border bg-card/20 flex items-center px-4 flex-shrink-0">
            <span className="font-mono text-xs text-muted-foreground/50">
              {listing?.entries.length ?? 0} items
            </span>
          </div>
        </div>

        {/* File viewer / editor */}
        {selectedFile && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
            <div className="h-12 border-b border-border bg-card/40 flex items-center justify-between px-4 flex-shrink-0 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" onClick={() => setSelectedFile(null)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
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
                      onClick={() => selectedFile && writeMut.mutate({ data: { path: selectedFile, content: fileContent } })}
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
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hidden md:flex" onClick={() => setSelectedFile(null)}>
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
      </div>

      {/* Create / Rename / Move dialog */}
      <Dialog open={!!dialogMode && dialogMode !== "terminal"} onOpenChange={(open) => !open && setDialogMode(null)}>
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
                dialogMode === "rename" ? "new-name" :
                "/absolute/destination/path"
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

      {/* Delete confirmation */}
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

      {/* Terminal */}
      <Dialog open={dialogMode === "terminal"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-2xl h-[70vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b border-border flex-shrink-0">
            <DialogTitle className="font-mono flex items-center gap-2 text-sm">
              <Terminal className="w-4 h-4 text-primary" /> Terminal
              <span className="text-muted-foreground font-normal text-xs ml-2">{currentPath}</span>
            </DialogTitle>
          </DialogHeader>
          <div ref={termRef} className="flex-1 overflow-y-auto bg-black p-4 font-mono text-xs leading-relaxed">
            {termHistory.length === 0 && (
              <div className="text-muted-foreground/40 italic">Type a command below…</div>
            )}
            {termHistory.map((entry, i) => (
              <div key={i} className="mb-3">
                <div className="text-primary/70">$ {entry.cmd}</div>
                {entry.stdout && <pre className="text-green-300/80 whitespace-pre-wrap break-all">{entry.stdout}</pre>}
                {entry.stderr && <pre className="text-red-400/80 whitespace-pre-wrap break-all">{entry.stderr}</pre>}
                {entry.code !== 0 && <div className="text-red-500/60 text-[10px] mt-0.5">exit: {entry.code}</div>}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border flex-shrink-0 bg-black">
            <span className="font-mono text-sm text-primary/60">$</span>
            <Input
              value={termCmd}
              onChange={(e) => setTermCmd(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runCommand(); }}
              placeholder="command…"
              className="flex-1 font-mono text-sm bg-transparent border-0 focus-visible:ring-0 px-0 h-8"
              autoFocus
            />
            <Button size="sm" className="h-8 px-3" onClick={runCommand} disabled={!termCmd.trim() || execMut.isPending}>
              <Play className="w-3.5 h-3.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
