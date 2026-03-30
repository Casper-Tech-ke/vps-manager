import { Router } from "express";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";

const MIME_MAP: Record<string, string> = {
  // Images
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon", bmp: "image/bmp",
  tiff: "image/tiff", avif: "image/avif",
  // Video
  mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska", mov: "video/quicktime",
  avi: "video/x-msvideo", ogv: "video/ogg", m4v: "video/x-m4v", flv: "video/x-flv",
  "3gp": "video/3gpp",
  // Audio
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac",
  m4a: "audio/mp4", aac: "audio/aac", opus: "audio/opus", wma: "audio/x-ms-wma",
  // Text / Code
  txt: "text/plain", md: "text/plain", json: "application/json", xml: "application/xml",
  html: "text/html", css: "text/css", js: "text/javascript", ts: "text/typescript",
  // Fallback
  pdf: "application/pdf",
};
import { ListFilesQueryParams, ReadFileQueryParams, WriteFileBody, DeleteFileQueryParams, CreateDirectoryBody, RenameFileBody, GetRawFileQueryParams } from "@workspace/api-zod";


const router = Router();

function modeToPermString(mode: number): string {
  const types = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
  const typeChar =
    (mode & 0o170000) === 0o040000 ? "d" :
    (mode & 0o170000) === 0o120000 ? "l" : "-";
  const owner = types[(mode >> 6) & 7];
  const group = types[(mode >> 3) & 7];
  const other = types[mode & 7];
  return `${typeChar}${owner}${group}${other}`;
}

function getEntryType(mode: number): "file" | "directory" | "symlink" | "other" {
  const fmt = mode & 0o170000;
  if (fmt === 0o040000) return "directory";
  if (fmt === 0o100000) return "file";
  if (fmt === 0o120000) return "symlink";
  return "other";
}

router.get("/files/list", async (req, res) => {
  const parsed = ListFilesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const dirPath = parsed.data.path ?? "/";
  try {
    const dirEntries = await fs.readdir(dirPath, { withFileTypes: true });
    const entries = await Promise.all(
      dirEntries.map(async (dirent) => {
        const entryPath = path.join(dirPath, dirent.name);
        try {
          const stat = await fs.lstat(entryPath);
          return {
            name: dirent.name,
            path: entryPath,
            type: getEntryType(stat.mode),
            size: stat.size,
            permissions: modeToPermString(stat.mode),
            modifiedAt: stat.mtime.toISOString(),
          };
        } catch {
          return {
            name: dirent.name,
            path: entryPath,
            type: "other" as const,
            size: null,
            permissions: "----------",
            modifiedAt: new Date(0).toISOString(),
          };
        }
      })
    );

    entries.sort((a, b) => {
      if (a.type === "directory" && b.type !== "directory") return -1;
      if (a.type !== "directory" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });

    const parentPath = dirPath === "/" ? null : path.dirname(dirPath);

    res.json({ path: dirPath, parentPath, entries });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to list directory" });
  }
});

router.get("/files/read", async (req, res) => {
  const parsed = ReadFileQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const filePath = parsed.data.path;
  try {
    const stat = await fs.stat(filePath);
    const MAX_TEXT_SIZE = 5 * 1024 * 1024;

    if (stat.size > MAX_TEXT_SIZE) {
      return res.json({ path: filePath, content: "", isBinary: true, size: stat.size });
    }

    const buf = await fs.readFile(filePath);
    const sample = buf.slice(0, Math.min(8192, buf.length));
    const isBinary = sample.includes(0);

    res.json({
      path: filePath,
      content: isBinary ? "" : buf.toString("utf8"),
      isBinary,
      size: stat.size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to read file" });
  }
});

router.post("/files/write", async (req, res) => {
  const parsed = WriteFileBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const { path: filePath, content } = parsed.data;
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to write file" });
  }
});

router.delete("/files/delete", async (req, res) => {
  const parsed = DeleteFileQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const { path: filePath, recursive } = parsed.data;
  try {
    const stat = await fs.lstat(filePath);
    if (stat.isDirectory()) {
      await fs.rm(filePath, { recursive: recursive ?? false });
    } else {
      await fs.unlink(filePath);
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to delete" });
  }
});

router.post("/files/mkdir", async (req, res) => {
  const parsed = CreateDirectoryBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  try {
    await fs.mkdir(parsed.data.path, { recursive: true });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to create directory" });
  }
});

router.post("/files/rename", async (req, res) => {
  const parsed = RenameFileBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const { oldPath, newPath } = parsed.data;
  try {
    await fs.mkdir(path.dirname(newPath), { recursive: true });
    await fs.rename(oldPath, newPath);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to rename/move" });
  }
});

router.get("/files/raw", async (req, res) => {
  const parsed = GetRawFileQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const rawPath = parsed.data.path;

  // Must be an absolute path — reject relative inputs (e.g. "../../etc/passwd")
  if (!rawPath.startsWith("/")) {
    return res.status(400).json({ error: "Path must be absolute" });
  }
  // Reject any path that contains '..' segments to prevent traversal attacks
  // (e.g. "/tmp/../../etc/shadow" has two '..' segments and must be rejected)
  const segments = rawPath.split("/");
  if (segments.some((seg) => seg === "..")) {
    return res.status(400).json({ error: "Path may not contain traversal segments" });
  }

  const filePath = path.normalize(rawPath);
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return res.status(400).json({ error: "Not a file" });
    }
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = MIME_MAP[ext] ?? "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Accept-Ranges", "bytes");
    createReadStream(filePath).pipe(res);
  } catch (err: any) {
    res.status(404).json({ error: err?.message ?? "File not found" });
  }
});

export default router;
