/** Explicit route coverage for the second-generation operating workspace surfaces. */
const upgradedRoots = [
  "/infrastructure", "/commitments", "/relationships", "/dependencies", "/issues", "/assets", "/experiments",
  "/business-pulse", "/fitness/plans", "/fitness/recovery", "/life/wealth", "/travel/mobility", "/forecasts",
  "/operations", "/knowledge", "/learning", "/chief-of-staff", "/executive", "/founder", "/state",
  "/automations", "/approvals", "/communication", "/memory", "/meeting", "/settings/integrations",
  "/settings/notifications", "/settings/business", "/settings/chief-of-staff", "/changes",
];
export function usesPremiumWorkspace(pathname: string) {
  return upgradedRoots.some(root => pathname === root || pathname.startsWith(`${root}/`));
}
