import {readFile} from 'node:fs/promises';
import {assertReleaseReady} from './release-files.mjs';
try{
  const status=JSON.parse(await readFile(new URL('../migration-status.json',import.meta.url),'utf8'));
  const source=assertReleaseReady(status);
  console.log(`Release source verified: v${source.version}, ${source.commit}.`);
}catch(error){console.error(error.message);process.exitCode=1;}
