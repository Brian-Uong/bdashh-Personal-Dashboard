export const dynamic='force-dynamic';
export async function GET(req:Request){
 const q=new URL(req.url).searchParams.get('q')?.trim()||'';
 if(q.length<3||q.length>250)return Response.json({error:'Enter a place name or street address.'},{status:400});
 try{const url='https://photon.komoot.io/api/?'+new URLSearchParams({q,limit:'5',lat:'33.85',lon:'-117.65',lang:'en'});const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('Address provider unavailable');const data=await r.json() as any;const results=(data.features||[]).filter((f:any)=>f.geometry?.coordinates?.length>=2).map((f:any)=>{const p=f.properties||{};return{address:[p.name,[p.housenumber,p.street].filter(Boolean).join(' '),p.city,p.state,p.postcode,p.country].filter(Boolean).join(', '),coordinates:f.geometry.coordinates.slice(0,2)}});return Response.json({results},{headers:{'Cache-Control':'private, max-age=60'}})}catch{return Response.json({error:'Address search is temporarily unavailable. Enter latitude and longitude to place the pin.'},{status:502})}
}
