import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(){
 const configured=!!env.OPENAI_API_KEY&&!!env.OPENAI_MODEL;
 return Response.json({configured,mode:'cloud',dailyCareer:true,dailyNews:true,researchTime:'7 AM Pacific',maxDailyAttemptsPerTask:Math.max(1,Math.min(10,Number(env.AI_MAX_DAILY_RUNS)||3)),onDemandReason:configured?'':'Paid on-demand AI is off here. Use ChatGPT for AI research; the morning ChatGPT task and direct source searches remain available.'},{headers:{'Cache-Control':'private, no-store'}});
}
