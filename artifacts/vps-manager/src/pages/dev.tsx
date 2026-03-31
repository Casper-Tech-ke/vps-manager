import { useEffect, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import {
  Github, Send, HeadphonesIcon, Coffee, Star, GitFork,
  ExternalLink, ChevronDown, ChevronUp, Terminal,
  Copy, Check, AlertTriangle, Eye, Users, BookOpen, MapPin, Link2,
  Pencil, Save, X, Plus, Trash2, Building2, Globe, Twitter, Loader2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  location: string | null;
  blog: string | null;
  html_url: string;
  followers: number;
  following: number;
  public_repos: number;
  public_gists: number;
  company: string | null;
  twitter_username: string | null;
  created_at: string;
}

interface SocialAccount {
  provider: string;
  url: string;
}

interface RepoInfo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  language: string | null;
  html_url: string;
  license: { spdx_id: string } | null;
  default_branch: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

const GH_HEADERS = { Accept: "application/vnd.github+json" };

function useCopyText(ms = 1500) {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(
      () => { setCopied(id); setTimeout(() => setCopied(null), ms); },
      () => {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        try { document.execCommand("copy"); setCopied(id); setTimeout(() => setCopied(null), ms); } catch (_) {}
        document.body.removeChild(el);
      }
    );
  }
  return { copied, copy };
}

// ── Fork walkthrough steps ─────────────────────────────────────────────────────

const STEPS: { title: string; cmd?: string; desc: string }[] = [
  {
    title: "1. Fork the repository",
    desc: `Click "Fork on GitHub" above. GitHub will create a copy of the repo under your account.`,
  },
  {
    title: "2. Clone your fork",
    cmd: "git clone https://github.com/<your-username>/vps-manager.git\ncd vps-manager",
    desc: "Replace <your-username> with your GitHub username.",
  },
  {
    title: "3. Install dependencies",
    cmd: "pnpm install",
    desc: "Requires Node 20+ and pnpm. Run from the repo root.",
  },
  {
    title: "4. Set your API key",
    cmd: "export API_KEY=your-secret-key-here",
    desc: "This is the key you'll enter on the login screen. Store it safely.",
  },
  {
    title: "5. Start the development server",
    cmd: "pnpm --filter @workspace/api-server run dev &\npnpm --filter @workspace/vps-manager run dev",
    desc: "API server on port 8080, frontend on port 5173 (or PORT env var).",
  },
  {
    title: "6. Deploy (production)",
    cmd: 'NODE_ENV=production API_KEY="your-key" pnpm run build && node artifacts/api-server/dist/index.mjs',
    desc: "Or deploy to Replit, Railway, Fly.io, or any Node-capable host.",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="h-px flex-1" style={{ background: "rgba(110,92,255,.2)" }} />
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#0ff4c6" }}>
        {children}
      </span>
      <div className="h-px flex-1" style={{ background: "rgba(110,92,255,.2)" }} />
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{ background: "#0f1117", border: "1px solid rgba(110,92,255,.18)" }}
    >
      {children}
    </div>
  );
}

