import { notFound } from "next/navigation";
import Link from "next/link";
import { PublicHeader, Footer, PageTitle, Badge } from "../../components/ui";
import { LeadForm } from "../../components/forms";
import { pages, faqs } from "../../lib/catalogue";
import { modules } from "../../lib/modules";
import { publicPlans } from "../../lib/queries";
export const dynamic = "force-dynamic";
export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = pages[slug];
  if (
    !data &&
    ![
      "faq",
      "pricing",
      "contact",
      "request-demo",
      "free-trial",
      "about-us",
      "contact-us",
      "terms-and-conditions",
    ].includes(slug)
  )
    notFound();
  if (["about-us", "contact-us", "terms-and-conditions"].includes(slug)) {
    const { redirect } = await import("next/navigation");
    redirect(
      "/" +
        {
          "about-us": "about",
          "contact-us": "contact",
          "terms-and-conditions": "terms",
        }[slug],
    );
  }
  const title =
    data?.title ??
    {
      faq: "Everything you need to know.",
      pricing: "A plan for your next chapter.",
      contact: "Let’s start a conversation.",
      "request-demo": "See what’s taking shape.",
      "free-trial": "Start with your property.",
    }[slug] ??
    "StayPunch360";
  return (
    <>
      <PublicHeader />
      <main className="public-page">
        <PageTitle
          eyebrow={data?.eyebrow ?? "STAYPUNCH360"}
          title={title}
          description={
            data?.intro ?? "A transparent foundation for modern hospitality."
          }
        />
        {data?.planned && (
          <div className="notice">
            <Badge /> These capabilities are planned. No operational
            transactions or OTA connections are enabled.
          </div>
        )}
        {data && (
          <div className="feature-grid">
            {data.points.map((point, i) => (
              <article className="feature-card" key={point}>
                <span className="feature-number">0{i + 1} /</span>
                <h3>{point}</h3>
              </article>
            ))}
          </div>
        )}
        {slug === "features" && (
          <section className="section compact">
            <h2>The full platform roadmap</h2>
            <div className="module-grid">
              {modules.map((m) => (
                <article className="module-card" key={m.id}>
                  <div>
                    <span className="eyebrow">{m.group}</span>
                    <Badge />
                  </div>
                  <h3>{m.name}</h3>
                  <p>{m.description}</p>
                </article>
              ))}
            </div>
          </section>
        )}
        {slug === "faq" &&
          faqs.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        {slug === "pricing" && (
          <>
            <div className="pricing-grid">
              {(
                (await publicPlans()) ??
                ["Starter", "Premium", "Enterprise"].map((name) => ({
                  id: name,
                  name,
                  price_minor: null,
                  currency: "INR",
                  trial_days: null,
                  features: [],
                }))
              ).map((p) => (
                <article className="price-card" key={p.id}>
                  <h2>{p.name}</h2>
                  <strong>
                    {p.price_minor === null
                      ? "Let’s talk"
                      : new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: p.currency,
                        }).format(Number(p.price_minor) / 100)}
                  </strong>
                  <p>
                    {p.price_minor === null
                      ? "Final price to be announced"
                      : "Configured plan price · contact us for billing terms"}
                  </p>
                  {p.trial_days !== null && (
                    <p>{p.trial_days} day trial configuration</p>
                  )}
                  <ul>
                    {p.features.map((f: string) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <p className="muted small">
                    Module access is subject to technical release and
                    entitlements.
                  </p>
                  <Link className="button" href="/request-demo">
                    Discuss this plan ›
                  </Link>
                </article>
              ))}
            </div>
            <p className="notice">
              No subscription checkout or payment collection is available in
              this foundation.
            </p>
          </>
        )}
        {["contact", "request-demo", "free-trial"].includes(slug) && (
          <div className="narrow panel">
            {slug === "free-trial" ? (
              <>
                <h2>Set up your workspace</h2>
                <p>Create an account to register a property for approval.</p>
                <Link className="button" href="/register">
                  Register your property ›
                </Link>
                <h3>Have a question first?</h3>
                <LeadForm kind="trial" />
              </>
            ) : (
              <LeadForm kind={slug === "contact" ? "contact" : "demo"} />
            )}
          </div>
        )}
        {data && !["privacy-policy", "terms"].includes(slug) && (
          <div className="page-cta">
            <h2>Make room for what’s next.</h2>
            <Link href="/request-demo" className="button">
              Request a demo ›
            </Link>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
