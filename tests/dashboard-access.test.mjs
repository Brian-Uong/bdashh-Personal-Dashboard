import test from 'node:test';
import assert from 'node:assert/strict';
import {isDashboardOwner,requireDashboardWrite,grantVerifiedOwner,isDashboardService} from '../lib/dashboard-access.mjs';
const request=(headers={})=>new Request('https://bdashh.com/api/sync',{method:'POST',headers});
test('old ChatGPT identity and service headers never grant standalone access',()=>{
  for(const headers of [{},{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'brian@example.test'},{'X-Dashboard-Service-Authorization':'Bearer old-token'}]){
    const req=request(headers);assert.equal(isDashboardOwner(req),false);assert.equal(isDashboardService(req),false);assert.equal(requireDashboardWrite(req).status,403);
  }
});
test('verified request identity is scoped to that request and cross-origin writes fail',()=>{
  const req=request();grantVerifiedOwner(req);assert.equal(requireDashboardWrite(req),null);
  assert.equal(requireDashboardWrite(request()).status,403);
  const cross=request({Origin:'https://evil.example'});grantVerifiedOwner(cross);assert.equal(requireDashboardWrite(cross).status,403);
});
