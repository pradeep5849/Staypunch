import { AccountSecurity } from "../../../components/account-security";
import { redirect, notFound } from "next/navigation";
import { actor } from "../../../lib/security";
import { transaction } from "../../../lib/db";
import { Workspace } from "../../../components/workspace";
import { PageTitle, Panel, Empty, Badge } from "../../../components/ui";
import { Form, Field, Select, Textarea } from "../../../components/forms";
export const dynamic = "force-dynamic";
export default async function Admin({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const u = await actor();
  if (!u) redirect("/login");
  if (u.platform_role !== "super_admin") redirect("/app");
  const section = (await params).section?.[0] ?? "dashboard";
  if (
    ![
      "dashboard",
      "properties",
      "customers",
      "subscriptions",
      "plans",
      "modules",
      "leads",
      "integrations",
      "support",
      "analytics",
      "settings",
      "audit",
    ].includes(section)
  )
    notFound();
  const filters = await searchParams;
  const q = filters.q?.slice(0, 100) ?? "";
  const status = filters.status ?? "";
  const d = await transaction(u.id, async (db) => {
    const metrics = (
      await db.query(
        "SELECT (SELECT count(*) FROM properties) properties,(SELECT count(*) FROM subscriptions WHERE status='active') active,(SELECT count(*) FROM subscriptions WHERE status='trial' AND renews_at>now()) trials,(SELECT count(*) FROM properties WHERE status='pending') pending,(SELECT count(*) FROM support_tickets WHERE status<>'resolved') support,(SELECT count(*) FROM users WHERE platform_role='customer') customers",
      )
    ).rows[0];
    const properties = (
      await db.query(
        "SELECT p.*,o.name organization,u.name owner_name,u.email owner_email FROM properties p JOIN organizations o ON o.id=p.organization_id JOIN users u ON u.id=o.owner_id WHERE (p.name ILIKE $1 OR u.email ILIKE $1) AND ($2='' OR p.status=$2) ORDER BY p.created_at DESC LIMIT 100",
        [`%${q}%`, section === "properties" ? status : ""],
      )
    ).rows;
    const customers = (
      await db.query(
        "SELECT u.id,u.name,u.email,u.status,u.created_at FROM users u WHERE u.platform_role='customer' AND (u.name ILIKE $1 OR u.email ILIKE $1) ORDER BY u.created_at DESC LIMIT 100",
        [`%${q}%`],
      )
    ).rows;
    const plans = (await db.query("SELECT * FROM plans ORDER BY id")).rows;
    const subscriptions = (
      await db.query(
        "SELECT s.*,p.name property_name,pl.name plan_name FROM subscriptions s JOIN properties p ON p.id=s.property_id JOIN plans pl ON pl.id=s.plan_id ORDER BY s.created_at DESC LIMIT 100",
      )
    ).rows;
    const features = (
      await db.query("SELECT * FROM feature_registry ORDER BY category,name")
    ).rows;
    const entitlements = (await db.query("SELECT * FROM feature_entitlements"))
      .rows;
    const propertyEntitlements = (
      await db.query("SELECT * FROM property_entitlements LIMIT 500")
    ).rows;
    const leads = (
      await db.query(
        "SELECT * FROM leads WHERE (name ILIKE $1 OR email ILIKE $1) AND ($2='' OR status=$2) ORDER BY created_at DESC LIMIT 100",
        [`%${q}%`, section === "leads" ? status : ""],
      )
    ).rows;
    const tickets = (
      await db.query(
        "SELECT t.*,p.name property_name FROM support_tickets t JOIN properties p ON p.id=t.property_id ORDER BY created_at DESC LIMIT 100",
      )
    ).rows;
    const messages = (
      await db.query(
        "SELECT m.*,u.name FROM ticket_messages m JOIN users u ON u.id=m.user_id ORDER BY m.created_at DESC LIMIT 300",
      )
    ).rows;
    const ota = (await db.query("SELECT * FROM ota_providers ORDER BY name"))
      .rows;
    const connections = (
      await db.query(
        "SELECT c.*,p.name property_name,o.name provider_name FROM integration_connections c JOIN properties p ON p.id=c.property_id JOIN ota_providers o ON o.id=c.provider_id LIMIT 100",
      )
    ).rows;
    const logs = (
      await db.query(
        "SELECT a.*,u.email FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100",
      )
    ).rows;
    const admins = (
      await db.query(
        "SELECT id,name,email FROM users WHERE platform_role='super_admin' AND status='active'",
      )
    ).rows;
    const company = (
      await db.query("SELECT value FROM platform_settings WHERE key='company'")
    ).rows[0]?.value;
    const growth = (
      await db.query(
        "SELECT to_char(date_trunc('month',created_at),'YYYY-MM') AS month,count(*) AS total FROM users WHERE platform_role='customer' GROUP BY 1 ORDER BY 1 DESC LIMIT 12",
      )
    ).rows;
    return {
      metrics,
      properties,
      customers,
      plans,
      subscriptions,
      features,
      entitlements,
      propertyEntitlements,
      leads,
      tickets,
      messages,
      ota,
      connections,
      logs,
      admins,
      company,
      growth,
    };
  });
  const assignees = (name: string, value?: string) => (
    <label>
      Assigned administrator
      <select name={name} defaultValue={value ?? ""}>
        <option value="">Unassigned</option>
        {d.admins.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {a.email}
          </option>
        ))}
      </select>
    </label>
  );
  const filter = (
    <form className="filter" method="get">
      <label>
        Search
        <input name="q" defaultValue={q} placeholder="Name or email" />
      </label>
      {["properties", "leads"].includes(section) && (
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {(section === "properties"
              ? ["pending", "active", "suspended", "rejected"]
              : ["new", "contacted", "qualified", "closed"]
            ).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      <button className="button outline">Apply filters</button>
    </form>
  );
  return (
    <Workspace admin section={section} name={u.name}>
      <PageTitle
        eyebrow="PLATFORM ADMINISTRATION"
        title={
          section === "dashboard"
            ? "Your platform, in perspective."
            : section[0].toUpperCase() + section.slice(1)
        }
        description="Live database records. Unfinished operational modules remain disabled."
      />
      {section === "dashboard" && (
        <>
          <div className="stats-grid">
            {[
              [
                "Total properties",
                d.metrics.properties,
                "Registered workspaces",
              ],
              [
                "Active subscriptions",
                d.metrics.active,
                "Assigned active plans",
              ],
              ["Trial accounts", d.metrics.trials, "Unexpired trials"],
              [
                "Pending approvals",
                d.metrics.pending,
                "Property registrations",
              ],
            ].map(([label, value, sub]) => (
              <div className="stat-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{sub}</small>
              </div>
            ))}
          </div>
          <div className="dashboard-grid">
            <Panel title="Platform activity">
              {d.logs.length ? (
                d.logs.slice(0, 8).map((l) => (
                  <div className="activity" key={l.id}>
                    <span>◈</span>
                    <div>
                      <b>{l.action.replaceAll(".", " · ")}</b>
                      <p>
                        {l.email ?? "System"} ·{" "}
                        {new Date(l.created_at)
                          .toISOString()
                          .slice(0, 16)
                          .replace("T", " ")}{" "}
                        UTC
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  title="A fresh beginning"
                  description="Platform activity will appear as accounts and properties are created."
                />
              )}
            </Panel>
            <Panel title="At a glance">
              <div className="overview-row">
                <span>Open support requests</span>
                <b>{d.metrics.support}</b>
              </div>
              <div className="overview-row">
                <span>Registered customers</span>
                <b>{d.metrics.customers}</b>
              </div>
              <h3>Revenue overview</h3>
              <p className="muted">
                Not tracked. Payment processing and revenue collection are not
                implemented.
              </p>
              <Badge>Foundation release</Badge>
            </Panel>
          </div>
        </>
      )}
      {section === "properties" && (
        <>
          <Panel title="Registered properties">
            {filter}
            <p className="small muted">
              Showing at most 100 matching properties.
            </p>
            {!d.properties.length && (
              <Empty
                title="No matching properties"
                description="New property registrations will appear here for review."
              />
            )}
            {d.properties.map((p) => (
              <details key={p.id} className="record">
                <summary>
                  <span>
                    {p.name}
                    <small>
                      {p.owner_email} · {p.type}
                    </small>
                  </span>
                  <Badge>{p.status}</Badge>
                </summary>
                <div className="record-content">
                  <div className="two">
                    <div>
                      <h3>Property profile</h3>
                      <p>{p.address || "No address supplied"}</p>
                      <p>
                        {p.email} · {p.phone}
                      </p>
                      <p>Organization: {p.organization}</p>
                      <p>Owner: {p.owner_name}</p>
                      <p className="small muted">Property ID: {p.id}</p>
                    </div>
                    <Form
                      endpoint="/api/admin/properties"
                      values={{ id: p.id }}
                    >
                      <Select
                        label="Account status"
                        name="status"
                        value={p.status}
                        options={["pending", "active", "rejected", "suspended"]}
                      />
                    </Form>
                  </div>
                </div>
              </details>
            ))}
          </Panel>
        </>
      )}
      {section === "customers" && (
        <Panel title="Customer accounts">
          {filter}
          {!d.customers.length && (
            <Empty
              title="No customer accounts yet"
              description="Customer registrations will appear here."
            />
          )}
          {d.customers.map((c) => (
            <details key={c.id} className="record">
              <summary>
                <span>
                  {c.name}
                  <small>{c.email}</small>
                </span>
                <Badge>{c.status}</Badge>
              </summary>
              <div className="record-content">
                <p>
                  Registered:{" "}
                  {new Date(c.created_at).toISOString().slice(0, 10)}
                </p>
                <h3>Owned properties and subscriptions</h3>
                {d.properties
                  .filter((p) => p.owner_email === c.email)
                  .map((p) => (
                    <p key={p.id}>
                      {p.name} · {p.status} ·{" "}
                      {d.subscriptions.find((s) => s.property_id === p.id)
                        ?.plan_name ?? "No plan"}
                    </p>
                  ))}
                <Form endpoint="/api/admin/customers" values={{ id: c.id }}>
                  <Select
                    label="Account status"
                    name="status"
                    options={["active", "suspended"]}
                    value={c.status}
                  />
                </Form>
                <h3>Recent activity</h3>
                {d.logs
                  .filter((l) => l.actor_id === c.id)
                  .slice(0, 10)
                  .map((l) => (
                    <p key={l.id}>
                      {l.action} · {new Date(l.created_at).toISOString()}
                    </p>
                  ))}
              </div>
            </details>
          ))}
        </Panel>
      )}
      {section === "plans" && (
        <>
          <div className="notice">
            Plan settings do not authorize unfinished modules. Prices are
            optional and no checkout is implemented.
          </div>
          <div className="module-grid">
            {[
              ...d.plans,
              {
                id: "",
                name: "",
                price_minor: null,
                currency: "INR",
                trial_days: 14,
                features: [],
              },
            ].map((p, i) => (
              <Panel title={p.name || "Create a plan"} key={p.id || i}>
                <Form endpoint="/api/admin/plans" transform="plan">
                  <Field label="Plan ID" name="id" value={p.id} />
                  <Field label="Plan name" name="name" value={p.name} />
                  <div className="two">
                    <Field
                      label="Price (blank = unannounced)"
                      name="price"
                      type="number"
                      required={false}
                      value={
                        p.price_minor === null
                          ? ""
                          : Number(p.price_minor) / 100
                      }
                      min={0}
                    />
                    <Field
                      label="Currency"
                      name="currency"
                      value={p.currency}
                    />
                  </div>
                  <Field
                    label="Trial days"
                    name="trialDays"
                    type="number"
                    value={p.trial_days}
                    min={0}
                    max={365}
                  />
                  <Textarea
                    label="Plan features (one per line)"
                    name="features"
                    value={p.features.join("\n")}
                  />
                </Form>
              </Panel>
            ))}
          </div>
        </>
      )}
      {section === "subscriptions" && (
        <div className="dashboard-grid">
          <Panel title="Subscription records">
            {d.subscriptions.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th>Renewal / trial end</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.subscriptions.map((s) => (
                      <tr key={s.id}>
                        <td>{s.property_name}</td>
                        <td>{s.plan_name}</td>
                        <td>
                          <Badge>{s.status}</Badge>
                        </td>
                        <td>
                          {s.renews_at
                            ? new Date(s.renews_at).toISOString().slice(0, 10)
                            : "Not set"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No subscriptions"
                description="Property registration assigns the configured Starter trial."
              />
            )}
          </Panel>
          <Panel title="Assign or update subscription">
            <Form endpoint="/api/admin/subscriptions" transform="subscription">
              <label>
                Property
                <select name="propertyId" required>
                  <option value="">Choose property</option>
                  {d.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Plan
                <select name="planId">
                  {d.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <Select
                label="Status"
                name="status"
                options={["trial", "active", "expired", "cancelled"]}
              />
              <Field
                label="Trial end / renewal date"
                name="renewsAt"
                type="datetime-local"
                required={false}
              />
            </Form>
          </Panel>
        </div>
      )}
      {section === "modules" && (
        <>
          <div className="notice">
            <strong>Technical release gate</strong>
            <p>
              No module has technical approval. Development states and
              entitlements below cannot make a module operational. A tested,
              security-reviewed code release is required.
            </p>
          </div>
          <div className="module-grid">
            {d.features.map((f) => (
              <Panel key={f.id} title={f.name}>
                <Badge />
                <p className="small muted">
                  {f.category} · {f.id}
                </p>
                <Form endpoint="/api/admin/modules" values={{ id: f.id }}>
                  <Select
                    label="Development"
                    name="developmentStatus"
                    options={[
                      "planned",
                      "in_development",
                      "testing",
                      "complete",
                    ]}
                    value={f.development_status}
                  />
                  <Select
                    label="Availability state"
                    name="releaseState"
                    options={[
                      "planned",
                      "in_development",
                      "testing",
                      "disabled",
                    ]}
                    value={f.release_state}
                  />
                </Form>
                <details>
                  <summary>Plan and property entitlements</summary>
                  <div className="record-content">
                    <Form
                      endpoint="/api/admin/entitlements"
                      values={{ id: f.id }}
                      transform="entitlement"
                      label="Save entitlement"
                    >
                      <label>
                        Plan (choose one target)
                        <select name="planId">
                          <option value="">No plan target</option>
                          {d.plans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Property
                        <select name="propertyId">
                          <option value="">No property target</option>
                          {d.properties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Select
                        label="Entitlement"
                        name="enabled"
                        options={["false", "true"]}
                      />
                      <p className="small muted">
                        Select exactly one plan or property. Both plan and
                        property grants are required at runtime.
                      </p>
                    </Form>
                    <p className="small">
                      Plan grants:{" "}
                      {d.entitlements
                        .filter((e) => e.feature_id === f.id && e.enabled)
                        .map((e) => e.plan_id)
                        .join(", ") || "None"}
                    </p>
                    <p className="small">
                      Property grants:{" "}
                      {
                        d.propertyEntitlements.filter(
                          (e) => e.feature_id === f.id && e.enabled,
                        ).length
                      }
                    </p>
                  </div>
                </details>
              </Panel>
            ))}
          </div>
        </>
      )}
      {section === "leads" && (
        <Panel title="Enquiries and demo requests">
          {filter}
          {!d.leads.length && (
            <Empty
              title="Ready for your first conversation"
              description="Demo requests, contact enquiries and trial registrations will appear here."
            />
          )}
          {d.leads.map((l) => (
            <details key={l.id} className="record">
              <summary>
                <span>
                  {l.name}
                  <small>
                    {l.email} · {l.kind} · {l.property_name}
                  </small>
                </span>
                <Badge>{l.status}</Badge>
              </summary>
              <div className="record-content">
                <p>{l.message || "No additional message."}</p>
                <Form
                  endpoint="/api/admin/leads"
                  values={{ id: l.id }}
                  transform="lead"
                >
                  <Select
                    label="Lead status"
                    name="status"
                    value={l.status}
                    options={["new", "contacted", "qualified", "closed"]}
                  />
                  {assignees("assignedTo", l.assigned_to)}
                  <Textarea
                    label="Internal notes"
                    name="notes"
                    value={l.notes}
                  />
                </Form>
              </div>
            </details>
          ))}
        </Panel>
      )}
      {section === "integrations" && (
        <>
          <div className="notice">
            OTA connections and synchronization are disabled. Provider
            credentials must use environment or vault references in a future
            approved adapter.
          </div>
          <div className="module-grid">
            {d.ota.map((o) => (
              <Panel key={o.id} title={o.name}>
                <Badge />
                <p className="muted">Provider adapter not implemented.</p>
                <p className="small">
                  Configuration schema: {JSON.stringify(o.config_schema)}
                </p>
                <button disabled>Connect provider</button>
              </Panel>
            ))}
          </div>
          <Panel title="Connection monitoring">
            {d.connections.length ? (
              d.connections.map((c) => (
                <p key={c.id}>
                  {c.property_name} · {c.provider_name} · {c.status} ·{" "}
                  {c.last_error ?? "No synchronization attempted"}
                </p>
              ))
            ) : (
              <Empty
                title="No connections configured"
                description="No live synchronization, successful sync metrics or provider errors exist yet."
              />
            )}
          </Panel>
        </>
      )}
      {section === "support" && (
        <Panel title="Support conversations">
          {!d.tickets.length && (
            <Empty
              title="No support requests"
              description="Customer support tickets will appear here."
            />
          )}
          {d.tickets.map((t) => (
            <details key={t.id} className="record">
              <summary>
                <span>
                  {t.subject}
                  <small>{t.property_name}</small>
                </span>
                <Badge>{t.status}</Badge>
              </summary>
              <div className="record-content">
                <p>{t.message}</p>
                {d.messages
                  .filter((m) => m.ticket_id === t.id)
                  .map((m) => (
                    <blockquote key={m.id}>
                      <b>{m.name}</b>
                      <p>{m.message}</p>
                    </blockquote>
                  ))}
                <Form
                  endpoint="/api/admin/support"
                  values={{ id: t.id }}
                  transform="support"
                >
                  <div className="two">
                    <Select
                      label="Status"
                      name="status"
                      value={t.status}
                      options={["open", "in_progress", "resolved"]}
                    />
                    <Select
                      label="Priority"
                      name="priority"
                      value={t.priority}
                      options={["low", "normal", "high"]}
                    />
                  </div>
                  {assignees("assignedTo", t.assigned_to)}
                  <Textarea label="Reply to customer" name="reply" />
                </Form>
              </div>
            </details>
          ))}
        </Panel>
      )}
      {section === "analytics" && (
        <div className="dashboard-grid">
          <Panel title="Customer growth">
            {d.growth.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Registration month</th>
                      <th>Customers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.growth.map((g) => (
                      <tr key={g.month}>
                        <td>{g.month}</td>
                        <td>{g.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No customer growth data yet"
                description="Counts will come from real registrations."
              />
            )}
          </Panel>
          <Panel title="Measurement availability">
            <p>
              Active subscriptions: <b>{d.metrics.active}</b>
            </p>
            <p>
              Unexpired trials: <b>{d.metrics.trials}</b>
            </p>
            <p className="muted">
              Trial conversion cohorts, collected revenue and operational
              feature adoption are not tracked in this foundation. No synthetic
              metrics are displayed.
            </p>
          </Panel>
        </div>
      )}
      {section === "settings" && <AccountSecurity user={u} />}
      {section === "settings" && (
        <div className="dashboard-grid">
          <Panel title="Company and branding">
            <Form endpoint="/api/admin/settings">
              <Field
                label="Company display name"
                name="name"
                value={d.company?.name ?? "StayPunch360"}
              />
              <Field
                label="Contact email"
                name="contactEmail"
                type="email"
                value={d.company?.contactEmail ?? ""}
                required={false}
              />
              <Field
                label="Support email"
                name="supportEmail"
                type="email"
                value={d.company?.supportEmail ?? ""}
                required={false}
              />
            </Form>
          </Panel>
          <Panel title="Security and infrastructure">
            <h3>Platform staff</h3>
            {d.admins.map((a) => (
              <p key={a.id}>
                {a.name} · {a.email}{" "}
                <Badge tone="teal">Super administrator</Badge>
              </p>
            ))}
            <p className="small muted">
              Platform roles are provisioned through the audited bootstrap
              procedure. Customers cannot grant platform access.
            </p>
            <h3>Email configuration</h3>
            <p className="muted">
              Transactional email is queued in PostgreSQL. Configure the
              delivery worker before enabling public registration.
            </p>
            <h3>Two-factor authentication</h3>
            <Badge>Architecture only</Badge>
            <p className="muted small">
              See the security architecture for encrypted factors, challenge
              sessions and recovery-code requirements.
            </p>
            <h3>Infrastructure secrets</h3>
            <p className="small muted">
              Configure DATABASE_URL and delivery credentials in hosting
              settings. No secret values are exposed in this interface.
            </p>
          </Panel>
        </div>
      )}
      {section === "audit" && (
        <Panel title="Security and activity audit">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                </tr>
              </thead>
              <tbody>
                {d.logs.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.created_at).toISOString()}</td>
                    <td>{l.email ?? "System"}</td>
                    <td>{l.action}</td>
                    <td>{l.entity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!d.logs.length && (
            <Empty
              title="No audit events"
              description="Security and management actions are recorded here."
            />
          )}
        </Panel>
      )}
    </Workspace>
  );
}
