import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 px-5 py-6 text-xs text-gray-400 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
        <span>© 2026 Dartify</span>
        <Link href="/privacy" className="hover:text-white">
          Privacy Notice
        </Link>
      </div>
    </footer>
  );
}