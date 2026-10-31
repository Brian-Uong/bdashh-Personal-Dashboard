import test from 'node:test';
import assert from 'node:assert/strict';
import {isDashboardOwner,requireDashboardWrite} from '../lib/dashboard-access.mjs';
const env={DASHBOARD_OWNER_EMAIL:'owner@example.test',DASHBOARD_SERVICE_TOKEN:'test-service-token'};
const request=(headers={})=>new Request('https://dash.example/api/sync',{method:'POST',headers});
const owner={'oai-authenticated-user-id':'site-owner-id','oai-authenticated-user-email':'owner@example.test'};
test('owner can edit; anonymous and other signed-in visitors cannot',()=>{
  assert.equal(requireDashboardWrite(request(owner),env),null);
  for(const headers of [{},{'oai-authenticated-user-email':'owner@example.test'},{...owner,'oai-authenticated-user-email':'visitor@example.test'}]){
    assert.equal(isDashboardOwner(request(headers),env),false);
    assert.equal(requireDashboardWrite(request(headers),env).status,403);
  }
});
test('service writes require the exact configured secret; service is not a UI owner',()=>{
  const service=request({'X-Dashboard-Service-Authorization':'Bearer test-service-token'});
  assert.equal(requireDashboardWrite(service,env),null);
  assert.equal(isDashboardOwner(service,env),false);
  for(const token of ['','Bearer wrong-token','test-service-token']) assert.equal(requireDashboardWrite(request({'X-Dashboard-Service-Authorization':token}),env).status,403);
  assert.equal(requireDashboardWrite(service,{}).status,403);
});
test('cross-origin writes fail even for an owner or service',()=>{
  assert.equal(requireDashboardWrite(request({...owner,Origin:'https://other.example'}),env).status,403);
  assert.equal(requireDashboardWrite(request({'X-Dashboard-Service-Authorization':'Bearer test-service-token',Origin:'https://other.example'}),env).status,403);
});
