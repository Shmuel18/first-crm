export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // h-dvh + overflow-y-auto: the document itself is locked (see globals.css),
    // so this is the layer that scrolls on short viewports.
    <div className="h-dvh overflow-x-hidden overflow-y-auto scrollbar-thin bg-brand-black">
      <div className="min-h-full w-full flex items-center justify-center px-4 py-6 sm:py-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
