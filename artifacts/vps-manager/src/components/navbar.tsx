import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Home, FolderOpen, Terminal, Code2,
  Github, Send, HeadphonesIcon, LogOut, Menu, X,
} from "lucide-react";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/terminal", label: "Terminal", icon: Terminal },
  { href: "/dev", label: "Dev", icon: Code2 },
];

const SOCIAL_LINKS = [
  { href: "https://github.com/Casper-Tech-ke", label: "GitHub", icon: Github },
  { href: "https://t.me/casper_tech_ke", label: "Telegram", icon: Send },
  { href: "https://support.xcasper.space", label: "Support", icon: HeadphonesIcon },
];

export function Navbar() {
  const { logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  }

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 gap-4"
        style={{
          background: "rgba(8,9,13,.88)",
          borderBottom: "1px solid rgba(110,92,255,.18)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0 mr-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm"
            style={{ background: "linear-gradient(135deg,#6e5cff,#0ff4c6)", color: "#08090d" }}
          >
            X
          </div>
          <span className="font-black text-sm tracking-tight hidden sm:block">
            <span className="brand-gradient">XCASPER</span>{" "}
            <span className="text-foreground opacity-80">MANAGER</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive(href)
                  ? "text-foreground bg-white/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </div>

        {/* Spacer for mobile */}
        <div className="flex-1 md:hidden" />

        {/* Social + Logout */}
        <div className="hidden md:flex items-center gap-1">
          {SOCIAL_LINKS.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={label}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            >
              <Icon className="w-4 h-4" />
            </a>
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="h-8 gap-1.5 text-muted-foreground hover:text-destructive text-xs"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </Button>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 pt-14 flex flex-col"
          style={{ background: "rgba(8,9,13,.96)", backdropFilter: "blur(20px)" }}
          onClick={() => setMobileOpen(false)}
        >
          <div className="p-4 space-y-1" onClick={(e) => e.stopPropagation()}>
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive(href)
                    ? "text-foreground bg-white/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </Link>
            ))}
            <div className="h-px bg-border my-3" />
            <div className="flex gap-2">
              {SOCIAL_LINKS.map(({ href, label, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={label}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground border border-border hover:text-foreground transition-colors"
                >
                  <Icon className="w-4 h-4" /> {label}
                </a>
              ))}
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all w-full mt-2"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      )}

      {/* Spacer to offset fixed navbar */}
      <div className="h-14 flex-shrink-0" />
    </>
  );
}
