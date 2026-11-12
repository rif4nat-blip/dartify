import Link from "next/link";

const steps = [
  ["1", "Create account", "Register on your phone in a minute."],
  ["2", "Join an event", "Pick a tournament and pay online or at the venue."],
  ["3", "Admin draws teams", "Teams are scrambled fairly before the first match."],
  ["4", "Play and climb", "Scores are reported at the table. Points go on the leaderboard."],
];

const events = [
  ["Open", "Players are scrambled at random into teams."],
  ["Classified", "Class A and Class B players are paired, then scrambled."],
  ["Fixed teams", "Register with your partner as a ready-made team."],
];

const formats = [
  ["Single elimination", "Lose once and you are out. Fast, simple and decided in one run."],
  ["Double elimination", "Lose once and you drop to the losers bracket. You need to lose twice to be out."],
];

const points = [
  ["15", "Champion"],
  ["10", "Runner-up"],
  ["5", "Semifinal or 3rd and 4th"],
  ["3", "Quarterfinal or top 8"],
];

const sectionTitle = "mb-5 text-2xl font-bold tracking-tight md:text-3xl";

function Dartboard() {
  const spokes = Array.from({ length: 20 }, (_, i) => (i * 18 + 9) * (Math.PI / 180));
  return (
    <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-sm" role="img" aria-label="Dartboard">
      <circle cx="100" cy="100" r="96" fill="#111916" stroke="#16a34a" strokeWidth="2" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="#16a34a" strokeOpacity="0.5" strokeWidth="8" />
      <circle cx="100" cy="100" r="52" fill="none" stroke="#16a34a" strokeOpacity="0.3" strokeWidth="8" />
      <circle cx="100" cy="100" r="64" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1" />
      <circle cx="100" cy="100" r="36" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1" />
      {spokes.map((a, i) => (
        <line
          key={i}
          x1={100 + Math.cos(a) * 18}
          y1={100 + Math.sin(a) * 18}
          x2={100 + Math.cos(a) * 88}
          y2={100 + Math.sin(a) * 88}
          stroke="#ffffff"
          strokeOpacity="0.1"
        />
      ))}
      <circle cx="100" cy="100" r="16" fill="#16a34a" fillOpacity="0.35" stroke="#16a34a" />
      <circle cx="100" cy="100" r="6" fill="#16a34a" />
    </svg>
  );
}

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 py-12 md:py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="mb-3 inline-block rounded-full border border-green-600 bg-green-600/10 px-3 py-1 text-xs font-medium text-green-400">
              Dart tournament system
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Run your dart tournament. Play, score, climb the board.
            </h1>
            <p className="mt-4 text-lg text-gray-300">
              Register on your phone, join events, follow live brackets and collect points.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/register" className="btn">
                Create account
              </Link>
              <Link href="/tournaments" className="btn-ghost">
                Browse tournaments
              </Link>
            </div>
          </div>
          <div className="card flex items-center justify-center py-8">
            <Dartboard />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-8">
        <h2 className={sectionTitle}>How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([n, t, d]) => (
            <div key={n} className="card">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-sm font-semibold text-white">
                {n}
              </span>
              <div className="mt-3 text-lg font-semibold">{t}</div>
              <p className="mt-1 text-sm text-gray-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Event types */}
      <section className="mx-auto max-w-6xl px-5 py-8">
        <h2 className={sectionTitle}>Event types</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {events.map(([t, d]) => (
            <div key={t} className="card">
              <div className="text-lg font-semibold">{t}</div>
              <p className="mt-1 text-sm text-gray-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Formats */}
      <section className="mx-auto max-w-6xl px-5 py-8">
        <h2 className={sectionTitle}>Bracket formats</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {formats.map(([t, d]) => (
            <div key={t} className="card">
              <div className="text-lg font-semibold text-green-400">{t}</div>
              <p className="mt-1 text-sm text-gray-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Points */}
      <section className="mx-auto max-w-6xl px-5 py-8">
        <h2 className={sectionTitle}>Points per placement</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {points.map(([n, t]) => (
            <div key={t} className="card">
              <div className="text-4xl font-bold text-green-400">{n}</div>
              <div className="mt-1 text-sm text-gray-400">{t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-5 mb-10 mt-8 rounded-xl border border-green-600/40 bg-green-500/10 px-5 py-14 text-center md:mx-auto md:max-w-6xl">
        <h2 className="text-3xl font-bold tracking-tight">Ready to throw?</h2>
        <p className="mt-2 text-gray-300">Create your account and join the next tournament.</p>
        <Link href="/register" className="btn mt-6">
          Create your account
        </Link>
      </section>
    </div>
  );
}
