export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] p-4 relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#C9A961] opacity-5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#C9A961] opacity-5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">{children}</div>
    </div>
  );
}
