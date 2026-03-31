import { Link } from "wouter";
import { Github, Send, HeadphonesIcon, Coffee } from "lucide-react";

const LINKS = [
  { href: "https://github.com/Casper-Tech-ke/vps-manager", label: "GitHub", icon: Github },
  { href: "https://t.me/casper_tech_ke", label: "Telegram", icon: Send },
  { href: "https://support.xcasper.space", label: "Support", icon: HeadphonesIcon },
  { href: "https://payments.xcasper.space", label: "Buy Coffee", icon: Coffee },
];

export function Footer() {
  return (
    <footer
      className="flex-shrink-0 border-t py-3 px-4"
      style={{
        borderColor: "rgba(110,92,255,.18)",
        background: "rgba(8,9,13,.6)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground text-center sm:text-left">
          © 2025{" "}
          <span className="font-semibold text-foreground/70">XCASPER MANAGER</span>{" "}
          by{" "}
          <span className="brand-gradient font-semibold">TRABY CASPER</span>
          {" · "}
          <a href="https://xcasper.space" target="_blank" rel="noopener noreferrer"
            className="hover:text-foreground transition-colors">
            xcasper.space
          </a>
          {" · "}
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms &amp; Privacy
          </Link>
        </p>

        <div className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={label}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon className="w-3.5 h-3.5" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
