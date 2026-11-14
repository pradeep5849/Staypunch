export type ModuleStatus = "coming_soon" | "live";
export type Module = {
  id: string;
  name: string;
  group: string;
  description: string;
  status: ModuleStatus;
  permission: string;
};
const names: Record<string, string[]> = {
  Overview: [
    "Dashboard",
    "Property Setup",
    "Staff & Roles",
    "Reports & Analytics",
  ],
  Reservations: [
    "Booking Engine",
    "PMS & Front Desk",
    "Central Reservations",
    "Group Bookings",
    "Guest CRM",
    "Inventory Management",
  ],
  Distribution: [
    "Channel Manager",
    "OTA Mapping",
    "Revenue Management",
    "Rate Shopping",
    "Rate Management",
    "Dynamic Pricing",
    "Google Hotel Ads",
    "GDS & Wholesalers",
  ],
  Operations: [
    "Housekeeping",
    "Maintenance",
    "Restaurant POS",
    "Resort Activities",
    "Events & Banquets",
    "QR Guest Services",
  ],
  Finance: [
    "Payments & Refunds",
    "Accounting & GST",
    "OTA Reconciliation",
    "Corporate Ledger",
  ],
  Growth: [
    "WhatsApp & Messaging",
    "WhatsApp Automation",
    "AI & Automation",
    "AI Chatbot",
    "Loyalty & Promotions",
    "Marketing & Reviews",
  ],
  Platform: [
    "Multi-property",
    "Integrations & API",
    "Security & Audit",
    "Subscription Billing",
    "Settings",
  ],
};
export const modules: Module[] = Object.entries(names).flatMap(
  ([group, items]) =>
    items.map((name) => ({
      id: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-$/, ""),
      name,
      group,
      description: `${name} for your hospitality business. Available after a validated release.`,
      status: "coming_soon" as const,
      permission: "modules.use",
    })),
);
// Technical approval is code-reviewed. An admin database toggle cannot add entries here.
export const approvedReleases: Readonly<
  Record<
    string,
    {
      developmentComplete: boolean;
      testsPassed: boolean;
      securityPassed: boolean;
      integrationsOperational: boolean;
      approved: boolean;
    }
  >
> = Object.freeze({});
export function moduleIsLive(id: string): boolean {
  const r = approvedReleases[id];
  return !!r && Object.values(r).every(Boolean);
}
export function canUseModule(input: {
  id: string;
  releaseState: string;
  planEnabled: boolean;
  propertyEnabled: boolean;
  permissions: string[];
}) {
  return (
    moduleIsLive(input.id) &&
    input.releaseState === "released" &&
    input.planEnabled &&
    input.propertyEnabled &&
    input.permissions.includes("modules.use")
  );
}
