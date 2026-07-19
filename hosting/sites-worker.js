function assetRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}

async function firstAvailableAsset(env, request, candidates) {
  for (const candidate of candidates) {
    const response = await env.ASSETS.fetch(assetRequest(request, candidate));
    if (response.status !== 404) {
      return response;
    }
  }
  return null;
}

export default {
  async fetch(request, env) {
    const direct = await env.ASSETS.fetch(request);
    if (direct.status !== 404 || !['GET', 'HEAD'].includes(request.method)) {
      return direct;
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/$/, '') || '/';
    const candidates = [];

    if (pathname === '/') {
      candidates.push('/index.html');
    } else if (!pathname.split('/').pop()?.includes('.')) {
      candidates.push(`${pathname}.html`);
    }

    if (/^\/bathroom\/[^/]+$/.test(pathname)) {
      candidates.push('/bathroom/[id].html');
    }
    candidates.push('/+not-found.html');

    return (await firstAvailableAsset(env, request, candidates)) ?? direct;
  },
};
