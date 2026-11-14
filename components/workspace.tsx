import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./ui";
import { Logout } from "./forms";
export function Workspace({
  admin = false,
  section,
  name,
  children,
}: {
  admin?: boolean;
  section: string;
  name: string;
  children: ReactNode;
}) {
  const base = admin ? "/admin" : "/app";
  const links = admin
    ? [
        "Dashboard",
        "Properties",
        "Customers",
        "Subscriptions",
        "Plans",
        "Modules",
        "Leads",
        "Integrations",
        "Support",
        "Analytics",
        "Settings",
        "Audit",
      ]
    : [
        "Dashboard",
        "Property",
        "Rooms",
        "Staff",
        "Subscription",
        "Modules",
        "Support",
        "Settings",
      ];
  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <Brand />
        <div className="workspace-label">
          {admin ? "PLATFORM CONTROL" : "PROPERTY WORKSPACE"}
        </div>
        <nav aria-label={admin ? "Administration" : "Property navigation"}>
          {links.map((label, i) => (
            <Link
              key={label}
              className={section === label.toLowerCase() ? "active" : ""}
              href={i === 0 ? base : `${base}/${label.toLowerCase()}`}
            >
              <span className="nav-icon">
                {
                  ["◫", "⌂", "▦", "♧", "◷", "◇", "☷", "⌘", "◉", "›", "⚙", "≡"][
                    i
                  ]
                }
              </span>
              {label}
              {label === "Modules" && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
          <div>
            <b>{name}</b>
            <small>{admin ? "Super administrator" : "Your workspace"}</small>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <div>
            <span className="muted">{admin ? "Platform" : "Workspace"}</span>
            <span className="breadcrumb"> / {section}</span>
          </div>
          <div className="workspace-tools">
            <span className="badge teal">Foundation</span>
            <Logout />
          </div>
        </header>
        <main className="workspace-main">{children}</main>
        <footer className="workspace-footer">
          StayPunch360 <span>Shared foundation · Secure by design</span>
        </footer>
      </div>
    </div>
  );
}
