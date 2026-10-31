import {websiteControlsPreview} from '../../../lib/website-controls-preview.mjs';
export const dynamic='force-dynamic';
// This host displays the production controls without reading or changing settings.
export function GET(){return new Response(websiteControlsPreview,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}
export function HEAD(){return new Response(null,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}
export function POST(){return Response.json({error:'Website controls are previews on this dashboard.',code:'WORKSPACE_PREVIEW_ONLY'},{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'no-store'}});}
