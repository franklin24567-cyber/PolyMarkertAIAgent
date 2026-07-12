export function PaperTradingBanner() {
  return (
    <div className="w-full bg-gradient-to-r from-amber-600/90 to-orange-600/90 text-white text-sm font-medium px-4 py-2 flex items-center justify-center gap-2 shadow-md">
      <span>📄</span>
      <span>PAPER TRADING ONLY — No real trades are executed, no private keys are ever requested or stored.</span>
    </div>
  );
}
