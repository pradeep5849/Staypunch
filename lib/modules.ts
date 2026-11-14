export type ModuleStatus = "coming_soon" | "live";
export type Module = { id: string; name: string; group: string; status: ModuleStatus };
const names: Record<string,string[]> = {
  "Overview":["Dashboard","Property Setup","Staff & Roles","Reports & Analytics"],
  "Reservations":["Booking Engine","PMS & Front Desk","Central Reservations","Group Bookings","Guest CRM"],
  "Distribution":["Channel Manager","OTA Mapping","Revenue Management","Rate Shopping","Google Hotel Ads","GDS & Wholesalers"],
  "Operations":["Housekeeping","Maintenance","Restaurant POS","Resort Activities","Events & Banquets","QR Guest Services"],
  "Finance":["Payments & Refunds","Accounting & GST","OTA Reconciliation","Corporate Ledger"],
  "Growth":["WhatsApp & Messaging","Loyalty & Promotions","AI & Automation","Marketing & Reviews"],
  "Platform":["Multi-property","Integrations & API","Security & Audit","Subscription Billing","Settings"]
};
export const modules: Module[] = Object.entries(names).flatMap(([group,items])=>items.map((name)=>({id:name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-$/,""),name,group,status:"coming_soon" as const})));
export function moduleIsLive(id:string):boolean { return modules.some(m=>m.id===id && m.status==="live"); }
