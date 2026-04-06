"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppFooter, SidebarLink } from "@/components/ui";
import { navItems } from "@/lib/seo-data";
import { logoutAction } from "@/lib/server/actions";

const instructionLinks = [
  { href: "/instructions/gsc", label: "Get GSC API" },
  { href: "/instructions/sheets", label: "Enable Sheets" },
  { href: "/instructions/serper", label: "Serper.dev API" },
  { href: "/instructions/dataforseo", label: "DataForSEO API" },
  { href: "/instructions/scrapingrobot", label: "ScrapingRobot API" },
];

export function WorkspaceShell({
  user,
  children,
}: {
  user: { username: string; role: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <div className="top-nav">
        <div className="top-nav__brand">SEO Rank Tracker</div>
        <div className="top-nav__right">
          <div className={`top-nav__menu ${instructionsOpen ? "is-open" : ""}`}>
            <button className="top-nav__menu-btn" type="button" onClick={() => setInstructionsOpen((value) => !value)}>
              <span className="top-nav__button-label">Instructions</span>
              <span className="top-nav__chevron" aria-hidden="true">▾</span>
            </button>
            <div className="top-nav__dropdown">
              {instructionLinks.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <a className="top-nav__deploy" href="https://vercel.com/" target="_blank" rel="noreferrer">
            Deploy
          </a>
          <div className={`top-nav__user-menu ${userMenuOpen ? "is-open" : ""}`}>
            <button className="top-nav__user-btn" type="button" onClick={() => setUserMenuOpen((value) => !value)}>
              <span className="top-nav__button-label">{user.username}</span>
              <span className="top-nav__chevron" aria-hidden="true">▾</span>
            </button>
            <div className="top-nav__dropdown">
              <Link href="/settings">Edit Profile</Link>
              <form action={logoutAction}>
                <button type="submit">Logout</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="shell-grid" data-collapsed={collapsed}>
        <aside className="shell-sidebar">
          <nav>
            {navItems.map((item) => (
              <div
                key={item.href}
                onClick={() => {
                  setInstructionsOpen(false);
                  setUserMenuOpen(false);
                }}
              >
                <SidebarLink href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} />
              </div>
            ))}
          </nav>
          <button className="sidebar-toggle sidebar-toggle--inset" type="button" onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? ">>" : "<<"}
          </button>
        </aside>

        <main className="shell-main">
          <div className="shell-main-inner">
            <div id="top" />
            {children}
            <AppFooter />
          </div>
        </main>
      </div>

      <a href="#top" className="scroll-top-button" aria-label="Scroll to top">
        ↑
      </a>
    </div>
  );
}
