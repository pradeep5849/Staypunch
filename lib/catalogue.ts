export const pages: Record<
  string,
  {
    title: string;
    eyebrow: string;
    intro: string;
    points: string[];
    planned?: boolean;
  }
> = {
  features: {
    title: "One platform. Every part of your stay.",
    eyebrow: "THE STAYPUNCH360 PLATFORM",
    intro:
      "A shared foundation for your property, your people and the tools you will grow into.",
    points: [
      "Property onboarding and profiles",
      "Room types and amenities",
      "Staff invitations and roles",
      "A transparent module roadmap",
    ],
  },
  "channel-manager": {
    title: "Distribution, without the disconnect.",
    eyebrow: "CHANNEL MANAGER",
    intro:
      "A planned hub for OTA distribution, mapping and reconciliation. Real connections are disabled until approved provider integrations are ready.",
    points: [
      "Centralized channel catalogue",
      "OTA mapping and reconciliation",
      "Synchronization monitoring",
      "Provider error reporting",
    ],
    planned: true,
  },
  "property-management-system": {
    title: "Make room for better operations.",
    eyebrow: "PROPERTY MANAGEMENT SYSTEM",
    intro:
      "A planned front desk and PMS, built on a shared property and inventory model.",
    points: [
      "Front desk workflows",
      "Central reservations",
      "Guest profiles",
      "Group bookings",
    ],
    planned: true,
  },
  "booking-engine": {
    title: "Your property. Your direct relationship.",
    eyebrow: "BOOKING ENGINE",
    intro:
      "A future direct booking experience for your guests. Reservations and real transactions are not enabled.",
    points: [
      "Direct reservation journey",
      "Authoritative inventory",
      "Property-level availability",
      "Connected guest experience",
    ],
    planned: true,
  },
  "revenue-management": {
    title: "A clearer view of what comes next.",
    eyebrow: "REVENUE MANAGEMENT",
    intro:
      "Planned tools for rate strategy, dynamic pricing and performance analysis.",
    points: [
      "Rate management",
      "Dynamic pricing",
      "Rate shopping",
      "Revenue insights",
    ],
    planned: true,
  },
  "hotel-operations": {
    title: "Thoughtful operations. Exceptional stays.",
    eyebrow: "HOTEL OPERATIONS",
    intro:
      "Future workflows to connect your front desk, housekeeping, maintenance and guest services.",
    points: [
      "Housekeeping and maintenance",
      "Restaurant POS",
      "Resort activities and banquets",
      "QR guest services",
    ],
    planned: true,
  },
  integrations: {
    title: "Built to connect. Released with care.",
    eyebrow: "INTEGRATIONS",
    intro:
      "A provider catalogue and connection architecture are ready for future implementation. No live OTA synchronization is available.",
    points: [
      "Booking.com · Coming Soon",
      "Expedia · Coming Soon",
      "Airbnb · Coming Soon",
      "Agoda · Coming Soon",
    ],
    planned: true,
  },
  about: {
    title: "Better tools for the people behind every stay.",
    eyebrow: "OUR PURPOSE",
    intro:
      "StayPunch360 is being built for independent hotels, resorts, homestays and teams managing multiple properties.",
    points: [
      "A shared source of property information",
      "Clear permissions for every team",
      "Honest, visible release status",
      "A foundation designed to grow",
    ],
  },
  blog: {
    title: "Notes for a better-run property.",
    eyebrow: "THE STAY JOURNAL",
    intro:
      "Product updates and hospitality insights will appear here as the platform develops.",
    points: [
      "No articles have been published yet. Subscribe through our contact form for future updates.",
    ],
  },
  "privacy-policy": {
    title: "Your information, handled with care.",
    eyebrow: "PRIVACY POLICY · FOUNDATION DRAFT",
    intro:
      "This draft describes the foundation implementation and requires business and legal review before public launch.",
    points: [
      "We store account names, email addresses, password hashes, property information and enquiries to provide the service.",
      "Sessions use an HttpOnly cookie. Authentication tokens are hashed in storage. Reset and invitation emails are queued for delivery.",
      "Property information is restricted to authorized members and platform administrators. Security events are recorded in audit logs.",
      "Contact the configured company support address to request access, correction or deletion. Retention periods and the legal data controller must be finalized before launch.",
      "No advertising trackers or payment processing are included in this foundation. Hosting and email processors must be listed before production launch.",
    ],
  },
  terms: {
    title: "A clear foundation for working together.",
    eyebrow: "TERMS & CONDITIONS · FOUNDATION DRAFT",
    intro:
      "These draft terms need business and legal approval before commercial launch.",
    points: [
      "The platform is in its foundation stage. Features labeled Coming Soon are not available for operational use.",
      "Account owners are responsible for authorized access and accurate property information. Do not submit guest payment information or sensitive guest records.",
      "Subscription prices, billing conditions and service commitments are not finalized. No paid subscription purchase is implemented.",
      "Acceptable use, termination, liability, governing law and the operating legal entity must be finalized before launch.",
    ],
  },
};
export const faqs = [
  [
    "Is StayPunch360 ready for live bookings?",
    "No. Booking, payments and OTA synchronization remain disabled. The initial release focuses on property setup, accounts and administration.",
  ],
  [
    "Who is it designed for?",
    "Hotels, resorts, homestays and hospitality groups that want a connected management platform.",
  ],
  [
    "Are OTA connections active?",
    "No. Provider integrations appear in the roadmap and must pass technical and release approval before activation.",
  ],
  [
    "How much does it cost?",
    "Starter, Premium and Enterprise plans are configurable. Final prices have not been announced. Request a demo to discuss your needs.",
  ],
  [
    "Can I invite my team?",
    "Property owners can queue staff invitations with manager or staff roles. Email delivery requires the deployment email worker to be configured.",
  ],
  [
    "Can I manage multiple properties?",
    "The schema supports organizations and multiple properties. The full multi-property workspace is Coming Soon.",
  ],
];
