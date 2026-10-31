import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('../wrangler.json',import.meta.url),'utf8'));
const status=JSON.parse(await readFile(new URL('../migration-status.json',import.meta.url),'utf8'));
const manifest=(await import('../worker/assets-manifest.mjs')).default;
const preview=process.argv.includes('--preview');
const selected=preview?{...config,...config.env?.preview}:config;
const errors=[];
if(config.assets)errors.push('Website files must be served from private R2 through the verified gateway.');
if(!config.r2_buckets?.some(b=>b.binding==='ASSET_BUCKET'&&b.bucket_name==='bdashh-private-assets'))errors.push('Configure private website storage.');
if(config.workers_dev!==false||config.preview_urls!==false)errors.push('Public alternate URLs must stay disabled.');
if(config.vars?.APP_HOSTNAME!=='bdashh.com')errors.push('This project is exclusively for bdashh.com.');
if(process.argv.includes('--production')){
  const workspace=JSON.parse(await readFile(new URL('../workspace-status.json',import.meta.url),'utf8'));
  if(workspace.publishAuthorized!==true)errors.push('This is the development workspace. Publishing requires Brian’s explicit release request and a fresh source comparison.');
  if(selected.vars?.PUBLIC_READ_ONLY==='true'&&(preview||status.public_access?.authorized!==true))errors.push('Public viewing requires explicit owner authorization and is disabled on preview.');
  if(!preview&&status.ai_activation?.state==='paused_by_owner'&&selected.vars?.OPENAI_MODEL)errors.push('Paid AI must stay paused until the owner requests reactivation.');
  for(const key of ['DASHBOARD_OWNER_EMAIL','ACCESS_TEAM_DOMAIN','ACCESS_AUD'])if(!selected.vars?.[key])errors.push('Configure '+key+'.');
  if(!status.source_reconciled)errors.push('Reconcile the source with the owner-approved version before launch.');
  if(status.release_policy?.approved_source_commit!==status.reconciled_source_commit)errors.push('The source must match the version explicitly approved for this website.');
  if(!status.data_migrated)errors.push('Import and verify your private data before launch.');
  if(!status.assets_uploaded)errors.push('Upload and verify this release\'s private website files before launch.');
  if(status.asset_release!==manifest.release)errors.push('The generated website release differs from the verified uploaded release.');
  if(preview){
    if(selected.vars?.APP_HOSTNAME!=='preview.bdashh.com'||!status.preview?.data_migrated)errors.push('Configure the isolated preview and import its data.');
  }else{
    if(!status.preview?.private_access_verified||!status.preview?.save_readback_verified)errors.push('Verify preview owner login and a save/readback before the main domain cutover.');
    const aiDeferred=status.ai_activation_deferred_by_owner===true;
    if(!status.live_ai_verified&&!status.preview?.live_ai_verified&&!aiDeferred)errors.push('Verify live AI research or record the owner\'s explicit decision to defer AI.');
    const controlled=selected.vars?.OWNER_CONTROLS_ENABLED==='true'&&status.owner_controls?.authorized===true;
    if(aiDeferred&&(selected.vars?.ENABLE_DAILY_BRIEFING!=='false'||selected.vars?.ENABLE_DAILY_CAREER!=='false'||(!controlled&&selected.triggers?.crons?.length)))errors.push('AI schedules must stay disabled while activation is deferred.');
    if(selected.vars?.OWNER_CONTROLS_ENABLED==='true'&&!controlled)errors.push('Website controls require explicit owner authorization.');
    if(!status.main_domain_cutover_approved)errors.push('Main-domain cutover requires approval after live verification.');
  }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Private deployment configuration checks passed.');
