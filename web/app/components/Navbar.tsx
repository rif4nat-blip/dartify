"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Logo from "./Logo";

export default function Navbar() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
  }

  const links: [string, string][] = [
    ["Tournaments", "/tournaments"],
    ["Live brackets", "/bracket"],
    ["Leaderboard", "/leaderboard"],
  ];
  if (signedIn) links.unshift(["Dashboard", "/dashboard"]);
  if (signedIn) links.push(["Profile", "/profile"]);

  const linkClass = "text-sm text-gray-300 hover:text-white";
  const btnOutline =
    "rounded border border-green-500 px-4 py-2 text-sm text-green-400 hover:bg-green-500/10";
  const btnSolid =
    "rounded bg-green-500 px-4 py-2 text-sm font-medium text-black hover:bg-green-400";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0f0d]/95 backdrop-blur print:hidden">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <Logo /> Dartify
        </Link>
        <div className="flex-1" />

        <div className="hidden items-center gap-6 md:flex">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className={linkClass}>
              {label}
            </Link>
          ))}
          {signedIn ? (
            <button onClick={logout} className={btnOutline}>
              Log out
            </button>
          ) : (
            <>
              <Link href="/login" className={btnOutline}>
                Login
              </Link>
              <Link href="/register" className={btnSolid}>
                Register
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="rounded border border-white/20 px-3 py-1 text-sm md:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </nav>

      {open && (
        <div className="flex flex-col gap-1 border-t border-white/10 px-5 py-3 md:hidden">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="py-2 text-gray-200"
            >
              {label}
            </Link>
          ))}
          {signedIn ? (
            <button onClick={logout} className={btnOutline + " mt-2"}>
              Log out
            </button>
          ) : (
            <div className="mt-2 flex gap-3">
              <Link href="/login" onClick={() => setOpen(false)} className={btnOutline}>
                Login
              </Link>
              <Link href="/register" onClick={() => setOpen(false)} className={btnSolid}>
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}