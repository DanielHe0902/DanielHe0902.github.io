import { displayName } from '/assets/b53849a26298fd713aba/identity.js';
import { buildItinerary, validateTrip } from '/assets/b53849a26298fd713aba/web/travel.js';
const acc = (s, p) => Object.values(s.accounts).find(a => a.personId === p);
const amount = (n) => Number.isInteger(n) && n >= 100 && n <= 1000000 && n % 100 === 0;
const fail = (text) => { throw Error(text); };
const next = (s, p) => p + '-' + (++s.counter);
const ledger = (s, p, n, key, kind) => { const a = acc(s, p); if (!a)
    fail('請先建立帳號。'); if (!s.ledger.some(l => l.key === key))
    s.ledger.push({ id: next(s, 'ledger'), memberId: a.id, amount: n, key, kind, at: s.demoClock, qualifying: false }); };
export const ownMiles = (s, p) => s.ledger.filter(l => l.memberId === acc(s, p)?.id).reduce((n, l) => n + l.amount, 0);
export const availableMiles = (s, p) => ownMiles(s, p) - Object.values(s.supports).filter(c => c.personId === p && c.source === 'miles' && c.status === 'pending').reduce((n, c) => n + c.amount, 0);
export const canSeeFund = (s, f) => f.ownerId === s.actorId || f.invited.includes(s.actorId);
export const fundsFor = (s) => Object.values(s.funds).filter(f => canSeeFund(s, f));
export function fundTotals(s, f) { const list = Object.values(s.supports).filter(c => c.fundId === f.id); const sum = (status) => list.filter(c => c.status === status).reduce((n, c) => n + c.amount, 0); return { intent: sum('intent'), pending: sum('pending'), confirmed: sum('confirmed'), available: Math.max(0, sum('confirmed') - (f.redemption?.miles ?? 0)), refunding: sum('refundPending'), refunded: sum('refunded') }; }
export function fundQuote(f, date = f.from) { const route = buildItinerary({ origin: f.origin, destination: f.destination, date, budget: 300000 }); return { route, miles: route.durationMinutes > 360 ? 30000 : 12000, tax: 680, bags: 1 }; }
export function matchingFund(s, p) { return Object.values(s.funds).find(f => f.ownerId === s.actorId && f.status === 'open' && f.origin === p.origin && f.destination === p.destination && p.departure >= f.from && p.departure <= f.until); }
export function publicFund(f, s) { return { title: f.title, student: displayName(s.persons[f.ownerId]), origin: f.origin, destination: f.destination, from: f.from, until: f.until, target: f.target, token: f.token }; }
export function initFunds(s, withExample = false) {
    s.funds ??= {};
    s.supports ??= {};
    s.milestones ??= {};
    if (!s.persons.supporter)
        s.persons.supporter = { id: 'supporter', name: '沈外婆', nickname: '外婆', dob: '1958-06-16', guardianIds: [] };
    if (withExample && s.persons.student) {
        const f = { id: 'home-seed', ownerId: 'student', title: '晴晴的春节回家基金', origin: 'LHR', destination: 'HKG', from: '2028-01-28', until: '2028-02-10', target: 30000, token: crypto.randomUUID(), invited: ['lin', 'father', 'mother', 'grandma', 'supporter'], status: 'open', inventory: true, landingConsent: false, landed: false, redemption: null, reminders: {} };
        s.funds[f.id] = f;
        for (const [p, n] of [['mother', 8000], ['father', 4000]]) {
            const id = 'seed-support-' + p;
            ledger(s, p, n, 'fund-example-topup-' + p, 'opening');
            ledger(s, p, -n, 'support-' + id, 'fund');
            s.supports[id] = { id, fundId: f.id, personId: p, amount: n, source: 'miles', status: 'confirmed', attempt: 1, subscribed: false, at: s.demoClock };
        }
    }
}
function requireFund(s, id) { const f = s.funds[id]; if (!f || !canSeeFund(s, f))
    fail('此身份没有该基金的邀请或访问权限。'); return f; }
function requireOwner(s, f) { if (f.ownerId !== s.actorId)
    fail('请由学生本人操作回家基金。'); }
function send(s, c) { const f = requireFund(s, c.fundId); if (c.personId !== s.actorId || !acc(s, s.actorId))
    fail('出资须由已注册的本人确认。'); if (f.status !== 'open')
    fail('基金已关闭，不能继续出资。'); if (['pending', 'confirmed', 'refundPending', 'refunded'].includes(c.status))
    return; if (c.source === 'miles' && c.amount > availableMiles(s, c.personId))
    fail('个人可用里数不足；待入账出资已预留，不能重复使用。'); c.status = 'pending'; c.attempt++; }
