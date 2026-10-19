import { brandLockup } from './brand-ui.js';
import * as R from './reminders.js';
import { DemoStorage, readExistingSpace } from './demo-store.js';
import * as S from './sharing.js';
import * as M from './demo.js';
import { availableMiles } from './fund.js';
import { esc } from './ui.js';
/** Controlled demo login, deliberately separate from the two primary demo accounts. */
export async function runLinkLanding() {
    const match = location.pathname.match(/^\/(join|fund-share)\/([a-f0-9]{64})$/);
    if (!match)
        return false;
    const root = document.getElementById('app') ?? document.querySelector('main') ?? document.body, kind = match[1] === 'join' ? 'family' : 'fund', token = match[2], space = new URLSearchParams(location.search).get('space') ?? '', authKey = 'cx2-link-login:' + space + ':' + token;
    let state = null, storage, accountId = sessionStorage.getItem(authKey) ?? '', draft, error = '', busy = false;
    const shell = (body) => { root.innerHTML = `<header class="business-header">${brandLockup(false)}</header><main class="link-landing"><section class="panel"><p class="context-label">受邀連結</p>${body}<p class="error" role="alert">${esc(error)}</p></section></main>`; };
    const write = async (fn) => { if (!storage)
        throw Error('沒有可存取的資料空間'); state = await storage.write(s => { S.validLink(s, token, kind); return fn(s); }); };
    const act = (fn) => { if (busy)
        return; busy = true; error = ''; void fn().catch(e => { error = e.message; }).finally(() => { busy = false; render(); }); };
    function render() {
        if (!state)
            return;
        shell('');
        let preview;
        try {
            preview = S.linkPreview(state, token, kind);
        }
        catch (e) {
            shell(`<h1>連結無法繼續使用</h1><p>${esc(e.message)}</p><p>請聯絡建立連結的人取得有效連結。本次沒有新增成員關係或扣除里數。</p>`);
            return;
        }
        const a = S.linkAccount(state, accountId);
        const intro = `<h1>${preview.title}</h1><p>${esc(preview.scope)}</p>${kind === 'family' ? `<p>家庭：${esc(preview.family ?? '受邀家庭')} · 邀請人：${preview.inviter} · 角色：${preview.role}</p>` : `<p>受益對象：${preview.beneficiary} · ${preview.route}</p><p>${preview.from} — ${preview.until} · 目標 ${preview.target?.toLocaleString('en-US')} 里數</p>`}`;
        if (!a) {
            shell(intro + `<h2>先登入帳號</h2><p>持有連結不表示已登入、已加入家庭或同意資助。</p><label class="field"><span>已有帳號</span><select id="link-login"><option value="demo-parent">林志明 · 家長</option><option value="demo-student">林晴 · 學生</option></select></label><button class="button" id="link-login-button">登入並返回此邀請</button><hr><h2>受邀者註冊／登入</h2><label class="field"><span>登入名稱（用於再次登入同一帳號）</span><input id="link-alias" placeholder="設定登入名稱" autocomplete="off"></label><label class="field"><span>顯示名稱</span><input id="link-name" maxlength="30"></label><label class="check"><input id="link-register-agree" type="checkbox">我已閱讀並同意建立帳號。</label><button class="button secondary" id="link-register">完成註冊／登入</button>`);
            document.getElementById('link-login-button').onclick = () => act(async () => { accountId = document.getElementById('link-login').value; await write(s => S.authenticateLink(s, token, kind, accountId)); sessionStorage.setItem(authKey, accountId); });
            document.getElementById('link-register').onclick = () => act(async () => { if (!document.getElementById('link-register-agree').checked)
                throw Error('請先確認建立帳號'); const alias = document.getElementById('link-alias').value, name = document.getElementById('link-name').value; await write(s => { const user = S.registerLinkIdentity(s, alias, name); accountId = user.accountId; return S.authenticateLink(s, token, kind, accountId); }); sessionStorage.setItem(authKey, accountId); });
            return;
        }
        const viewer = { ...state, actorId: a.personId, activeAccountId: a.accountId }, l = state.shareLinks[token], accepted = l.acceptedBy === a.personId, member = state.memberships.some(m => m.personId === a.personId && m.familyId === l.targetId && m.active);
        let body = intro + `<p>目前帳號：<strong>${esc(state.persons[a.personId].name)}</strong></p><button class="text-link" id="link-logout">切換受邀者</button>`;
        if (kind === 'family')
            body += member ? '<h2>你已加入此家庭</h2><p>已加入 ' + esc(preview.family ?? '此家庭') + '。實際同行、照護及里數授權須另行確認。</p>' : `${accepted ? '<p class="notice">此邀請已使用。若已離開家庭，請向管理員取得新的邀請連結。</p>' : '<label class="check"><input type="checkbox" id="link-accept-agree">我已核對家庭、邀請人及角色，明確接受此家庭邀請。</label><button class="button" id="link-accept">接受家庭邀請</button>'}`;
        else {
            const txs = Object.values(state.dual.transactions).filter(t => t.accountId === a.accountId && t.fundId === l.targetId);
            body += `<h2>本人的支持</h2><p>本人可用普通里數 <strong data-link-balance>${availableMiles(state, a.personId).toLocaleString('en-US')}</strong>；不包含學生或其他人的餘額。</p><label class="field"><span>支持里數（100 的倍數）</span><input id="link-amount" inputmode="numeric" value="1000"></label><button class="button secondary" id="link-preview">預覽支持</button>${draft ? `<div class="notice"><h3>確認目標及金額</h3><p>${draft.amount.toLocaleString('en-US')} 里數 → 此學生 ${preview.route} 的受限基金。本人餘額 ${draft.available.toLocaleString('en-US')} → ${(draft.available - draft.amount).toLocaleString('en-US')}。</p><label class="check"><input type="checkbox" id="link-support-agree">我已核對受益人、目標與里數，確認提供這筆支持。</label><button class="button" id="link-confirm">確認支持</button></div>` : ''}<div>${txs.map(t => `<article class="share-row"><strong>${t.amount.toLocaleString('en-US')} 里數 · ${t.status === 'confirmed' ? '已入帳' : t.status === 'pending' ? '處理中' : t.status === 'unknown' ? '結果待核實' : '未完成'}</strong><p>${esc(t.id)}</p><small>${esc(t.reason ?? '')}</small>${t.status === 'unknown' ? `<button class="button secondary" data-link-query="${t.id}">查詢原交易</button>` : ''}${t.status === 'failed' ? `<button class="button secondary" data-link-retry="${t.id}">重試原交易</button>` : ''}</article>`).join('')}</div>`;
        }
        if (kind === 'fund' && state.festivalInvited?.[l.targetId]?.includes(a.personId))
            body += '<h2>由我選擇提醒</h2>' + R.FESTIVALS.map(node => `<label class="check"><input type="checkbox" data-link-subscribe="${node.id}" ${state.subscriptions?.[a.personId + ':' + l.targetId + ':' + node.id]?.active ? 'checked' : ''}>提醒我：${node.name}（提前 14／7 天）</label>`).join('') + '<p>開啟網站時檢查提醒；可隨時取消，不會自動提供支持。</p>' + R.visibleReminders(viewer, true).filter(r => r.fundId === l.targetId && r.status === 'sent').map(r => '<p>' + esc(r.title) + ' · ' + esc(r.node) + ' · ' + esc(r.body) + '</p>').join('');
        shell(body);
        document.querySelectorAll('[data-link-subscribe]').forEach(el => el.onchange = () => act(async () => { await write(s => { S.authenticateLink(s, token, kind, accountId); return R.subscribeFestival(s, el.dataset.linkSubscribe, el.checked); }); }));
        document.getElementById('link-logout').onclick = () => { accountId = ''; draft = undefined; sessionStorage.removeItem(authKey); render(); };
        const accept = document.getElementById('link-accept');
        if (accept)
            accept.onclick = () => act(async () => { const agree = document.getElementById('link-accept-agree').checked; await write(s => S.acceptFamilyLink(s, token, accountId, agree)); });
        const pre = document.getElementById('link-preview');
        if (pre)
            pre.onclick = () => act(async () => { const raw = document.getElementById('link-amount').value; await write(s => S.authorizeFundLink(s, token, accountId)); draft = M.supportPreview({ ...state, actorId: a.personId, activeAccountId: a.accountId }, raw); });
        const confirm = document.getElementById('link-confirm');
        if (confirm)
            confirm.onclick = () => act(async () => { if (!document.getElementById('link-support-agree').checked)
                throw Error('請先核對並確認支持'); const bound = draft; await write(s => { S.authorizeFundLink(s, token, accountId); return M.confirmSupport(s, bound); }); draft = undefined; });
        document.querySelectorAll('[data-link-query]').forEach(el => el.onclick = () => act(async () => { await write(s => { S.authenticateLink(s, token, kind, accountId); return M.settleSupport(s, el.dataset.linkQuery, true); }); }));
        document.querySelectorAll('[data-link-retry]').forEach(el => el.onclick = () => act(async () => { await write(s => { S.authenticateLink(s, token, kind, accountId); return M.retrySupport(s, el.dataset.linkRetry); }); }));
    }
    shell('<h1>正在核對受邀連結</h1>');
    try {
        state = await readExistingSpace(space);
        if (!state) {
            shell('<h1>此裝置無法讀取原有資料</h1><p>目前連結依賴同一瀏覽器、同一網站的本地資料。新裝置或無痕視窗沒有原目標，不能建立成員關係或提供支持。請在建立連結的同一瀏覽器開啟新標籤。</p>');
            return true;
        }
        storage = new DemoStorage(space);
        state = await storage.open(state);
        state.demoSpaceId = space;
        render();
        const editing = () => !!document.activeElement?.matches('input,select,textarea');
        storage.onChange = () => { if (busy || editing())
            return; void storage.read().then(s => { state = s; render(); }); };
        setInterval(() => { if (!busy && !editing())
            void storage.settle().then(async (changed) => { if (changed) {
                state = await storage.read();
                render();
            } }); }, 700);
    }
    catch (e) {
        error = e.message;
        shell('<h1>無法讀取受邀連結</h1><p>尚未進行任何會員或里數操作。</p>');
    }
    return true;
}
