import {env} from 'cloudflare:workers';
import {isDashboardOwner} from '../../../lib/dashboard-access.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const canEdit=isDashboardOwner(request,env);
  return Response.json({canEdit,canManageWorkbook:canEdit},
    {headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
}
