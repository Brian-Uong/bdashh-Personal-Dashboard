import test from 'node:test';
import assert from 'node:assert/strict';
import {collectBrowserPreferences,validateBrowserBackup} from '../public/dashboard/migration-data.mjs';
test('migration export whitelists preferences and excludes credentials and unrelated app state',()=>{
 const raw=new Map([['token','secret'],['brians-dash-career-board-v1','{"job-1":{"saved":true}}'],['brians-dash-motion','off'],['brians-dash-fc-trading-v1','{"budget":100000,"roi":10,"share":100}']]);
 const data=collectBrowserPreferences({getItem:key=>raw.get(key)??null});assert.equal(data.token,undefined);
 assert.deepEqual(validateBrowserBackup({format:'brians-dash-migration',version:1,browserPreferences:data}),data);
});
test('browser restore rejects unknown keys, malformed data and unsupported versions before applying anything',()=>{
 const base={format:'brians-dash-migration',version:1};
 for(const browserPreferences of [{token:'secret'},{'brians-dash-motion':'invalid'},{'brians-dash-home-v1':'null'},{'brians-dash-radio-v1':'not json'}])assert.throws(()=>validateBrowserBackup({...base,browserPreferences}));
 assert.throws(()=>validateBrowserBackup({...base,version:2,browserPreferences:{}}));
});
