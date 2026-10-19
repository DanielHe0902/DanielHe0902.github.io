let publicSession = '';
function publicBase() { return typeof document === 'undefined' ? '' : document.querySelector('meta[name="cx-api-base"]')?.content ?? ''; }
export function apiFetch(path, init = {}, fetcher = globalThis.fetch.bind(globalThis)) {
    const base = publicBase();
    if (!base)
        return fetcher(path, init);
    if (base !== 'https://cx2-demo.v1r9o.chatgpt.site/public-api' || !path.startsWith('/api/'))
        throw Error('Invalid demo API endpoint');
    if (!publicSession) {
        try {
            publicSession = sessionStorage.getItem('cx-public-api-session') ?? '';
        }
        catch { /* Storage is optional. */ }
        if (!/^[a-f0-9]{32}$/.test(publicSession)) {
            publicSession = crypto.randomUUID().replaceAll('-', '');
            try {
                sessionStorage.setItem('cx-public-api-session', publicSession);
            }
            catch { /* Keep the in-memory session. */ }
        }
    }
    const headers = new Headers(init.headers);
    headers.set('X-CX-Demo-Session', publicSession);
    return fetcher(base + path.slice(4), { ...init, headers, credentials: 'omit', mode: 'cors' });
}
