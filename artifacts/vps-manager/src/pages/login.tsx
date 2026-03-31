import { useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError(null);
    const result = await login(key.trim());
    setLoading(false);
    if (!result.ok) setError(result.error ?? "Authentication failed");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#08090d" }}>
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% -10%, rgba(110,92,255,.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)", padding: 2 }}>
            <div className="w-full h-full rounded-2xl flex items-center justify-center"
              style={{ background: "#08090d" }}>
              <span className="text-2xl font-black brand-gradient">X</span>
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-1">
            <span className="brand-gradient">XCASPER</span>{" "}
            <span className="text-foreground">MANAGER</span>
          </h1>
          <p className="text-sm text-muted-foreground">Enter your API key to continue</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "#0f1117",
            border: "1px solid rgba(110,92,255,.22)",
            boxShadow: "0 0 60px rgba(110,92,255,.12)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-wider uppercase" style={{ color: "#0ff4c6" }}>
                API Key
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showKey ? "text" : "password"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="sk-••••••••••••••••"
                  autoFocus
                  autoComplete="current-password"
                  className="pl-9 pr-10 font-mono text-sm"
                  style={{
                    background: "#161a25",
                    borderColor: error ? "rgba(239,68,68,.6)" : "rgba(110,92,255,.28)",
                    color: "#e8e8f0",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !key.trim()}
              className="w-full h-10 font-semibold text-sm tracking-wide"
              style={{
                background: "linear-gradient(135deg,#6e5cff,#0ff4c6)",
                color: "#08090d",
                border: "none",
                opacity: loading || !key.trim() ? 0.6 : 1,
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          XCASPER MANAGER — Secure VPS control panel
        </p>
      </div>
    </div>
  );
}
