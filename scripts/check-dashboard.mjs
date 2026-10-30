import {readdir,readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
async function files(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).filter(e=>e.name!=='vendor').map(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
const browser=await files(path.join(root,'public/dashboard'));
for(const file of browser.filter(f=>/\.(mjs|js)$/.test(f))){
 const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
}
for(const file of browser.filter(f=>/\.(mjs|js|html)$/.test(f))){
 const source=await readFile(file,'utf8');
 if(/https?:\/\/brians-dash-uong\.[^\s'"<>]*chatgpt\.site/i.test(source))throw Error(`Hardcoded Site origin in ${path.relative(root,file)}`);
 for(const match of source.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g))await access(path.resolve(path.dirname(file),match[1]));
}
const html=await readFile(path.join(root,'public/dashboard/index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"#]+\.(?:css|js|mjs))"/g))if(!match[1].includes('://'))await access(path.join(root,'public/dashboard',match[1]));
console.log('Browser syntax, module imports, local assets and domain portability passed.');
const tests=(await readdir(path.join(root,'tests'))).filter(f=>f.endsWith('.test.mjs')).map(f=>path.join(root,'tests',f));
const run=spawnSync(process.execPath,['--test','--test-isolation=none',...tests],{stdio:'inherit'});process.exit(run.status??1);
