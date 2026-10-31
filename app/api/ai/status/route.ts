export const dynamic='force-dynamic';
export async function GET(){return Response.json({configured:false,mode:'cloud',dailyCareer:true,researchTime:'7 AM Pacific',onDemandReason:'On-demand OpenAI API search is not configured on this hosted workspace. Morning ChatGPT research updates saved results.'},{headers:{'Cache-Control':'private, no-store'}});}
