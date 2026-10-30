import {readFile,writeFile,unlink} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const file=new URL('public/dashboard/index.html',root);
let html=await readFile(file,'utf8');
html=html.replace('/signin-with-chatgpt?return_to=%2Fdashboard%2F','/dashboard/');
html=html.replace('PRIVATE READY','PRIVATE');
html=html.replace('This hosted Site requires your ChatGPT sign-in.','This dashboard requires your private owner sign-in.');
html=html.replace(/<section><h3>2[^<]*Your connected accounts<\/h3>[\s\S]*?<\/section>/,
  '<section><h3>2 — Your connected accounts</h3><p>This dashboard runs independently. Import workbook and positions files here. Email, calendar and brokerage accounts are not connected; any future integrations require their own authorization.</p></section>');
html=html.replace(/<section><h3>3[^<]*Daily stock news &amp; research<\/h3>[\s\S]*?<\/section>/,
  '<section><h3>3 — Daily stock news &amp; research</h3><p>Owner tools includes Refresh news briefing and AI career research. Your server performs live research and saves the results. Scheduled runs are configured separately after launch verification. Reload prices checks market providers separately.</p></section>');
html=html.replace(/<section><h3>3[^<]*Daily stock news & research<\/h3>[\s\S]*?<\/section>/,
  '<section><h3>3 — Daily stock news &amp; research</h3><p>Use Owner tools to refresh news and AI career research. Scheduled updates become available after configuration and testing.</p></section>');
html=html.replace('</body>','<script type="module" src="independent-ai.mjs"></script></body>');
html=html.replace('id="refreshBtn"','id="refreshBtn"');
await writeFile(file,html);
const prefs=new URL('public/dashboard/research-preferences.mjs',root);
let p=await readFile(prefs,'utf8');
p=p.replace('No API key is needed.','Direct public-source refresh requires no AI service. Owner tools also offers broader AI career research when your server is configured.');
p=p.replace('Daily research is scheduled','Research schedule pending configuration').replace('No run result has been recorded here yet.','No independent research result has been recorded here yet.');
await writeFile(prefs,p);
for(const name of ['app/chatgpt-auth.ts','app/globals.css','app/layout.tsx','app/page.tsx','lib/connector-context.ts','lib/connector-contract.mts','lib/connector-errors.mts','lib/connector-preview.d.ts','lib/connectors.ts','public/dashboard/updater-access.md']){
  try{await unlink(new URL(name,root));}catch(e){if(e.code!=='ENOENT')throw e;}
}
