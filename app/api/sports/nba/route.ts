export const dynamic='force-dynamic';
// Retired clients get a terminal response without accessing providers or storage.
const retired=()=>Response.json({error:'Sports betting has been removed.',code:'SPORTS_BETTING_REMOVED'},{status:410,headers:{'Cache-Control':'no-store'}});
export const GET=retired;
export const POST=retired;
