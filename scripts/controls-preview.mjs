import {ownerControlsPage} from '../lib/owner-controls-page.mjs';
// Derived from the production UI. No production handler or credential is loaded.
export function controlsPreview({standalone=false}={}){
 let html=ownerControlsPage.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
 html=html.replace('OWNER ONLY','WORKSPACE PREVIEW')
  .replace('Each switch saves immediately—no deployment needed.','These switches are disabled in the workspace. They work on the live website after an authorized release.')
  .replace('id="visibility-value">Loading…','id="visibility-value">Preview only · Live privacy setting is not loaded')
  .replace('id="ai-value">Loading…','id="ai-value">Preview only · No API requests can run here')
  .replace('Loading current settings…','All three controls are included in the source. Live settings and secrets stay on the online server.')
  .replace('Saved content is preserved','Development workspace · Not published')
  .replace("<title>Website controls · Brian's Dash</title>",'<title>Website controls · Workspace preview</title>');
 if(standalone)html=html.replaceAll('href="/dashboard/"','href="#" aria-disabled="true" onclick="return false"');
 return html;
}
