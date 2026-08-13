import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  FileSearch,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

type View = "patient" | "dashboard" | "pipeline";

const NAV_ITEMS = [
  { href: "/", label: "Patient matching", view: "patient" as const, icon: MessageCircleMore },
  { href: "/dashboard", label: "Protocol intelligence", view: "dashboard" as const, icon: BarChart3 },
  { href: "/pipeline", label: "Trial radar", view: "pipeline" as const, icon: FileSearch },
];

export function AppShell({
  active,
  title,
  description,
  actions,
  children,
}: {
  active: View;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="ct-app-canvas">
      <div className="ct-app-shell">
        <aside className="ct-nav-rail" aria-label="Primary navigation">
          <Link href="/" className="ct-brand-mark" aria-label="ClearTrial home" title="ClearTrial">
            <Activity className="h-5 w-5" />
          </Link>

          <nav className="ct-rail-links">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`ct-rail-button ${active === item.view ? "is-active" : ""}`}
                  aria-label={item.label}
                  aria-current={active === item.view ? "page" : undefined}
                  title={item.label}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </Link>
              );
            })}
            <span className="ct-rail-button is-muted" title="Privacy controls">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </span>
          </nav>

          <div className="ct-rail-footer">
            <ThemeToggle compact />
          </div>
        </aside>

        <section className="ct-workspace">
          <header className="ct-topbar">
            <div className="ct-topbar-title">
              <div className="ct-mobile-brand" aria-hidden="true">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="ct-product-name">ClearTrial</p>
                <div className="flex min-w-0 items-baseline gap-2">
                  <h1>{title}</h1>
                  <span className="ct-topbar-description">{description}</span>
                </div>
              </div>
            </div>
            <div className="ct-topbar-actions">{actions}</div>
          </header>

          <div className="ct-workspace-content">{children}</div>
        </section>
      </div>
    </main>
  );
}
