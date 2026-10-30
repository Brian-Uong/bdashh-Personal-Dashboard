// Only a successfully verified private gateway can grant request identity.
const owners = new WeakSet();
export function grantVerifiedOwner(request) { owners.add(request); }
export function isDashboardOwner(request) { return owners.has(request); }
export function isDashboardService() { return false; }
export function requireDashboardWrite(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({error:'Origin rejected'}, {status:403});
  if (isDashboardOwner(request)) return null;
  return Response.json({error:'Private dashboard. Owner sign-in required.',code:'DASHBOARD_OWNER_REQUIRED'},
    {status:403,headers:{'Cache-Control':'private, no-store'}});
}
