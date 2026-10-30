export const dynamic='force-dynamic';
// Fixed provider and bounded coordinates: never accept an arbitrary upstream URL.
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,lat=Number(params.get('lat')),lon=Number(params.get('lon'));
 if(!params.get('lat')||!params.get('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return Response.json({error:'Choose a valid mapped venue.'},{status:400});
 try{
  const query=new URLSearchParams({lat:String(lat),lon:String(lon),radius:'1.5',osm_tag:'amenity:cafe',limit:'10'});
  const response=await fetch('https://photon.komoot.io/reverse?'+query,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)return Response.json({error:'Nearby café search is temporarily unavailable. Use the Google Maps link.'},{status:response.status===429?429:502});
  const data=await response.json() as any;if(!Array.isArray(data.features))throw Error('Invalid provider response');
  return Response.json({type:'FeatureCollection',features:data.features.slice(0,10)},{headers:{'Cache-Control':'private, max-age=300'}});
 }catch{return Response.json({error:'Nearby café search could not finish. Use the Google Maps link or try again later.'},{status:502});}
}
