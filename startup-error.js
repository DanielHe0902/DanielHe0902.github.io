import { RELEASE } from './release-meta.js';
export class StartupError extends Error {
    stage;
    constructor(stage, cause) {
        super(cause instanceof Error ? cause.message : String(cause), { cause });
        this.stage = stage;
        this.name = 'StartupError';
    }
}
export function startupProblem(error) {
    const stage = error instanceof StartupError ? error.stage : 'migration';
    const cause = error instanceof StartupError ? error.cause : error;
    const name = cause instanceof Error ? cause.name : 'Error';
    const message = cause instanceof Error ? cause.message : String(cause);
    const locations = cause instanceof Error ? [...new Set(cause.stack?.match(/[a-z][a-z0-9-]*\.js:\d+:\d+/gi) ?? [])].slice(0, 6) : [];
    const access = ['SecurityError', 'NotAllowedError'].includes(name);
    const quota = name === 'QuotaExceededError';
    const busy = ['AbortError', 'UnknownError', 'TimeoutError', 'BlockedError', 'InvalidStateError'].includes(name) && stage !== 'migration';
    return { stage, name, message, locations, code: 'STARTUP-' + stage.toUpperCase() + '-' + name,
        title: access ? '瀏覽器暫未允許儲存資料' : quota ? '瀏覽器儲存空間不足' : busy ? '暫時無法讀取資料' : stage === 'migration' ? '資料升級未完成' : '資料暫時無法載入',
        advice: access ? '請在一般瀏覽器視窗開啟本站，並檢查本站的網站資料設定，再重試。' : quota ? '請先釋放裝置空間，再重試。請勿刪除本站資料。' : busy ? '可先重試；若仍失敗，關閉本站的其他分頁後再試。' : '這可能是舊資料相容或程式問題，並不表示你未允許瀏覽器儲存。',
        canSeparate: !access && !quota,
    };
}
/** A failure never deletes or replaces the original space. Retry stays in it. */
export function waitForStartupRetry(error, space) {
    const p = startupProblem(error), root = document.querySelector('#app');
    root.innerHTML = '<main class="workspace"><section class="panel" data-trip-state="error" role="alert"><p>國泰有期 · Cathay Connects</p><h1 id="startup-title"></h1><p id="startup-advice"></p><p>原有資料會保留。尚未產生新交易。</p><button class="button" id="startup-retry">保留資料並重試</button><details style="margin-top:24px"><summary>查看故障資訊</summary><p>可將以下資訊提供給開發者排查；不包含帳號、餘額或交易內容。</p><pre id="startup-diagnostic" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></details><div id="startup-separate" style="margin-top:24px"></div></section></main>';
    root.querySelector('#startup-title').textContent = p.title;
    root.querySelector('#startup-advice').textContent = p.advice;
    // Exception messages may contain application values. Display classification only.
    root.querySelector('#startup-diagnostic').textContent = [p.code, '版本：' + RELEASE.buildVersion, ...p.locations].join('\n');
    if (space && p.canSeparate) {
        const area = root.querySelector('#startup-separate'), note = document.createElement('p'), link = document.createElement('a');
        note.textContent = '可另開獨立資料空間繼續。原有記錄會保留。';
        const url = new URL('/', location.href);
        url.searchParams.set('space', crypto.randomUUID());
        const account = new URLSearchParams(location.search).get('account');
        if (account)
            url.searchParams.set('account', account);
        link.href = url.href;
        link.className = 'button secondary';
        link.textContent = '另開獨立資料空間';
        link.target = '_blank';
        link.rel = 'noopener';
        area.append(note, link);
    }
    return new Promise(resolve => root.querySelector('#startup-retry').addEventListener('click', () => resolve(), { once: true }));
}
