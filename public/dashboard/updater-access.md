# Brian's Dash: unattended update access

The dashboard is read-only for visitors. Owner browser sessions are authorized
using the trusted identity supplied by Sites. Scheduled cloud updates use the
Site's service credential, without a browser or a signed-in visitor.

Daily briefings and opportunity research are authorized whether the Site is
public or private. Do not require owner-private access or change the audience.
Public visibility permits reading saved data; it does not authorize writes.
Confirm the linked Site identity and owner access, then authenticate writes as
below. If authentication fails, preserve the last saved data and report the
failure instead of changing sharing or disabling the schedule.

1. Read the linked Site with Sites `get_site` and obtain its current
   `siwc_bypass_bearer_token`. Never print or save the value in source or prompts.
2. For requests to this Site only, send that value as `Bearer <token>` in BOTH
   `OAI-Sites-Authorization` and `X-Dashboard-Service-Authorization`.
   The first header is consumed by Sites dispatch; the second authorizes the
   dashboard's write endpoint. Never forward either header to research sources.
3. Read the saved data, perform the scheduled research, and use the existing
   `/api/sync`, `/api/discovery`, `/api/research`, `/api/records`, or quote refresh
   endpoint as appropriate. Preserve manually entered holdings and records.
4. Read back the saved result. Normal updates do not require deployment.

A 403 with `DASHBOARD_OWNER_REQUIRED` means the second header is missing or the
credential does not match. Retry with both headers. If the Site service credential
was rotated, the owner must update the `DASHBOARD_SERVICE_TOKEN` runtime secret
through Sites and redeploy. Never loosen authorization or change the audience.

The existing 7 a.m. America/Los_Angeles briefing schedule remains in place.
