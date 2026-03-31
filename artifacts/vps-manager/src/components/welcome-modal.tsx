import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Coffee, Github, Send, HeartHandshake } from "lucide-react";

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
          <DialogHeader className="mb-4">
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

          <ScrollArea className="h-64 pr-2">
            <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#0ff4c6" }}>
                  Terms of Service
                </h3>
                <p>
                  XCASPER MANAGER is a local VPS control panel that provides direct access to the
                  server filesystem and shell. By using this software you agree to use it
                  responsibly and only on systems you own or are authorised to manage.
                </p>
                <p className="mt-2">
                  The developer accepts no liability for data loss, security breaches, or
                  misconfiguration resulting from use of this tool. Always maintain backups.
                </p>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#0ff4c6" }}>
                  Privacy Policy
                </h3>
                <p>
                  XCASPER MANAGER operates entirely on your own infrastructure. No telemetry,
                  analytics, or usage data is collected or transmitted to third parties. Your files
                  and commands remain entirely on your server.
                </p>
                <p className="mt-2">
                  The API key you provide is stored only in your browser's session storage and is
                  never sent anywhere other than your own server's authentication endpoint.
                </p>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#0ff4c6" }}>
                  Disclaimer
                </h3>
                <p>
                  This software is provided "as is", without warranty of any kind. Use at your own
                  risk. The terminal and file manager have full access to the server filesystem.
                </p>
              </section>
            </div>
          </ScrollArea>

          {/* Community links */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border flex-wrap">
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
            className="w-full mt-4 font-semibold h-10"
            style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)", color: "#08090d", border: "none" }}
          >
            <HeartHandshake className="w-4 h-4 mr-2" />
            I Understand — Let's Go
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
