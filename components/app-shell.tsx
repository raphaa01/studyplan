"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpenCheck, BrainCircuit, CalendarDays, ChartNoAxesCombined, Clock3, GraduationCap, Menu, Plus, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useStudy } from "./providers/study-provider";
import { useAccount } from "./providers/account-provider";

const navigation = [
  { href: "/", label: "Übersicht", icon: BarChart3 },
  { href: "/plan", label: "Lernplan", icon: CalendarDays },
  { href: "/statistics", label: "Statistiken", icon: ChartNoAxesCombined },
  { href: "/exams", label: "Prüfungen", icon: BookOpenCheck },
  { href: "/methods", label: "Lernmethoden", icon: BrainCircuit },
  { href: "/availability", label: "Lernzeiten", icon: Clock3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { preferences } = useStudy();
  const { account, hydrated: accountHydrated } = useAccount();
  const [open, setOpen] = useState(false);
  const authRoute = pathname === "/login" || pathname === "/signup";
  const setupRoute = pathname === "/onboarding";
  const focusRoute = pathname.startsWith("/learn/") || pathname.startsWith("/todo/");

  useEffect(() => {
    if (!accountHydrated || authRoute) return;
    if (!account) router.replace("/login");
    else if (!preferences.onboardingCompleted && !setupRoute) router.replace("/onboarding");
  }, [account, accountHydrated, authRoute, preferences.onboardingCompleted, router, setupRoute]);

  if (authRoute || setupRoute) return <>{children}</>;
  if (!accountHydrated || !account || !preferences.onboardingCompleted) return <div className="app-loading"><span className="brand-mark">F</span><p>Fokusplan wird geöffnet …</p></div>;
  if (focusRoute) return <main className="learning-shell">{children}</main>;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><GraduationCap size={20} /></span><span>Fokusplan</span></div>
        <button className="mobile-close" aria-label="Navigation schließen" onClick={() => setOpen(false)}><X size={20} /></button>
        <nav className="main-nav" aria-label="Hauptnavigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link key={href} href={href} className={active ? "nav-item active" : "nav-item"} onClick={() => setOpen(false)}><Icon size={18} /><span>{label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/settings" className={pathname.startsWith("/settings") ? "nav-item active" : "nav-item"}><Settings size={18} /><span>Einstellungen</span></Link>
          <Link href="/settings" className="profile"><span className="avatar">{(account.name || preferences.name).slice(0, 1).toUpperCase() || "A"}</span><span><strong>{account.name || preferences.name}</strong><small>@{account.username}</small></span></Link>
        </div>
      </aside>
      {open && <button className="sidebar-backdrop" aria-label="Navigation schließen" onClick={() => setOpen(false)} />}
      <div className="main-column">
        <header className="topbar">
          <button className="menu-button" aria-label="Navigation öffnen" onClick={() => setOpen(true)}><Menu size={21} /></button>
          <div className="topbar-spacer" />
          <Link href="/exams/new" className="button button-primary"><Plus size={17} />Prüfung</Link>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
