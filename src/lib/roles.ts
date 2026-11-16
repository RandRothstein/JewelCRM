import type { Role } from "@prisma/client";

export const ROLE_NAV: Record<Role, string[]> = {
  OWNER: ["/dashboard", "/showroom", "/customers", "/catalog", "/campaigns", "/stock-check", "/shifts", "/targets", "/holds", "/bookings", "/loyalty", "/feedback", "/reports", "/settings"],
  MANAGER: ["/dashboard", "/showroom", "/customers", "/catalog", "/stock-check", "/shifts", "/targets", "/holds", "/bookings", "/feedback", "/reports", "/settings"],
  GREETER: ["/dashboard", "/showroom", "/customers", "/bookings"],
  SALES_CRO: ["/dashboard", "/showroom", "/customers", "/catalog", "/holds", "/bookings", "/targets", "/loyalty", "/feedback"],
  MARKETING_CRO: ["/dashboard", "/customers", "/catalog", "/campaigns", "/reports"],
  SUPPORT: ["/dashboard", "/showroom", "/customers", "/catalog", "/campaigns", "/stock-check", "/shifts", "/targets", "/holds", "/bookings", "/loyalty", "/feedback", "/reports", "/settings"],
};

export function canSeeFullCustomer(role: Role) {
  return role === "OWNER" || role === "MANAGER" || role === "MARKETING_CRO" || role === "SUPPORT";
}

export function marketingViewOnly(role: Role) {
  return role === "MARKETING_CRO";
}
