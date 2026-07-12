import type { ReactNode } from "react";
import { PaperTradingBanner } from "@/components/PaperTradingBanner";
import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <PaperTradingBanner />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
