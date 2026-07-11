"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Radio,
  Wallet,
  BookOpen,
  LineChart,
  Settings,
  FileText,
} from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/wallets", label: "Wallet Rankings", icon: Trophy },
  { href: "/signals", label: "Trade Signals", icon: Radio },
  { href: "/paper-trades", label: "Paper Trades", icon: Wallet },
  { href: "/decisions", label: "Decision Journal", icon: BookOpen },
  { href: "/performance", label: "Performance", icon: LineChart },
  { href: "/rules", label: "Rules", icon: Settings },
  { href: "/reports", label: "Reports", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 bg-gray-900 border-r border-gray-800 min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">
          PolyMarket AI Agent
        </div>
        <div className="text-xs text-gray-500 mt-1">Hermes-powered copy trading</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-gradient-to-r from-emerald-500/20 to-sky-500/20 text-white border border-emerald-500/30"
                  : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
        v1 · Paper trading only
      </div>
    </aside>
  );
}
