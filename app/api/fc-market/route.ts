export const dynamic='force-dynamic';
// Compatibility response for old clients. The retired feature cannot fetch or write data.
const retired=()=>Response.json({error:'FC27 trading has been removed.',code:'FC_MARKET_REMOVED'},{status:410,headers:{'Cache-Control':'no-store'}});
export const GET=retired;
export const POST=retired;
