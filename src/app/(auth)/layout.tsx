export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // h-dvh + overflow-y-auto: the document itself is locked (see globals.css),
    // so this is the layer that scrolls on short viewports.
    <div className="h-dvh overflow-hidden bg-brand-black">
      <div className="flex min-h-full w-full items-center justify-center px-3 py-3 sm:px-4">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
