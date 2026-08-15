export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-lg font-semibold">Bill Agent</div>
          <p className="mt-1 text-sm text-[var(--muted)]">Shared household budgeting</p>
        </div>
        {children}
      </div>
    </div>
  );
}
