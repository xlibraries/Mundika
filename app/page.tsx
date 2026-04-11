import Link from "next/link";

const pricingPlans = [
  {
    name: "Starter",
    blurb: "For solo operators and first stores.",
    price: "INR 1,499",
    cadence: "per month",
    cta: "Choose Starter",
    features: [
      "Up to 1 location",
      "Daily sales and stock visibility",
      "Basic party and billing records",
    ],
  },
  {
    name: "Growth",
    blurb: "For growing teams across counters.",
    price: "INR 3,499",
    cadence: "per month",
    cta: "Choose Growth",
    features: [
      "Up to 3 locations",
      "Advanced analytics and tracking",
      "Priority support and onboarding help",
    ],
    featured: true,
  },
  {
    name: "Business",
    blurb: "For established operations at scale.",
    price: "INR 6,999",
    cadence: "per month",
    cta: "Contact for Business",
    features: [
      "Unlimited locations",
      "Role permissions and audit history",
      "Dedicated success manager",
    ],
  },
];

export default function Home() {
  return (
    <div className="marwadi-landing min-h-svh bg-[var(--mw-bg)] text-[var(--mw-ink)]">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold tracking-[0.22em] text-[var(--mw-brand)]">
              MUNDIKA
            </p>
            <p className="text-xs text-[var(--mw-muted)]">
              Built for steady Marwar commerce.
            </p>
          </div>
          <Link
            href="/login"
            className="rounded-full border border-[var(--mw-border-strong)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--mw-surface-soft)]"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-5 pb-16 pt-28 sm:px-8 sm:pt-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,var(--mw-glow)_0%,transparent_48%),radial-gradient(circle_at_86%_74%,var(--mw-glow-soft)_0%,transparent_40%)]" />
          <div className="marwadi-fade-up mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-end">
            <div className="space-y-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--mw-muted)]">
                Simple operations, desert calm
              </p>
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Root your daily business in clear numbers, not noise.
              </h1>
              <p className="max-w-xl text-base text-[var(--mw-muted)] sm:text-lg">
                A warm, focused workspace for stock, billing, and party tracking
                built for teams that move fast and decide with confidence.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="#pricing"
                  className="rounded-full bg-[var(--mw-brand)] px-5 py-2.5 text-sm font-semibold text-[var(--mw-brand-contrast)] transition hover:bg-[var(--mw-brand-strong)]"
                >
                  View pricing
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-[var(--mw-border-strong)] px-5 py-2.5 text-sm font-medium transition hover:bg-[var(--mw-surface-soft)]"
                >
                  Start with sign in
                </Link>
              </div>
            </div>

            <div className="marwadi-fade-up marwadi-delay rounded-3xl border border-[var(--mw-border)] bg-[var(--mw-surface-soft)]/80 p-6 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--mw-muted)]">
                One place for daily flow
              </p>
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-[auto_1fr] items-center gap-3 border-b border-[var(--mw-border)] pb-4">
                  <span className="h-2 w-2 rounded-full bg-[var(--mw-brand)]" />
                  <p className="text-sm text-[var(--mw-muted)]">
                    Live stock and movement visibility
                  </p>
                </div>
                <div className="grid grid-cols-[auto_1fr] items-center gap-3 border-b border-[var(--mw-border)] pb-4">
                  <span className="h-2 w-2 rounded-full bg-[var(--mw-brand)]" />
                  <p className="text-sm text-[var(--mw-muted)]">
                    Billing and party records in sync
                  </p>
                </div>
                <div className="grid grid-cols-[auto_1fr] items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-[var(--mw-brand)]" />
                  <p className="text-sm text-[var(--mw-muted)]">
                    Clean analytics for weekly decisions
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
          <div className="marwadi-fade-up grid gap-10 border-y border-[var(--mw-border)] py-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--mw-muted)]">
                Built for real counters
              </p>
              <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">
                Less setup, clearer routine, faster decisions.
              </h2>
            </div>
            <p className="max-w-xl text-[var(--mw-muted)]">
              Every section is tuned for operational teams: quick entry, visible
              status, and reports that stay practical. No clutter, no dashboard
              theater.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="marwadi-fade-up marwadi-delay grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--mw-muted)]">
                Marwar inspired
              </p>
              <h3 className="text-2xl font-semibold sm:text-3xl">
                Warm tones, quiet hierarchy, and focus where work happens.
              </h3>
              <p className="max-w-xl text-[var(--mw-muted)]">
                The interface stays understated like sandstone surfaces in late
                light: calm, practical, and crafted for long workdays.
              </p>
            </div>
            <div className="rounded-3xl border border-[var(--mw-border)] bg-[var(--mw-surface)] p-6">
              <p className="text-sm leading-relaxed text-[var(--mw-muted)]">
                "From stock checks to closing reports, our team should feel one
                steady rhythm. Mundika keeps every number readable and every
                action close."
              </p>
              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--mw-brand-strong)]">
                Sample operator note
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
          <div className="marwadi-fade-up">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--mw-muted)]">
              Pricing
            </p>
            <h4 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Start simple, scale with confidence.
            </h4>
            <p className="mt-4 max-w-2xl text-[var(--mw-muted)]">
              Placeholder plan structure is ready. Share final plan names and
              feature bullets anytime, and we will replace this content quickly.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`marwadi-plan rounded-3xl border p-6 ${
                  plan.featured
                    ? "border-[var(--mw-border-strong)] bg-[var(--mw-surface-soft)]"
                    : "border-[var(--mw-border)] bg-[var(--mw-surface)]"
                }`}
              >
                <p className="text-sm font-medium text-[var(--mw-brand-strong)]">
                  {plan.name}
                </p>
                <p className="mt-2 text-sm text-[var(--mw-muted)]">{plan.blurb}</p>
                <p className="mt-6 text-3xl font-semibold tracking-tight">
                  {plan.price}
                </p>
                <p className="mt-1 text-sm text-[var(--mw-muted)]">{plan.cadence}</p>
                <ul className="mt-6 space-y-3 text-sm text-[var(--mw-muted)]">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--mw-brand)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`mt-7 inline-flex rounded-full px-4 py-2 text-sm font-medium transition ${
                    plan.featured
                      ? "bg-[var(--mw-brand)] text-[var(--mw-brand-contrast)] hover:bg-[var(--mw-brand-strong)]"
                      : "border border-[var(--mw-border-strong)] hover:bg-[var(--mw-surface-soft)]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8 sm:pb-20">
          <div className="marwadi-fade-up rounded-3xl border border-[var(--mw-border)] bg-[var(--mw-surface-soft)] px-6 py-10 text-center sm:px-10">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--mw-muted)]">
              Ready to begin
            </p>
            <h5 className="mt-3 text-2xl font-semibold sm:text-3xl">
              Bring your daily operations into one clear rhythm.
            </h5>
            <div className="mt-6 flex justify-center">
              <Link
                href="/login"
                className="rounded-full bg-[var(--mw-brand)] px-5 py-2.5 text-sm font-semibold text-[var(--mw-brand-contrast)] transition hover:bg-[var(--mw-brand-strong)]"
              >
                Sign in to continue
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
