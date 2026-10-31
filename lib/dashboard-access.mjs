// Identity headers are supplied by Sites dispatch, never by the dashboard UI.
export function isDashboardOwner(request, env) {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  return Boolean(id && email && env.DASHBOARD_OWNER_EMAIL &&
    email.trim().toLowerCase() === env.DASHBOARD_OWNER_EMAIL.trim().toLowerCase());
}

function sameSecret(actual, expected) {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

export function isDashboardService(request, env) {
  // Dispatch consumes its own header. Cloud updaters explicitly pass the same
  // Site service credential in this second, server-only authorization header.
  return sameSecret(request.headers.get('X-Dashboard-Service-Authorization'),
    env.DASHBOARD_SERVICE_TOKEN ? `Bearer ${env.DASHBOARD_SERVICE_TOKEN}` : null);
}

export function requireDashboardWrite(request, env) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({error:'Origin rejected'}, {status:403});
  }
  if (isDashboardOwner(request, env) || isDashboardService(request, env)) return null;
  return Response.json({
    error:'This dashboard is read-only for visitors. Sign in as the owner to make changes.',
    code:'DASHBOARD_OWNER_REQUIRED',
    updaterInstructions:'/dashboard/updater-access.md'
  }, {status:403, headers:{'Cache-Control':'private, no-store'}});
}
