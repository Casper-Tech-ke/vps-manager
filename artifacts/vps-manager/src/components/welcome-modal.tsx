import { Link } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coffee, Github, Send, HeartHandshake, ExternalLink } from "lucide-react";

export function WelcomeModal() {
  const { isAuthenticated, welcomeShown, dismissWelcome } = useAuth();

  const open = isAuthenticated && !welcomeShown;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden"
        style={{ background: "#0f1117", border: "1px solid rgba(110,92,255,.28)" }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header gradient bar */}
        <div className="h-1 w-full brand-gradient-bg" />

        <div className="p-6">
          <DialogHeader className="mb-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)" }}>
                <span className="text-lg font-black text-[#08090d]">X</span>
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Welcome to <span className="brand-gradient">XCASPER MANAGER</span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">by TRABY CASPER</p>
              </div>
            </div>
          </DialogHeader>

          {/* Summary blurb */}
          <div
            className="rounded-xl p-4 mb-5 space-y-2 text-sm text-muted-foreground leading-relaxed"
            style={{ background: "#08090d", border: "1px solid rgba(110,92,255,.15)" }}
          >
            <p>
              By continuing you confirm that you are using this software
              <strong className="text-foreground"> on systems you own or are authorised to manage</strong>,
              and that you have read and agree to the Terms of Service and Privacy Policy.
            </p>
            <p className="text-xs">
              XCASPER MANAGER operates entirely on your own infrastructure.
              No telemetry or usage data is ever collected or transmitted.
            </p>
            <Link
              href="/terms"
              onClick={dismissWelcome}
              className="inline-flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
              style={{ color: "#a8a0ff" }}
            >
              Read full Terms, Privacy &amp; Disclaimer <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Community links */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <a
              href="https://payments.xcasper.space"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)", color: "#08090d" }}
            >
              <Coffee className="w-3.5 h-3.5" /> Buy Me a Coffee
            </a>
            <a
              href="https://github.com/Casper-Tech-ke"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-3.5 h-3.5" /> GitHub
            </a>
            <a
              href="https://t.me/casper_tech_ke"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <Send className="w-3.5 h-3.5" /> Telegram
            </a>
          </div>

          <Button
            onClick={dismissWelcome}
            className="w-full font-semibold h-10"
            style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)", color: "#08090d", border: "none" }}
          >
            <HeartHandshake className="w-4 h-4 mr-2" />
            I Agree — Let's Go
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
