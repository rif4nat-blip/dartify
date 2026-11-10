export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="none" stroke="#22c55e" strokeWidth="3" />
      <circle cx="16" cy="16" r="8" fill="none" stroke="#22c55e" strokeWidth="2" />
      <circle cx="16" cy="16" r="2.5" fill="#22c55e" />
    </svg>
  );
}