import Link from "next/link";
import { loginUrlForPlan, PUBLIC_PRICING_PLANS } from "@/lib/pricing/plans";

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
              Chhoti dukan ke liye seedha khatta — udhaar, stock, bill. GST /
              pakka khaata abhi scope mein nahi.
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
                Tier-2 / tier-3 vyapar
              </p>
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Party ka udhaar-jama, roz ka stock, seedha bill — phone par.
              </h1>
              <p className="max-w-xl text-base text-[var(--mw-muted)] sm:text-lg">
                Form kam, kaam zyada: jo dukaandar roz use karte hain, wahi
                pehle. Neeche plans aur services dekh sakte ho.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="#pricing"
                  className="rounded-full bg-[var(--mw-brand)] px-5 py-2.5 text-sm font-semibold text-[var(--mw-brand-contrast)] transition hover:bg-[var(--mw-brand-strong)]"
                >
                  Services aur pricing
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-[var(--mw-border-strong)] px-5 py-2.5 text-sm font-medium transition hover:bg-[var(--mw-surface-soft)]"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="marwadi-fade-up marwadi-delay rounded-3xl border border-[var(--mw-border)] bg-[var(--mw-surface-soft)]/80 p-6 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--mw-muted)]">
                Core services
              </p>
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-[auto_1fr] items-center gap-3 border-b border-[var(--mw-border)] pb-4">
                  <span className="h-2 w-2 rounded-full bg-[var(--mw-brand)]" />
                  <p className="text-sm text-[var(--mw-muted)]">
                    Stock in / out — seedha entry
                  </p>
                </div>
                <div className="grid grid-cols-[auto_1fr] items-center gap-3 border-b border-[var(--mw-border)] pb-4">
                  <span className="h-2 w-2 rounded-full bg-[var(--mw-brand)]" />
                  <p className="text-sm text-[var(--mw-muted)]">
                    Bill / chit aur party khata ek jagah
                  </p>
                </div>
                <div className="grid grid-cols-[auto_1fr] items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-[var(--mw-brand)]" />
                  <p className="text-sm text-[var(--mw-muted)]">
                    Hafta bhar ka hisaab — seedha samajh
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
                What you get
              </p>
              <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">
                Jaldi entry, seedha jawab — bina heavy accounting ke.
              </h2>
            </div>
            <p className="max-w-xl text-[var(--mw-muted)]">
              GST return ya double-entry books yahan nahi; sirf roz ke vyapar
              ke liye khatta, stock aur bill.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="marwadi-fade-up marwadi-delay grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--mw-muted)]">
                Working style
              </p>
              <h3 className="text-2xl font-semibold sm:text-3xl">
                Visual tone rooted hai, workflow fully practical hai.
              </h3>
              <p className="max-w-xl text-[var(--mw-muted)]">
                Interface ko calm aur readable rakha gaya hai taaki din bhar
                kaam karte waqt speed aur clarity dono bani rahe.
              </p>
            </div>
            <div className="rounded-3xl border border-[var(--mw-border)] bg-[var(--mw-surface)] p-6">
              <p className="text-sm leading-relaxed text-[var(--mw-muted)]">
                &ldquo;Subah se shaam tak hume sirf saaf hisaab chahiye hota hai.
                Mundika mein stock, billing aur udhaar-jama ek hi flow mein
                milta hai, isliye team ko confusion nahi hota.&rdquo;
              </p>
              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--mw-brand-strong)]">
                Vyapari note
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
              Plans by team size and service depth.
            </h4>
            <p className="mt-4 max-w-2xl text-[var(--mw-muted)]">
              Free plan se start karein, Starter par 3 accounts tak scale karein,
              aur Business plan ke liye seedha contact karein.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PUBLIC_PRICING_PLANS.map((plan) => (
              <article
                key={plan.id}
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
                  {plan.priceLabel}
                </p>
                <p className="mt-1 text-sm text-[var(--mw-muted)]">{plan.cadenceLabel}</p>
                <ul className="mt-6 space-y-3 text-sm text-[var(--mw-muted)]">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--mw-brand)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={loginUrlForPlan(plan.id)}
                  className={`mt-7 inline-flex rounded-full px-4 py-2 text-sm font-medium transition ${
                    plan.featured
                      ? "bg-[var(--mw-brand)] text-[var(--mw-brand-contrast)] hover:bg-[var(--mw-brand-strong)]"
                      : "border border-[var(--mw-border-strong)] hover:bg-[var(--mw-surface-soft)]"
                  }`}
                >
                  {plan.ctaLabel}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8 sm:pb-20">
          <div className="marwadi-fade-up rounded-3xl border border-[var(--mw-border)] bg-[var(--mw-surface-soft)] px-6 py-10 text-center sm:px-10">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--mw-muted)]">
              Next step
            </p>
            <h5 className="mt-3 text-2xl font-semibold sm:text-3xl">
              Agar aap already user ho, seedha sign in karein.
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
