import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { actor, propertyAccess } from "../../../lib/security";
import { transaction } from "../../../lib/db";
import { modules } from "../../../lib/modules";
import { Workspace } from "../../../components/workspace";
import { PageTitle, Panel, Empty, Badge } from "../../../components/ui";
import { Form, Field, Select, Textarea } from "../../../components/forms";
export const dynamic = "force-dynamic";
export default async function Customer({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ property?: string }>;
}) {
  const u = await actor();
  if (!u) redirect("/login");
  const section = (await params).section?.[0] ?? "dashboard";
  if (
    ![
      "dashboard",
      "property",
      "rooms",
      "staff",
      "subscription",
      "modules",
      "support",
      "settings",
    ].includes(section)
  )
    notFound();
  const selected = (await searchParams).property;
  const data = await transaction(u.id, async (db) => {
    const properties = (
      await db.query(
        "SELECT p.*,m.role FROM properties p JOIN memberships m ON m.property_id=p.id WHERE m.user_id=$1 ORDER BY p.created_at",
        [u.id],
      )
    ).rows;
    const p = properties.find((p) => p.id === selected) ?? properties[0];
    if (!p) return null;
    await propertyAccess(db, u, p.id, "property.read");
    const rooms = (
      await db.query(
        "SELECT * FROM room_types WHERE property_id=$1 ORDER BY name",
        [p.id],
      )
    ).rows;
    const amenities = (
      await db.query("SELECT name FROM amenities WHERE property_id=$1", [p.id])
    ).rows;
    const staff = (
      await db.query(
        "SELECT u.name,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.property_id=$1",
        [p.id],
      )
    ).rows;
    const invitations = (
      await db.query(
        "SELECT email,role,accepted_at,expires_at FROM staff_invitations WHERE property_id=$1 ORDER BY created_at DESC",
        [p.id],
      )
    ).rows;
    const subscription = (
      await db.query(
        "SELECT s.*,p.name,p.price_minor,p.currency FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.property_id=$1",
        [p.id],
      )
    ).rows[0];
    const tickets = (
      await db.query(
        "SELECT * FROM support_tickets WHERE property_id=$1 ORDER BY created_at DESC LIMIT 50",
        [p.id],
      )
    ).rows;
    const messages = (
      await db.query(
        "SELECT m.*,u.name FROM ticket_messages m JOIN support_tickets t ON t.id=m.ticket_id JOIN users u ON u.id=m.user_id WHERE t.property_id=$1 ORDER BY m.created_at",
        [p.id],
      )
    ).rows;
    return {
      p,
      properties,
      rooms,
      amenities,
      staff,
      invitations,
      subscription,
      tickets,
      messages,
    };
  });
  if (!data)
    return (
      <Workspace section={section} name={u.name}>
        <Empty
          title="No property workspace yet"
          description="Accept a staff invitation to join a property. Platform administrators can use the platform dashboard."
        />
        {u.platform_role === "super_admin" && (
          <Link href="/admin" className="button">
            Open platform administration
          </Link>
        )}
      </Workspace>
    );
  const {
    p,
    properties,
    rooms,
    amenities,
    staff,
    invitations,
    subscription,
    tickets,
    messages,
  } = data;
  const writable = ["owner", "manager"].includes(p.role);
  const intro: Record<string, [string, string]> = {
    dashboard: [
      `Welcome back, ${u.name.split(" ")[0]}.`,
      "A clear view of your property foundation.",
    ],
    property: [
      "Every detail, in one place.",
      "Manage your property profile, amenities and contact information.",
    ],
    rooms: [
      "Make room for every stay.",
      "Configure room types and capacity. Live inventory and reservations are Coming Soon.",
    ],
    staff: [
      "Great stays start with your team.",
      "Invite staff and assign scoped property roles.",
    ],
    subscription: [
      "Your plan, at a glance.",
      "Plan status and renewal configuration. No payment collection is enabled.",
    ],
    modules: [
      "Your platform roadmap.",
      "All unreleased modules remain disabled, regardless of plan settings.",
    ],
    support: [
      "A little help goes a long way.",
      "Create a support request and follow the conversation.",
    ],
    settings: [
      "Your account, your workspace.",
      "Manage account security and review your access.",
    ],
  };
  return (
    <Workspace section={section} name={u.name}>
      <div className="dashboard-title">
        <PageTitle
          eyebrow={p.name}
          title={intro[section][0]}
          description={intro[section][1]}
        />
        <Badge tone={p.status === "active" ? "teal" : "soon"}>
          {p.status === "pending" ? "Awaiting approval" : p.status}
        </Badge>
      </div>
      {properties.length > 1 && (
        <div className="property-switch">
          {properties.map((q) => (
            <Link
              className="button outline small-button"
              key={q.id}
              href={`/app/${section}?property=${q.id}`}
            >
              {q.name}
            </Link>
          ))}
        </div>
      )}
      {section === "dashboard" && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <span>PROPERTY STATUS</span>
              <strong>{p.status}</strong>
              <small>Foundation workspace</small>
            </div>
            <div className="stat-card">
              <span>ROOM TYPES</span>
              <strong>{rooms.length}</strong>
              <small>Configured for your property</small>
            </div>
            <div className="stat-card">
              <span>TEAM MEMBERS</span>
              <strong>{staff.length}</strong>
              <small>Scoped property access</small>
            </div>
            <div className="stat-card">
              <span>SUBSCRIPTION</span>
              <strong>{subscription?.name ?? "Unassigned"}</strong>
              <small>{subscription?.status ?? "No subscription"}</small>
            </div>
          </div>
          <div className="dashboard-grid">
            <Panel title="A strong start for your property">
              <div className="onboarding-list">
                {[
                  [
                    "01",
                    "Complete your property profile",
                    "Contacts, amenities and address",
                    "property",
                  ],
                  [
                    "02",
                    "Define your room types",
                    "Room categories, capacity and units",
                    "rooms",
                  ],
                  [
                    "03",
                    "Bring your team together",
                    "Invite your managers and staff",
                    "staff",
                  ],
                ].map(([n, t, d, to]) => (
                  <Link href={`/app/${to}?property=${p.id}`} key={n}>
                    <span>{n}</span>
                    <div>
                      <b>{t}</b>
                      <p>{d}</p>
                    </div>
                    <span>›</span>
                  </Link>
                ))}
              </div>
            </Panel>
            <Panel title="Coming into view">
              <span className="large-icon">◇</span>
              <h3>Everything ahead, clearly marked.</h3>
              <p className="muted">
                Reservations, distribution and operations are planned. No
                bookings, payments or OTA updates can run.
              </p>
              <Link href="/app/modules" className="text-link">
                Explore {modules.length} planned modules ›
              </Link>
            </Panel>
          </div>
          <Panel title="Your property">
            <div className="property-summary">
              <span className="large-icon">⌂</span>
              <div>
                <h3>{p.name}</h3>
                <p>
                  {p.type} · {p.address || "Address not added"}
                </p>
              </div>
              <Link href="/app/property" className="button outline">
                Manage profile
              </Link>
            </div>
          </Panel>
        </>
      )}
      {section === "property" && (
        <Panel title="Property profile">
          {writable ? (
            <Form
              endpoint="/api/workspace/property"
              values={{ propertyId: p.id }}
              transform="profile"
            >
              <div className="two">
                <Field label="Property name" name="name" value={p.name} />
                <Select
                  label="Property type"
                  name="type"
                  options={["hotel", "resort", "homestay", "other"]}
                  value={p.type}
                />
                <Field
                  label="Property email"
                  name="email"
                  type="email"
                  value={p.email}
                  required={false}
                />
                <Field
                  label="Contact phone"
                  name="phone"
                  value={p.phone}
                  required={false}
                />
              </div>
              <Textarea label="Address" name="address" value={p.address} />
              <Field
                label="Amenities (comma-separated)"
                name="amenities"
                value={amenities.map((a) => a.name).join(", ")}
                required={false}
              />
            </Form>
          ) : (
            <>
              <h3>{p.name}</h3>
              <p>
                {p.email} · {p.phone}
              </p>
              <p>{p.address}</p>
              <p>
                {amenities.map((a) => a.name).join(", ") ||
                  "No amenities added"}
              </p>
              <Badge>Read-only staff access</Badge>
            </>
          )}
        </Panel>
      )}
      {section === "rooms" && (
        <div className="dashboard-grid">
          <Panel title="Room type catalogue">
            {rooms.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Room type</th>
                      <th>Capacity</th>
                      <th>Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.capacity} guests</td>
                        <td>{r.units}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="A blank canvas for your rooms"
                description="Add your first room type to begin organizing your property."
              />
            )}
          </Panel>
          {writable && (
            <Panel title="Add a room type">
              <Form
                endpoint="/api/workspace/rooms"
                values={{ propertyId: p.id }}
                label="Add room type"
              >
                <Field label="Room type name" name="name" />
                <div className="two">
                  <Field
                    label="Guest capacity"
                    name="capacity"
                    type="number"
                    min={1}
                    max={30}
                  />
                  <Field
                    label="Number of units"
                    name="units"
                    type="number"
                    min={1}
                    max={10000}
                  />
                </div>
              </Form>
            </Panel>
          )}
        </div>
      )}
      {section === "staff" && (
        <div className="dashboard-grid">
          <Panel title="Your team">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Team member</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.email}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>
                        <Badge tone="teal">{s.role}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Invitations</h3>
            {invitations.length ? (
              invitations.map((i, index) => (
                <p key={index}>
                  {i.email} · {i.role} ·{" "}
                  {i.accepted_at
                    ? "Accepted"
                    : new Date(i.expires_at) < new Date()
                      ? "Expired"
                      : "Pending"}
                </p>
              ))
            ) : (
              <p className="muted">No invitations yet.</p>
            )}
          </Panel>
          {p.role === "owner" && (
            <Panel title="Invite a teammate">
              <Form
                endpoint="/api/workspace/staff"
                values={{ propertyId: p.id }}
                label="Queue invitation"
              >
                <Field label="Email address" name="email" type="email" />
                <Select
                  label="Role"
                  name="role"
                  options={["staff", "manager"]}
                />
                <p className="small muted">
                  Manager: edit property and rooms. Staff: view property and
                  create support requests. Email delivery must be configured.
                </p>
              </Form>
            </Panel>
          )}
        </div>
      )}
      {section === "subscription" && (
        <Panel title="Subscription overview">
          {subscription ? (
            <>
              <Badge tone="teal">{subscription.status}</Badge>
              <h2>{subscription.name}</h2>
              <p>
                {subscription.price_minor === null
                  ? "Price not announced"
                  : new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: subscription.currency,
                    }).format(Number(subscription.price_minor) / 100)}
              </p>
              <p>
                Trial end / renewal:{" "}
                {subscription.renews_at
                  ? new Date(subscription.renews_at).toISOString().slice(0, 10)
                  : "Not scheduled"}
              </p>
              <p className="muted">
                A plan assignment does not release unfinished modules. No
                charges or automatic renewals are processed.
              </p>
            </>
          ) : (
            <Empty
              title="No subscription assigned"
              description="Contact platform support to discuss a plan."
            />
          )}
        </Panel>
      )}
      {section === "modules" && (
        <div className="module-grid">
          {modules.map((m) => (
            <article key={m.id} className="module-card">
              <div>
                <span className="eyebrow">{m.group}</span>
                <Badge />
              </div>
              <span className="large-icon">◇</span>
              <h3>{m.name}</h3>
              <p>{m.description}</p>
              <button disabled className="button outline">
                Not yet available
              </button>
            </article>
          ))}
        </div>
      )}
      {section === "support" && (
        <div className="dashboard-grid">
          <Panel title="Support history">
            {tickets.length ? (
              tickets.map((t) => (
                <article className="record" key={t.id}>
                  <Badge>{t.status}</Badge>
                  <h3>{t.subject}</h3>
                  <p>{t.message}</p>
                  <p className="small muted">Priority: {t.priority}</p>
                  {messages
                    .filter((m) => m.ticket_id === t.id)
                    .map((m) => (
                      <blockquote key={m.id}>
                        <b>{m.name}</b>
                        <p>{m.message}</p>
                      </blockquote>
                    ))}
                  <Form
                    endpoint="/api/workspace/reply"
                    values={{ propertyId: p.id, ticketId: t.id }}
                    label="Send reply"
                  >
                    <Textarea label="Reply" name="message" required />
                  </Form>
                </article>
              ))
            ) : (
              <Empty
                title="No support requests"
                description="When you need a hand, start a conversation here."
              />
            )}
          </Panel>
          <Panel title="How can we help?">
            <Form
              endpoint="/api/workspace/support"
              values={{ propertyId: p.id }}
              label="Create support request"
            >
              <Field label="Subject" name="subject" />
              <Select
                label="Priority"
                name="priority"
                options={["normal", "low", "high"]}
              />
              <Textarea label="Tell us more" name="message" required />
            </Form>
          </Panel>
        </div>
      )}
      {section === "settings" && (
        <div className="dashboard-grid">
          <Panel title="Account details">
            <h3>{u.name}</h3>
            <p>{u.email}</p>
            <p>
              Property role: <Badge tone="teal">{p.role}</Badge>
            </p>
            <Link href="/reset-password" className="button outline">
              Reset password
            </Link>
          </Panel>
          <Panel title="Security">
            <h3>Scoped access. Clear boundaries.</h3>
            <p className="muted">
              Sessions expire after seven days. Password resets revoke all
              existing sessions. Property access is checked on the server.
            </p>
            <Badge>Two-factor authentication · Architecture only</Badge>
            <p className="small muted">
              Enrollment and verification are not enabled in this release.
            </p>
          </Panel>
        </div>
      )}
    </Workspace>
  );
}
