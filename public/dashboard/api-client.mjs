// Relative URLs keep the UI on the current Site or custom domain. Never put
// updater credentials here: this module runs in visitors' browsers.
export async function apiFetch(path, options = {}) {
  if (typeof path !== 'string' || !path.startsWith('/api/') || /[\\\r\n]/.test(path)) {
    throw new Error('Dashboard requests must use a same-origin /api/ path.');
  }
  const {timeoutMs = 30000, ...request} = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
  let response;
  try {
    response = await fetch(path, {...request, signal, cache:'no-store',
      headers: {Accept:'application/json', ...request.headers}});
  } catch (error) {
    if (signal.aborted) throw new Error('The request timed out or was cancelled. A save may have completed; reload saved data before retrying.');
    throw new Error('Could not reach the dashboard. Check your connection and try again.');
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    if (response.status === 401 || response.status === 403 || response.redirected) {
      throw new Error('Your session could not be verified. Sign in again or reload the dashboard.');
    }
    throw new Error(`The server returned an unexpected response (${response.status}). Your saved data has been retained.`);
  }
  return response;
}
