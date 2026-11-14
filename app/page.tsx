import Link from "next/link";
import { PublicHeader, Footer, Badge } from "../components/ui";
import { Preview } from "../components/preview";
import { LeadForm } from "../components/forms";
import { faqs } from "../lib/catalogue";
import { modules } from "../lib/modules";
import { publicPlans } from "../lib/queries";
export const dynamic = "force-dynamic";
export default async function Home() {
  const plans = await publicPlans();
  return (
    <>
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="hero-orbit" />
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="green-dot" /> A NEW CHAPTER IN HOSPITALITY
            </p>
            <h1>
              Less complexity.
              <br />
              More <em>exceptional stays.</em>
            </h1>
            <p className="hero-description">
              Bring your property, people and possibilities together.
              <br />
              One thoughtfully connected platform for modern hospitality.
            </p>
            <div className="hero-actions">
              <Link href="/request-demo" className="button">
                Discover StayPunch360 <span>›</span>
              </Link>
              <Link href="#platform" className="text-link">
                Explore the platform ↓
              </Link>
            </div>
            <p className="hero-note">
              Built for hotels, resorts & homestays <span>·</span> Foundation
              release
            </p>
          </div>
          <div className="hero-caption">
            <span>HOSPITALITY, IN HARMONY</span>
            <p>
              Designed around the people
              <br />
              who make every stay matter.
            </p>
          </div>
        </section>
        <section className="preview-section" id="platform">
          <Preview />
          <div className="audience">
            <span>MADE FOR YOUR KIND OF HOSPITALITY</span>
            <b>Independent hotels</b>
            <b>Boutique resorts</b>
            <b>Thoughtful homestays</b>
            <b>Growing groups</b>
          </div>
        </section>
        <section className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A STRONGER FOUNDATION</p>
              <h2>
                One clear workspace.
                <br />
                Room for everything ahead.
              </h2>
            </div>
            <p>
              Start with the essentials. Grow into a connected ecosystem, with
              every release clearly marked.
            </p>
          </div>
          <div className="feature-grid">
            {[
              [
                "01",
                "Your property, organized",
                "Bring property profiles, contact details, amenities and room types into one workspace.",
                "Property foundation",
              ],
              [
                "02",
                "Your people, connected",
                "Create an account, invite your team and give each role the access it needs.",
                "Team foundation",
              ],
              [
                "03",
                "Your future, in view",
                "Explore a complete roadmap for reservations, distribution, operations and growth.",
                "Modules Coming Soon",
              ],
            ].map(([n, t, d, b]) => (
              <article className="feature-card" key={n}>
                <span className="feature-number">{n} /</span>
                <h3>{t}</h3>
                <p>{d}</p>
                <Badge>{b}</Badge>
              </article>
            ))}
          </div>
        </section>
        <section className="dark-section">
          <div>
            <p className="eyebrow">BUILT AROUND YOUR DAY</p>
            <h2>
              From the first hello
              <br />
              to the next great stay.
            </h2>
            <p>
              A foundation for smoother work today.
              <br />
              An ambitious roadmap for tomorrow.
            </p>
            <Link className="button light-button" href="/features">
              Explore all {modules.length} planned modules ›
            </Link>
          </div>
          <div className="roadmap-list">
            {[
              [
                "Reservations & front desk",
                "Booking Engine · PMS · Central Reservations",
              ],
              [
                "Distribution & revenue",
                "Channel Manager · Rate Management · Dynamic Pricing",
              ],
              [
                "Operations & guest experience",
                "Housekeeping · Guest CRM · Restaurant POS",
              ],
              [
                "Growth & intelligence",
                "WhatsApp · Loyalty · Reports & Analytics",
              ],
            ].map(([t, d]) => (
              <div key={t}>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
                <Badge />
              </div>
            ))}
          </div>
        </section>
        <section className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PLANS THAT GROW WITH YOU</p>
              <h2>
                Your next chapter,
                <br />
                at your own pace.
              </h2>
            </div>
            <p>
              Three configurable plans. Final pricing is being prepared. No paid
              checkout is enabled.
            </p>
          </div>
          <div className="pricing-grid">
            {["Starter", "Premium", "Enterprise"].map((p, i) => (
              <article
                className={i === 1 ? "price-card featured" : "price-card"}
                key={p}
              >
                {i === 1 && <Badge tone="teal">ROOM TO GROW</Badge>}
                <h3>{p}</h3>
                <p>
                  {
                    [
                      "For a focused beginning",
                      "For growing hospitality teams",
                      "For larger property groups",
                    ][i]
                  }
                </p>
                <strong>
                  {plans?.find((plan) => plan.id === p.toLowerCase())
                    ?.price_minor != null
                    ? new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: plans.find(
                          (plan) => plan.id === p.toLowerCase(),
                        )!.currency,
                      }).format(
                        Number(
                          plans.find((plan) => plan.id === p.toLowerCase())!
                            .price_minor,
                        ) / 100,
                      )
                    : "Let’s talk"}
                </strong>
                <p className="small">See plan details for configured pricing</p>
                <Link href="/pricing" className="button outline">
                  Explore this plan ›
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section className="section faq-section">
          <div>
            <p className="eyebrow">A LITTLE MORE CLARITY</p>
            <h2>
              Good questions.
              <br />
              Honest answers.
            </h2>
            <Link href="/faq" className="text-link">
              View all FAQs ›
            </Link>
          </div>
          <div>
            {faqs.slice(0, 4).map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="demo-section" id="demo">
          <div>
            <p className="eyebrow">LET’S BUILD YOUR NEXT CHAPTER</p>
            <h2>
              A better-run property
              <br />
              starts with a conversation.
            </h2>
            <p>
              Tell us about your property. We’ll help you explore
              <br />
              what StayPunch360 is becoming.
            </p>
            <div className="demo-mark">
              stay well.
              <br />
              <em>work better.</em>
            </div>
          </div>
          <div className="panel">
            <h3>Meet your new foundation</h3>
            <LeadForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
