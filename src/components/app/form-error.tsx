export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-[var(--radius-md)] border border-bad/20 bg-bad-soft px-3 py-2.5 text-[13px] text-bad" role="alert">
      {message}
    </div>
  );
}