function CodeBlock({ code, id, copy, copied }: { code: string; id: string; copy: (t: string, id: string) => void; copied: string | null }) {
  return (
    <div className="relative mt-2 rounded-lg overflow-hidden" style={{ background: "#08090d", border: "1px solid rgba(110,92,255,.18)" }}>
      <pre className="text-xs font-mono text-foreground/80 p-3 pr-10 overflow-x-auto leading-relaxed whitespace-pre-wrap">{code}</pre>
      <button
        onClick={() => copy(code, id)}
        className="absolute top-2 right-2 p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
        title="Copy"
      >
        {copied === id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center px-4 py-2.5 rounded-xl"
      style={{ background: "rgba(110,92,255,.08)", border: "1px solid rgba(110,92,255,.18)" }}>
      <span className="text-base font-black text-foreground">{fmtNum(Number(value))}</span>
      <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DevPage() {
  const { apiKey } = useAuth();
  const { toast } = useToast();

  const [user, setUser] = useState<GitHubUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userError, setUserError] = useState(false);
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [repoLoading, setRepoLoading] = useState(true);
  const [repoError, setRepoError] = useState(false);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const { copied, copy } = useCopyText();

  // ── Profile editor state ────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "", bio: "", location: "", blog: "", company: "", twitter_username: "",
  });
  const [socials, setSocials] = useState<SocialAccount[]>([]);
  const [socialsLoading, setSocialsLoading] = useState(false);
  const [newSocialUrl, setNewSocialUrl] = useState("");
  const [addingSocial, setAddingSocial] = useState(false);
  const [removingSocial, setRemovingSocial] = useState<string | null>(null);

  const authHeaders = apiKey ? { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };

  const fetchSocials = useCallback(async () => {
    setSocialsLoading(true);
    try {
      const r = await fetch("/api/github/social-accounts", { headers: authHeaders });
      if (r.ok) setSocials(await r.json() as SocialAccount[]);
    } catch { /* ignore */ }
    setSocialsLoading(false);
  }, [apiKey]);

  const openEditor = useCallback(() => {
    if (user) {
      setProfileForm({
        name: user.name ?? "",
        bio: user.bio ?? "",
        location: user.location ?? "",
        blog: user.blog ?? "",
        company: user.company ?? "",
        twitter_username: user.twitter_username ?? "",
      });
    }
    fetchSocials();
    setEditOpen(true);
  }, [user, fetchSocials]);

  const saveProfile = useCallback(async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/github/profile", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(profileForm),
      });
      const data = await r.json() as GitHubUser & { message?: string };
      if (!r.ok) {
        toast({ title: "Update failed", description: data.message ?? "GitHub API error", variant: "destructive" });
      } else {
        setUser(data);
        toast({ title: "Profile updated", description: "Your GitHub profile has been saved." });
        setEditOpen(false);
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
    setSaving(false);
  }, [profileForm, apiKey]);

  const addSocial = useCallback(async () => {
    if (!newSocialUrl.trim()) return;
    setAddingSocial(true);
    try {
      const r = await fetch("/api/github/social-accounts", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ account_urls: [newSocialUrl.trim()] }),
      });
      if (r.ok) {
        setNewSocialUrl("");
        await fetchSocials();
        toast({ title: "Social account added" });
      } else {
        const data = await r.json() as { message?: string };
        toast({ title: "Failed to add", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
    setAddingSocial(false);
  }, [newSocialUrl, apiKey, fetchSocials]);

  const removeSocial = useCallback(async (url: string) => {
    setRemovingSocial(url);
    try {
      const r = await fetch("/api/github/social-accounts", {
        method: "DELETE",
        headers: authHeaders,
        body: JSON.stringify({ account_urls: [url] }),
      });
      if (r.ok) {
        await fetchSocials();
        toast({ title: "Social account removed" });
      } else {
        toast({ title: "Failed to remove", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
    setRemovingSocial(null);
  }, [apiKey, fetchSocials]);

  useEffect(() => {
    fetch("https://api.github.com/users/Casper-Tech-ke", { headers: GH_HEADERS })
      .then((r) => { if (!r.ok) throw new Error("GitHub API error"); return r.json() as Promise<GitHubUser>; })
      .then((d) => { setUser(d); setUserLoading(false); })
      .catch(() => { setUserError(true); setUserLoading(false); });

    fetch("https://api.github.com/repos/Casper-Tech-ke/vps-manager", { headers: GH_HEADERS })
      .then((r) => { if (!r.ok) throw new Error("GitHub API error"); return r.json() as Promise<RepoInfo>; })
      .then((d) => { setRepo(d); setRepoLoading(false); })
      .catch(() => { setRepoError(true); setRepoLoading(false); });
  }, []);

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#08090d" }}>
      {/* Hero */}
      <div
        className="px-6 py-10"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(110,92,255,.14) 0%, transparent 70%)" }}
      >
        <div className="max-w-screen-md mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-4 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(110,92,255,.12)", color: "#0ff4c6", border: "1px solid rgba(15,244,198,.2)" }}>
            <Terminal className="w-3.5 h-3.5" /> Open Source
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-3">
            <span className="brand-gradient">Developer</span>{" "}
            <span className="text-foreground">Hub</span>
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            Meet the developer, explore the source code, fork the project, and join the community.
          </p>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-6 pb-12 space-y-10">

        {/* ── Developer bio ── */}
        <section>
          <SectionHeader>The Developer</SectionHeader>
          <Card>
            {userLoading ? (
              <div className="flex flex-col sm:flex-row gap-6">
                <Skeleton className="w-24 h-24 rounded-2xl flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-7 w-48 rounded" />
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-8 w-36 rounded-xl" />
                    <Skeleton className="h-8 w-36 rounded-xl" />
                  </div>
                </div>
              </div>
            ) : userError ? (
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black select-none flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)", color: "#08090d" }}>TC</div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl font-black tracking-tight mb-0.5">
                    <span className="brand-gradient">TRABY</span>{" "}
                    <span className="text-foreground">CASPER</span>
                  </h2>
                  <p className="text-sm text-muted-foreground mb-1">Full-stack developer · xcasper.space</p>
                  <p className="text-xs text-yellow-500/70 mt-1 mb-3 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Could not reach GitHub API — showing static info
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <a href="https://github.com/Casper-Tech-ke" target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: "rgba(110,92,255,.18)", color: "#a8a0ff", border: "1px solid rgba(110,92,255,.35)" }}>
                      <Github className="w-4 h-4" /> github.com/Casper-Tech-ke
                    </a>
                    <a href="https://t.me/casper_tech_ke" target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: "rgba(15,244,198,.08)", color: "#0ff4c6", border: "1px solid rgba(15,244,198,.2)" }}>
                      <Send className="w-4 h-4" /> t.me/casper_tech_ke
                    </a>
                  </div>
                </div>
              </div>
            ) : user ? (
              editOpen ? (
                /* ── Edit mode — inline inside the same card ── */
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <Pencil className="w-4 h-4" style={{ color: "#0ff4c6" }} />
                      <span className="text-sm font-bold text-foreground">Edit Profile</span>
                    </div>
                    <button onClick={() => setEditOpen(false)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Display Name</label>
                      <Input value={profileForm.name}
                        onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Your full name" className="h-9 text-sm"
                        style={{ background: "#08090d", borderColor: "rgba(110,92,255,.3)" }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                        <Building2 className="w-3 h-3 inline mr-1" />Company
                      </label>
                      <Input value={profileForm.company}
                        onChange={(e) => setProfileForm((f) => ({ ...f, company: e.target.value }))}
                        placeholder="@YourOrg" className="h-9 text-sm"
                        style={{ background: "#08090d", borderColor: "rgba(110,92,255,.3)" }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                        <MapPin className="w-3 h-3 inline mr-1" />Location
                      </label>
                      <Input value={profileForm.location}
                        onChange={(e) => setProfileForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="Nairobi, Kenya" className="h-9 text-sm"
                        style={{ background: "#08090d", borderColor: "rgba(110,92,255,.3)" }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                        <Globe className="w-3 h-3 inline mr-1" />Website
                      </label>
                      <Input value={profileForm.blog}
                        onChange={(e) => setProfileForm((f) => ({ ...f, blog: e.target.value }))}
                        placeholder="https://xcasper.space" className="h-9 text-sm"
                        style={{ background: "#08090d", borderColor: "rgba(110,92,255,.3)" }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                        <Twitter className="w-3 h-3 inline mr-1" />Twitter / X
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                        <Input value={profileForm.twitter_username}
                          onChange={(e) => setProfileForm((f) => ({ ...f, twitter_username: e.target.value.replace(/^@/, "") }))}
                          placeholder="caspertech" className="h-9 text-sm pl-7"
                          style={{ background: "#08090d", borderColor: "rgba(110,92,255,.3)" }} />
                      </div>
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Bio</label>
                    <textarea value={profileForm.bio}
                      onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                      placeholder="Full-stack developer · Building developer tools…"
                      rows={3} maxLength={160}
                      className="w-full rounded-lg text-sm px-3 py-2 resize-none text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                      style={{ background: "#08090d", border: "1px solid rgba(110,92,255,.3)" }} />
                    <p className="text-xs text-muted-foreground/50 mt-1 text-right">{profileForm.bio.length}/160</p>
                  </div>

                  <div className="flex gap-3 mb-6">
                    <Button onClick={saveProfile} disabled={saving}
                      className="flex items-center gap-2 h-9 px-5 text-sm font-bold"
                      style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)", color: "#08090d", border: "none" }}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {saving ? "Saving…" : "Save Profile"}
                    </Button>
                    <Button variant="ghost" onClick={() => setEditOpen(false)}
                      className="h-9 text-sm text-muted-foreground hover:text-foreground">
                      Cancel
                    </Button>
                  </div>

                  {/* Social accounts */}
                  <div className="border-t pt-5" style={{ borderColor: "rgba(110,92,255,.15)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Link2 className="w-4 h-4" style={{ color: "#0ff4c6" }} />
                      <span className="text-sm font-bold text-foreground">Social Accounts</span>
                    </div>
                    {socialsLoading ? (
                      <div className="space-y-2 mb-3">
                        {[0, 1].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
                      </div>
                    ) : socials.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {socials.map((s) => (
                          <div key={s.url} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                            style={{ background: "rgba(110,92,255,.08)", border: "1px solid rgba(110,92,255,.15)" }}>
                            <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs font-mono text-foreground/80 flex-1 truncate">{s.url}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded capitalize flex-shrink-0"
                              style={{ background: "rgba(15,244,198,.1)", color: "#0ff4c6" }}>{s.provider}</span>
                            <button onClick={() => removeSocial(s.url)} disabled={removingSocial === s.url}
                              className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
                              {removingSocial === s.url ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 mb-3">No social accounts linked yet.</p>
                    )}
                    <div className="flex gap-2">
                      <Input value={newSocialUrl} onChange={(e) => setNewSocialUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/yourname"
                        className="h-9 text-sm flex-1"
                        style={{ background: "#08090d", borderColor: "rgba(110,92,255,.3)" }}
                        onKeyDown={(e) => { if (e.key === "Enter") addSocial(); }} />
                      <Button onClick={addSocial} disabled={addingSocial || !newSocialUrl.trim()}
                        className="h-9 px-4 flex-shrink-0"
                        style={{ background: "rgba(110,92,255,.2)", color: "#a8a0ff", border: "1px solid rgba(110,92,255,.35)" }}>
                        {addingSocial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <div className="flex-shrink-0">
                    <img src={user.avatar_url} alt={user.name ?? user.login}
                      className="w-24 h-24 rounded-2xl object-cover"
                      style={{ border: "2px solid rgba(110,92,255,.3)" }} />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-2xl font-black tracking-tight mb-0.5">
                      <span className="brand-gradient">{(user.name ?? user.login).split(" ")[0]}</span>{" "}
                      <span className="text-foreground">{(user.name ?? user.login).split(" ").slice(1).join(" ") || ""}</span>
                    </h2>
                    <p className="text-sm text-muted-foreground mb-1">
                      @{user.login}
                      {user.company && <span> · {user.company}</span>}
                      {user.location && <span> · <MapPin className="w-3 h-3 inline" /> {user.location}</span>}
                    </p>
                    {user.bio && (
                      <p className="text-sm text-foreground/70 leading-relaxed mb-3">{user.bio}</p>
                    )}
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-4">
                      <StatPill label="Followers" value={user.followers} />
                      <StatPill label="Following" value={user.following} />
                      <StatPill label="Repos" value={user.public_repos} />
                      {user.public_gists > 0 && <StatPill label="Gists" value={user.public_gists} />}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      <a href={user.html_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                        style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)", color: "#08090d" }}>
                        <Users className="w-4 h-4" /> Follow
                      </a>
                      <a href={user.html_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                        style={{ background: "rgba(110,92,255,.18)", color: "#a8a0ff", border: "1px solid rgba(110,92,255,.35)" }}>
                        <Github className="w-4 h-4" /> {user.html_url.replace("https://", "")}
                      </a>
                      <a href="https://t.me/casper_tech_ke" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                        style={{ background: "rgba(15,244,198,.08)", color: "#0ff4c6", border: "1px solid rgba(15,244,198,.2)" }}>
                        <Send className="w-4 h-4" /> t.me/casper_tech_ke
                      </a>
                      {user.blog && (
                        <a href={user.blog.startsWith("http") ? user.blog : `https://${user.blog}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                          style={{ background: "rgba(15,244,198,.06)", color: "#0ff4c6", border: "1px solid rgba(15,244,198,.15)" }}>
                          <Link2 className="w-4 h-4" /> {user.blog.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                      <button onClick={openEditor}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                        style={{ background: "rgba(110,92,255,.1)", color: "#a8a0ff", border: "1px solid rgba(110,92,255,.25)" }}>
                        <Pencil className="w-4 h-4" /> Edit Profile
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : null}
          </Card>
        </section>

        {/* ── GitHub repo card ── */}
        <section>
          <SectionHeader>Source Code</SectionHeader>

          {repoLoading ? (
            <Card>
              <div className="space-y-3">
                <Skeleton className="h-6 w-48 rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-3/4 rounded" />
                <div className="flex gap-4 mt-4">
                  <Skeleton className="h-8 w-24 rounded" />
                  <Skeleton className="h-8 w-24 rounded" />
                </div>
              </div>
            </Card>
          ) : repoError ? (
            <Card>
              <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 text-yellow-500/60" />
                <p className="text-sm">Could not reach GitHub API.</p>
                <a href="https://github.com/Casper-Tech-ke/vps-manager" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-semibold hover:text-foreground transition-colors"
                  style={{ color: "#a8a0ff" }}>
                  <Github className="w-4 h-4" /> View on GitHub <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </Card>
          ) : repo ? (
            <Card>
              {/* Repo header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)" }}>
                    <Github className="w-5 h-5 text-[#08090d]" />
                  </div>
                  <div>
                    <a href={repo.html_url} target="_blank" rel="noopener noreferrer"
                      className="text-base font-bold hover:text-primary transition-colors">
                      {repo.full_name}
                    </a>
                    {repo.license && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(110,92,255,.15)", color: "#a8a0ff" }}>
                        {repo.license.spdx_id}
                      </span>
                    )}
                    {repo.language && (
                      <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(15,244,198,.1)", color: "#0ff4c6" }}>
                        {repo.language}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                {repo.description ?? "A self-hosted VPS file manager and control panel."}
              </p>

              {/* Stats row */}
              <div className="flex flex-wrap gap-4 mb-6">
                {[
                  { icon: Star, label: "Stars", value: fmtNum(repo.stargazers_count) },
                  { icon: GitFork, label: "Forks", value: fmtNum(repo.forks_count) },
                  { icon: Eye, label: "Watchers", value: fmtNum(repo.watchers_count) },
                  { icon: AlertTriangle, label: "Issues", value: fmtNum(repo.open_issues_count) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="font-semibold text-foreground">{value}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                <a href="https://github.com/Casper-Tech-ke/vps-manager/fork" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                  style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)", color: "#08090d" }}>
                  <GitFork className="w-4 h-4" /> Fork on GitHub
                </a>
                <a href={repo.html_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:text-foreground"
                  style={{ borderColor: "rgba(110,92,255,.35)", color: "#a8a0ff" }}>
                  <Github className="w-4 h-4" /> View Source <ExternalLink className="w-3 h-3" />
                </a>
                <a href={`${repo.html_url}/stargazers`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:text-foreground"
                  style={{ borderColor: "rgba(15,244,198,.2)", color: "#0ff4c6" }}>
                  <Star className="w-4 h-4" /> Star
                </a>
              </div>

              {/* Fork walkthrough */}
              <div className="mt-5 border-t pt-4" style={{ borderColor: "rgba(110,92,255,.18)" }}>
                <button onClick={() => setWalkthroughOpen((o) => !o)}
                  className="flex items-center justify-between w-full text-sm font-semibold text-foreground hover:text-primary transition-colors">
                  <span className="flex items-center gap-2">
                    <Terminal className="w-4 h-4" style={{ color: "#0ff4c6" }} />
                    How to fork &amp; self-host — step by step
                  </span>
                  {walkthroughOpen
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  }
                </button>

                {walkthroughOpen && (
                  <div className="mt-4 space-y-5">
                    {STEPS.map((step, idx) => (
                      <div key={idx}>
                        <p className="text-sm font-semibold text-foreground mb-1">{step.title}</p>
                        <p className="text-xs text-muted-foreground mb-1">{step.desc}</p>
                        {step.cmd && <CodeBlock code={step.cmd} id={`step-${idx}`} copy={copy} copied={copied} />}
                      </div>
                    ))}
                    <div className="rounded-xl p-4 text-sm"
                      style={{ background: "rgba(15,244,198,.06)", border: "1px solid rgba(15,244,198,.18)" }}>
                      <p className="font-semibold mb-1" style={{ color: "#0ff4c6" }}>Need help?</p>
                      <p className="text-muted-foreground text-xs">
                        Open an issue on GitHub or reach out on Telegram (
                        <a href="https://t.me/casper_tech_ke" target="_blank" rel="noopener noreferrer"
                          className="underline hover:text-foreground">@casper_tech_ke</a>).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ) : null}
        </section>

        {/* ── GitHub repos overview (from user profile) ── */}
        {user && (
          <section>
            <SectionHeader>GitHub Profile</SectionHeader>
            <Card>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {[
                  { icon: BookOpen, label: "Public Repos", value: user.public_repos, color: "#6e5cff" },
                  { icon: Users, label: "Followers", value: user.followers, color: "#0ff4c6" },
                  { icon: Users, label: "Following", value: user.following, color: "#6e5cff" },
                  { icon: BookOpen, label: "Public Gists", value: user.public_gists, color: "#0ff4c6" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex flex-col gap-1 p-3 rounded-xl"
                    style={{ background: "rgba(110,92,255,.06)", border: "1px solid rgba(110,92,255,.12)" }}>
                    <Icon className="w-4 h-4 mb-1" style={{ color }} />
                    <span className="text-xl font-black text-foreground">{fmtNum(value)}</span>
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <a href={`${user.html_url}?tab=repositories`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "rgba(110,92,255,.18)", color: "#a8a0ff", border: "1px solid rgba(110,92,255,.3)" }}>
                  <BookOpen className="w-4 h-4" /> All Repositories
                </a>
                <a href={`${user.html_url}?tab=followers`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "rgba(15,244,198,.08)", color: "#0ff4c6", border: "1px solid rgba(15,244,198,.18)" }}>
                  <Users className="w-4 h-4" /> Followers
                </a>
              </div>
            </Card>
          </section>
        )}

        {/* ── Support section ── */}
        <section>
          <SectionHeader>Support &amp; Community</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(110,92,255,.18)" }}>
                  <HeadphonesIcon className="w-5 h-5" style={{ color: "#6e5cff" }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Technical Support</h3>
                  <p className="text-xs text-muted-foreground">Get help with installation or usage</p>
                </div>
              </div>
              <a href="https://support.xcasper.space" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 mt-auto"
                style={{ background: "rgba(110,92,255,.2)", color: "#a8a0ff", border: "1px solid rgba(110,92,255,.35)" }}>
                <HeadphonesIcon className="w-4 h-4" /> Open Support Portal
              </a>
            </Card>

            <Card className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(15,244,198,.08)" }}>
                  <Coffee className="w-5 h-5" style={{ color: "#0ff4c6" }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Buy Me a Coffee</h3>
                  <p className="text-xs text-muted-foreground">Support XCASPER MANAGER development</p>
                </div>
              </div>
              <a href="https://payments.xcasper.space" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80 mt-auto"
                style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)", color: "#08090d" }}>
                <Coffee className="w-4 h-4" /> Buy Me a Coffee
              </a>
            </Card>

            <Card className="sm:col-span-2">
              <h3 className="text-sm font-bold text-foreground mb-3">Community</h3>
              <div className="flex flex-wrap gap-3">
                {[
                  { href: "https://github.com/Casper-Tech-ke", label: "GitHub", icon: Github, color: "#a8a0ff", bg: "rgba(110,92,255,.15)", border: "rgba(110,92,255,.3)" },
                  { href: "https://t.me/casper_tech_ke", label: "Telegram", icon: Send, color: "#0ff4c6", bg: "rgba(15,244,198,.08)", border: "rgba(15,244,198,.2)" },
                  { href: "https://support.xcasper.space", label: "Support", icon: HeadphonesIcon, color: "#a8a0ff", bg: "rgba(110,92,255,.15)", border: "rgba(110,92,255,.3)" },
                  { href: "https://xcasper.space", label: "xcasper.space", icon: ExternalLink, color: "#0ff4c6", bg: "rgba(15,244,198,.08)", border: "rgba(15,244,198,.2)" },
                ].map(({ href, label, icon: Icon, color, bg, border }) => (
                  <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ background: bg, color, border: `1px solid ${border}` }}>
                    <Icon className="w-4 h-4" /> {label}
                  </a>
                ))}
              </div>
            </Card>
          </div>
        </section>

      </div>
    </div>
  );
}
