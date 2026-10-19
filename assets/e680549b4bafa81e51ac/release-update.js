import { RELEASE } from '/assets/e680549b4bafa81e51ac/release-meta.js';
export function watchRelease(h) {
    let checking = false, reloading = false, lastActivity = Date.now(), next;
    let timer;
    const touch = () => { lastActivity = Date.now(); };
    document.addEventListener('input', touch);
    document.addEventListener('pointerdown', touch);
    function notice() { let box = document.getElementById('release-update'); if (!box) {
        box = document.createElement('div');
        box.id = 'release-update';
        box.className = 'release-update';
        box.setAttribute('role', 'status');
        document.body.append(box);
    } box.textContent = '新版已準備好，將在目前操作結束後更新。草稿保留於此帳號，不會重送交易。'; }
    async function check() {
        if (checking || reloading)
            return;
        checking = true;
        try {
            const r = await fetch('/version.json', { cache: 'no-store', credentials: 'same-origin' });
            if (!r.ok)
                return;
            const v = await r.json();
            if (typeof v.releaseId !== 'string' || v.releaseId === RELEASE.releaseId)
                return;
            next = v.releaseId;
            h.saveDrafts();
            if (h.busy() || Date.now() - lastActivity < 15000) {
                notice();
                return;
            }
            // At most one automatic reload per target release in this tab, including stale proxy HTML.
            const key = 'cx2-auto-reload:' + next;
            if (sessionStorage.getItem(key)) {
                notice();
                return;
            }
            await h.flush();
            if (h.busy())
                return;
            sessionStorage.setItem(key, '1');
            reloading = true;
            location.reload();
        }
        catch { /* Offline/current page stays usable. No empty app replacement. */ }
        finally {
            checking = false;
        }
    }
    window.addEventListener('focus', () => void check());
    timer = setInterval(() => void check(), 30000);
    setTimeout(() => void check(), 1000);
    return () => { clearInterval(timer); document.removeEventListener('input', touch); document.removeEventListener('pointerdown', touch); };
}
