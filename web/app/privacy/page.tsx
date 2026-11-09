import Link from "next/link";

const ORGANIZER = "Dartify tournament organizer";
const CONTACT = "your-contact-email@example.com";

export const metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Privacy notice</h1>
        <Link href="/register" className="underline">Back</Link>
      </div>
      <p className="text-sm text-gray-400">Last updated: November 2026</p>

      <section>
        <h2 className="text-lg font-semibold">Who we are</h2>
        <p>
          Dartify is run by {ORGANIZER}. We handle your personal information in line with the
          Data Privacy Act of 2012 (Republic Act No. 10173).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">What we collect</h2>
        <ul className="list-disc pl-5">
          <li>Your full name, phone number and email address when you register.</li>
          <li>The tournaments and events you join, your team and partner names.</li>
          <li>Your payment method and the payment reference number you type. We never see or store card or e-wallet details.</li>
          <li>Your match results and points.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Why we collect it</h2>
        <ul className="list-disc pl-5">
          <li>To register you, make the draw and schedule your matches.</li>
          <li>To confirm payments and contact you about the event.</li>
          <li>To publish brackets, results and the leaderboard.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Who can see it</h2>
        <ul className="list-disc pl-5">
          <li>Everyone can see your name in brackets, results and the leaderboard.</li>
          <li>Only you, your teammates and the organizers can see your registration and payment status.</li>
          <li>Your phone number and email are visible to the organizers only.</li>
          <li>Your data is stored with our service providers, Supabase (database) and Vercel (website hosting). We do not sell it.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">How long we keep it</h2>
        <p>
          We keep your account and tournament records while your account exists and as long as they
          are needed for results and rankings. You can ask us to delete your account at any time.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Your rights</h2>
        <p>
          You may ask to see your data, correct it, or have it deleted, and you may withdraw your
          consent. Contact us at {CONTACT}.
        </p>
      </section>
    </main>
  );
}