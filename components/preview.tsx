"use client";
import { useState } from "react";
export function Preview() {
  const [tab, setTab] = useState("Overview");
  return (
    <div className="product-preview">
      <div className="preview-top">
        <span className="preview-dots">● ● ●</span>
        <span>StayPunch360 · Product concept</span>
        <span className="badge">Illustrative mockup</span>
      </div>
      <div className="preview-body">
        <aside>
          <b>YOUR WORKSPACE</b>
          {["Overview", "Property", "Rooms", "Modules"].map((t) => (
            <button
              key={t}
              className={t === tab ? "selected" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
          <span className="preview-bottom">
            ◈ All your properties.
            <br />
            One clear picture.
          </span>
        </aside>
        <div className="preview-main">
          <div className="preview-heading">
            <div>
              <small>WORKSPACE PREVIEW</small>
              <h3>
                {tab === "Overview"
                  ? "A calmer way to manage."
                  : `${tab}, beautifully organized.`}
              </h3>
            </div>
            <span>◌</span>
          </div>
          {tab === "Overview" ? (
            <>
              <div className="preview-stats">
                {["Property setup", "Team access", "Module roadmap"].map(
                  (s, i) => (
                    <div key={s}>
                      <small>{s}</small>
                      <strong>
                        {["Get started", "Role-based", "Coming Soon"][i]}
                      </strong>
                      <span>Foundation workspace</span>
                    </div>
                  ),
                )}
              </div>
              <div className="preview-chart">
                <div>
                  <b>Your next chapter starts here</b>
                  <p>
                    Set up your property. Bring your team together.
                    <br />
                    Grow into a connected hospitality platform.
                  </p>
                  <div className="chart-bars">
                    {[32, 45, 38, 61, 48, 72, 64, 85, 76, 95, 89, 110].map(
                      (h, i) => (
                        <i style={{ height: h }} key={i} />
                      ),
                    )}
                  </div>
                </div>
                <div className="preview-checklist">
                  <b>Property readiness</b>
                  <p>✓ Property profile</p>
                  <p>✓ Room type structure</p>
                  <p>○ Invite your team</p>
                  <p>○ Explore the roadmap</p>
                </div>
              </div>
            </>
          ) : (
            <div className="preview-detail">
              <span className="large-icon">
                {tab === "Property" ? "⌂" : tab === "Rooms" ? "▦" : "◇"}
              </span>
              <h3>
                {tab === "Property"
                  ? "A home for every detail"
                  : tab === "Rooms"
                    ? "Give every room a place"
                    : "A roadmap built around you"}
              </h3>
              <p>
                {tab === "Property"
                  ? "Contacts, amenities and property information, together."
                  : tab === "Rooms"
                    ? "Configure room types and capacity during onboarding."
                    : "Booking, distribution, operations and growth modules remain Coming Soon."}
              </p>
              <span className="badge">
                Product concept · no real business data
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
