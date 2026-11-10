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

const points = [
  ["15", "Champion"],
  ["10", "Runner-up"],
  ["5", "Semifinal"],
  ["3", "Quarterfinal"],
];

const card = "rounded-xl border border-white/10 bg-white/5 p-5";
const sectionTitle = "mb-5 text-2xl font-bold md:text-3xl";

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 py-12 md:py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              Run your dart tournament. Play, score, climb the board.
            </h1>
            <p className="mt-4 text-lg text-gray-300">
              Register on your phone, join events, follow live brackets and collect points.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/tournaments"
                className="rounded border border-green-500 px-5 py-3 text-green-400 hover:bg-green-500/10"
              >
                Browse tournaments
              </Link>
              <Link
                href="/register"
                className="rounded bg-green-500 px-5 py-3 font-medium text-black hover:bg-green-400"
              >
                Create account
              </Link>
            </div>
          </div>
          <div className="flex h-56 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm text-gray-500 md:h-80">
            Photo of the venue or the dartboard
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-8">
        <h2 className={sectionTitle}>How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([n, t, d]) => (
            <div key={n} className={card}>
              <div className="text-sm text-green-400">Step {n}</div>
              <div className="mt-1 text-lg font-semibold">{t}</div>
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
            <div key={t} className={card}>
              <div className="text-lg font-semibold">{t}</div>
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
            <div key={t} className={card}>
              <div className="text-4xl font-bold text-green-400">{n}</div>
              <div className="mt-1 text-sm text-gray-400">{t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-8 bg-green-500/10 px-5 py-14 text-center">
        <h2 className="text-3xl font-bold">Ready to throw?</h2>
        <Link
          href="/register"
          className="mt-5 inline-block rounded bg-green-500 px-6 py-3 font-medium text-black hover:bg-green-400"
        >
          Create your account
        </Link>
      </section>
    </div>
  );
}