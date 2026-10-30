// This Worker has no storage or credentials. Dashboard access is checked at bdashh.com.
export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.hostname !== 'www.bdashh.com') return new Response('Unknown host', {status: 403});
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405});
    url.protocol = 'https:';
    url.hostname = 'bdashh.com';
    url.port = '';
    return new Response(null, {status: 308, headers: {Location: url.href, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex'}});
  }
};
