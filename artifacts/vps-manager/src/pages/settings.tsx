import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Footer } from "@/components/footer";
import { KeyRound, Eye, EyeOff, LogOut, ShieldCheck, Save, RefreshCw } from "lucide-react";

export default function SettingsPage() {
  const { apiKey, logout } = useAuth();
  const { toast } = useToast();
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const [maskedKey, setMaskedKey]       = useState<string>("••••••••••");
  const [currentKey, setCurrentKey]     = useState("");
  const [newKey, setNewKey]             = useState("");
  const [confirmKey, setConfirmKey]     = useState("");
  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [saving, setSaving]             = useState(false);
  const [loadingMask, setLoadingMask]   = useState(true);

  useEffect(() => {
    fetch("/api/settings", { headers })
      .then((r) => r.json())
      .then((d) => { setMaskedKey(d.maskedKey ?? "••••••••••"); })
      .catch(() => {})
      .finally(() => setLoadingMask(false));
  }, []);

  async function handleChangeKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKey || !currentKey) return;
    if (newKey !== confirmKey) {
      toast({ title: "Keys don't match", description: "New key and confirmation must match.", variant: "destructive" });
      return;
    }
    if (newKey.length < 8) {
      toast({ title: "Too short", description: "Key must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/key", {
        method: "POST",
        headers,
        body: JSON.stringify({ currentKey, newKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not update key.", variant: "destructive" });
        return;
      }
      setMaskedKey(data.maskedKey ?? "••••••••••");
      setCurrentKey("");
      setNewKey("");
      setConfirmKey("");
      toast({
        title: "Key updated",
        description: "Your API key has been changed. You will be logged out now.",
      });
      setTimeout(() => logout(), 1500);
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black tracking-tight brand-gradient">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your XCASPER MANAGER configuration</p>
        </div>

        {/* Current key card */}
        <div
          className="rounded-2xl border p-5 space-y-3"
          style={{ background: "rgba(110,92,255,.06)", borderColor: "rgba(110,92,255,.2)" }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#6e5cff]" />
            <span className="text-sm font-semibold">Active API Key</span>
          </div>
          <div className="flex items-center gap-3">
            <code
              className="flex-1 px-4 py-2.5 rounded-xl font-mono text-sm tracking-widest"
              style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "#0ff4c6" }}
            >
              {loadingMask ? <RefreshCw className="w-3.5 h-3.5 animate-spin inline" /> : maskedKey}
            </code>
          </div>
          <p className="text-xs text-muted-foreground">
            Key is masked for security. Use the form below to rotate it.
          </p>
        </div>

        {/* Change key form */}
        <form
          onSubmit={handleChangeKey}
          className="rounded-2xl border p-5 space-y-4"
          style={{ background: "rgba(255,255,255,.02)", borderColor: "rgba(255,255,255,.08)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4 text-[#0ff4c6]" />
            <span className="text-sm font-semibold">Rotate API Key</span>
          </div>

          {/* Current key */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Current Key</label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                placeholder="Enter your current API key"
                value={currentKey}
                onChange={(e) => setCurrentKey(e.target.value)}
                className="pr-10 font-mono text-sm"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New key */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">New Key</label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                placeholder="Min 8 characters"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="pr-10 font-mono text-sm"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newKey && newKey.length < 8 && (
              <p className="text-xs text-destructive">At least 8 characters required</p>
            )}
          </div>

          {/* Confirm key */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Confirm New Key</label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter new key"
                value={confirmKey}
                onChange={(e) => setConfirmKey(e.target.value)}
                className="pr-10 font-mono text-sm"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmKey && newKey !== confirmKey && (
              <p className="text-xs text-destructive">Keys do not match</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={saving || !currentKey || !newKey || !confirmKey || newKey !== confirmKey || newKey.length < 8}
            className="w-full gap-2 font-semibold"
            style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)", color: "#08090d" }}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save New Key"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            After saving, you will be logged out automatically so you can log in with the new key.
          </p>
        </form>

        {/* Danger zone */}
        <div
          className="rounded-2xl border p-5 space-y-3"
          style={{ background: "rgba(255,60,60,.04)", borderColor: "rgba(255,60,60,.2)" }}
        >
          <p className="text-sm font-semibold text-destructive">Session</p>
          <p className="text-xs text-muted-foreground">
            Logging out clears your session. Your API key stays unchanged.
          </p>
          <Button
            variant="outline"
            onClick={logout}
            className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