export function reduceFund(input, a) {
    const s = structuredClone(input);
    initFunds(s);
    if (s.dual && 'fundId' in a && a.fundId === 'lin-home-2027')
        fail('請在回家基金中核對並確認支持。');
    if (a.type === 'fundCreate') {
        if (!acc(s, s.actorId))
            fail('建立回家基金需要先登入帳號。');
        if (!amount(a.target) || a.target < 1000)
            fail('目标须为 1,000–1,000,000 里，按 100 里递增。');
        validateTrip({ origin: a.origin, destination: a.destination, date: a.from, budget: 300000 });
        validateTrip({ origin: a.origin, destination: a.destination, date: a.until, budget: 300000 });
        if (a.from > a.until || a.from < s.demoClock.slice(0, 10))
            fail('请设置未来且顺序正确的返乡窗口。');
        if (!a.title.trim() || a.title.length > 50)
            fail('请填写 1–50 字的基金名称。');
        const id = next(s, 'fund');
        s.funds[id] = { id, ownerId: s.actorId, title: a.title.trim(), origin: a.origin, destination: a.destination, from: a.from, until: a.until, target: a.target, token: crypto.randomUUID(), invited: [], status: 'open', inventory: true, landingConsent: false, landed: false, redemption: null, reminders: {} };
        return s;
    }
    if (a.type === 'fundReceipt') {
        const c = s.supports[a.supportId];
        if (a.epoch !== s.epoch || !c || c.status !== 'pending' || c.attempt !== a.attempt)
            return s;
        const f = s.funds[c.fundId];
        if (f.status !== 'open') {
            c.status = 'failed';
            return s;
        }
        if (!a.success) {
            c.status = 'failed';
            return s;
        }
        if (c.source === 'purchase')
            ledger(s, c.personId, c.amount, 'purchase-' + c.id, 'purchase');
        ledger(s, c.personId, -c.amount, 'support-' + c.id, 'fund');
        c.status = 'confirmed';
        return s;
    }
    if (a.type === 'fundRetry' || a.type === 'fundSubscribe') {
        const c = s.supports[a.supportId];
        if (!c)
            fail('出资记录不存在。');
        requireFund(s, c.fundId);
        if (c.personId !== s.actorId)
            fail('只能管理本人的支持记录。');
        if (a.type === 'fundSubscribe') {
            c.subscribed = a.value;
            return s;
        }
        send(s, c);
        return s;
    }
    const f = requireFund(s, a.fundId);
    switch (a.type) {
        case 'fundSupport': {
            if (!acc(s, s.actorId) || !a.consent)
                fail('請先登入並確認支持用途。');
            if (f.ownerId === s.actorId)
                fail('此处用于亲友支持；本人里数仍独立显示。');
            if (f.status !== 'open')
                fail('基金已关闭。');
            if (!amount(a.amount) || a.amount > 50000)
                fail('每次支持 100–50,000 里，按 100 里递增。');
            if (Object.values(s.supports).some(c => c.fundId === f.id && c.personId === s.actorId && c.status === 'pending'))
                fail('已有出资正在处理，请等待原回执。');
            const id = next(s, 'support');
            const c = { id, fundId: f.id, personId: s.actorId, amount: a.amount, source: a.source, status: 'intent', attempt: 0, subscribed: false, at: s.demoClock };
            s.supports[id] = c;
            if (!a.intent)
                send(s, c);
            break;
        }
        case 'fundInvite':
            requireOwner(s, f);
            if (!s.persons[a.personId] || a.personId === f.ownerId)
                fail('請選擇親友帳號。');
            if (!f.invited.includes(a.personId))
                f.invited.push(a.personId);
            break;
        case 'fundSetting':
            requireOwner(s, f);
            f[a.key] = a.value;
            break;
        case 'fundReminder':
            requireOwner(s, f);
            if (!['春节', '中秋', '生日'].includes(a.occasion))
                fail('提醒类型不支持。');
            f.reminders[a.occasion] = a.enabled;
            break;
        case 'fundRedeem': {
            requireOwner(s, f);
            if (f.redemption)
                break;
            if (f.status !== 'open' || !a.confirmed || !a.taxAccepted)
                fail('需要本人确认兑换方案及税费。');
            if (!acc(s, f.ownerId)?.studentVerified)
                fail('請先核對學生身份。');
            if (a.date < f.from || a.date > f.until)
                fail('兑换日期不在授权的返乡窗口。');
            const q = fundQuote(f, a.date);
            if (!f.inventory)
                fail('目前沒有符合條件的兌換選項，請保留基金並稍後再查。');
            if (fundTotals(s, f).available < q.miles)
                fail('已确认出资不足，意向与待入账金额不能兑换。');
            f.redemption = { id: next(s, 'award'), miles: q.miles, tax: q.tax, date: a.date, flight: q.route.number, at: s.demoClock };
            f.status = 'redeemed';
            break;
        }
        case 'fundCancel':
            requireOwner(s, f);
            if (!a.confirmed)
                fail('请确认取消和退回范围。');
            if (f.redemption)
                fail('兌換安排已記錄，後續變更需人工核實。');
            if (f.status !== 'open')
                break;
            f.status = 'refunding';
            for (const c of Object.values(s.supports).filter(c => c.fundId === f.id)) {
                if (c.status === 'confirmed')
                    c.status = 'refundPending';
                else if (['pending', 'intent'].includes(c.status))
                    c.status = 'failed';
            }
            break;
        case 'fundRefund':
            requireOwner(s, f);
            if (f.status === 'cancelled')
                break;
            if (f.status !== 'refunding' || !a.confirmed)
                fail('请先确认取消，再处理原路退回。');
            for (const c of Object.values(s.supports).filter(c => c.fundId === f.id && c.status === 'refundPending')) {
                ledger(s, c.personId, c.amount, 'refund-' + c.id, 'refund');
                if (c.source === 'purchase')
                    ledger(s, c.personId, -c.amount, 'purchase-refund-' + c.id, 'refund');
                c.status = 'refunded';
            }
            f.status = 'cancelled';
            break;
        case 'fundLand':
            requireOwner(s, f);
            if (!f.redemption || !a.confirmed)
                fail('仅可模拟已兑换旅程的落地事件。');
            f.landed = true;
            break;
    }
    return s;
}
