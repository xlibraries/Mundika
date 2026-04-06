export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-[#f8f9fa]">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#e8f0fe_0%,transparent_45%)]"
        aria-hidden
      />
      {children}
    </div>
  );
}
