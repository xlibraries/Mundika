export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-[#f6faf7]">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#dff0e5_0%,transparent_48%)]"
        aria-hidden
      />
      {children}
    </div>
  );
}
