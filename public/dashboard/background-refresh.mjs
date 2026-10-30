// Background updates must never compete with reading, editing or navigation.
export function canRefreshInBackground({hidden=false,busy=false,drafts=false,localSource=false,scrollY=0,editing=false,expanded=false}={}){
 return !hidden&&!busy&&!drafts&&!localSource&&!editing&&!expanded&&scrollY<=64;
}
export function sameSnapshot(previous,next){
 return previous!==null&&previous!==undefined&&JSON.stringify(previous)===JSON.stringify(next);
}
