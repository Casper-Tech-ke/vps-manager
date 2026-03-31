import { Link } from "wouter";
import { ArrowLeft, Shield, Eye, AlertTriangle, Scale } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#08090d" }}>
      {/* Minimal header */}
      <div className="sticky top-0 z-10 px-6 py-3 flex items-center gap-3"
        style={{ background: "rgba(8,9,13,.9)", borderBottom: "1px solid rgba(110,92,255,.15)", backdropFilter: "blur(12px)" }}>
        <Link href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center font-black text-xs"
            style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)", color: "#08090d" }}>
            X
          </div>
          <span className="text-sm font-bold">
            <span className="brand-gradient">XCASPER</span>{" "}
            <span className="text-foreground opacity-70">MANAGER</span>
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        {/* Title */}
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#0ff4c6" }}>
            Legal
          </p>
          <h1 className="text-3xl font-black text-foreground mb-2">
            Terms, Privacy &amp; Disclaimer
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: December 2025 · XCASPER MANAGER by TRABY CASPER
          </p>
        </div>

        <div className="space-y-10">
          {/* Terms of Service */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(110,92,255,.15)" }}>
                <Scale className="w-4 h-4" style={{ color: "#6e5cff" }} />
              </div>
              <h2 className="text-base font-bold text-foreground">Terms of Service</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-11">
              <p>
                XCASPER MANAGER is a self-hosted, open-source VPS control panel that provides
                direct access to the server filesystem and a shell terminal. By installing,
                deploying, or using this software, you agree to the following terms.
              </p>
              <p>
                <strong className="text-foreground">Authorised use only.</strong> You may only
                use XCASPER MANAGER on servers and systems you own or are explicitly authorised
                to manage. Accessing another party's server without permission is illegal and
                strictly prohibited.
              </p>
              <p>
                <strong className="text-foreground">No misuse.</strong> The terminal and file
                manager provide root-level access. You must not use these capabilities to harm,
                exploit, or interfere with any system, service, or individual.
              </p>
              <p>
                <strong className="text-foreground">Backups.</strong> Always maintain independent
                backups of your data. Destructive operations (delete, overwrite, move) are
                immediate and cannot be undone by XCASPER MANAGER.
              </p>
              <p>
                <strong className="text-foreground">API key security.</strong> You are responsible
                for keeping your <code className="font-mono text-xs px-1 py-0.5 rounded"
                  style={{ background: "rgba(110,92,255,.15)", color: "#a8a0ff" }}>API_KEY</code> confidential.
                Do not share it or expose it in public repositories.
              </p>
            </div>
          </section>

          <div className="h-px" style={{ background: "rgba(110,92,255,.1)" }} />

          {/* Privacy Policy */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(15,244,198,.08)" }}>
                <Eye className="w-4 h-4" style={{ color: "#0ff4c6" }} />
              </div>
              <h2 className="text-base font-bold text-foreground">Privacy Policy</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-11">
              <p>
                XCASPER MANAGER operates entirely on your own infrastructure.
                <strong className="text-foreground"> No telemetry, analytics, crash reports, or
                  usage data is collected, stored, or transmitted to any third party.</strong>
              </p>
              <p>
                <strong className="text-foreground">Session storage only.</strong> The API key
                you enter on the login screen is stored exclusively in your browser's{" "}
                <code className="font-mono text-xs px-1 py-0.5 rounded"
                  style={{ background: "rgba(110,92,255,.15)", color: "#a8a0ff" }}>sessionStorage</code>.
                It is never persisted to disk, cookies, or any external service. Closing the
                browser tab clears it.
              </p>
              <p>
                <strong className="text-foreground">Your files stay on your server.</strong> All
                file operations and terminal commands are executed locally on the host you deploy
                XCASPER MANAGER on. No file content or command output leaves your server except
                through your own network connection to the web UI.
              </p>
              <p>
                <strong className="text-foreground">Third-party requests.</strong> The Dev page
                fetches public GitHub profile and repository metadata from the GitHub public API
                (<code className="font-mono text-xs px-1 py-0.5 rounded"
                  style={{ background: "rgba(110,92,255,.15)", color: "#a8a0ff" }}>api.github.com</code>).
                This request is made from your browser and is subject to GitHub's privacy policy.
                No credentials or identifying information are sent.
              </p>
            </div>
          </section>

          <div className="h-px" style={{ background: "rgba(110,92,255,.1)" }} />

          {/* Disclaimer */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,165,0,.08)" }}>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <h2 className="text-base font-bold text-foreground">Disclaimer</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-11">
              <p>
                This software is provided <strong className="text-foreground">"as is"</strong>,
                without warranty of any kind, express or implied, including but not limited to
                warranties of merchantability, fitness for a particular purpose, and
                non-infringement.
              </p>
              <p>
                <strong className="text-foreground">
                  In no event shall TRABY CASPER or Casper-Tech-ke be liable
                </strong>{" "}
                for any claim, damages, or other liability — including data loss, security
                breaches, service interruption, or misconfiguration — arising from or in connection
                with the use of this software.
              </p>
              <p>
                Use XCASPER MANAGER at your own risk. The terminal panel and file manager
                operate with the same privileges as the user running the Node.js process. Deploy
                responsibly behind a firewall or reverse proxy with TLS.
              </p>
            </div>
          </section>

          <div className="h-px" style={{ background: "rgba(110,92,255,.1)" }} />

          {/* Security */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(110,92,255,.15)" }}>
                <Shield className="w-4 h-4" style={{ color: "#6e5cff" }} />
              </div>
              <h2 className="text-base font-bold text-foreground">Security</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-11">
              <p>
                To report a security vulnerability, please use the responsible disclosure process
                described in{" "}
                <a href="https://github.com/Casper-Tech-ke/vps-manager/blob/main/SECURITY.md"
                  target="_blank" rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                  style={{ color: "#a8a0ff" }}>
                  SECURITY.md
                </a>
                {" "}or contact{" "}
                <a href="https://support.xcasper.space" target="_blank" rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                  style={{ color: "#a8a0ff" }}>
                  support.xcasper.space
                </a>.
              </p>
            </div>
          </section>
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-8 border-t text-xs text-muted-foreground/60 text-center"
          style={{ borderColor: "rgba(110,92,255,.1)" }}>
          XCASPER MANAGER is released under the{" "}
          <a href="https://github.com/Casper-Tech-ke/vps-manager/blob/main/LICENSE"
            target="_blank" rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
            style={{ color: "#a8a0ff" }}>
            MIT License
          </a>
          {" "}· Copyright 2025 TRABY CASPER / Casper-Tech-ke
        </div>
      </div>
    </div>
  );
}
