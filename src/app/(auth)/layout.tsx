export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // h-dvh + overflow-y-auto: the document itself is locked (see globals.css),
    // so this is the layer that scrolls on short viewports.
    <div className="h-dvh overflow-y-auto scrollbar-thin flex items-center justify-center bg-brand-black p-4 relative">
      {/* Decorative gradient orbs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-brand-gold opacity-5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-brand-gold opacity-5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">{children}</div>
    </div>
  );
}
