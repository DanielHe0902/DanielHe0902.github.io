import { REQUESTED_TRIP_CLEANUP, needsRequestedCleanup, removeRequestedTrips } from './requested-trip-cleanup.js';
import { repairTripCare, settleServiceJobs } from './service-flow.js';
import { migrateServiceCases, repairAirlineMisroutes } from './service-state.js';
import { deliverFlightChanges, normalizeDisruptionTasks } from './flight-change.js';
import { removeRecordingTrip } from './recording-cleanup.js';
import { installBookingPreferences } from './booking.js';
import { demoOwned, clearRetiredTrips, TRIP_RELEASE, STORAGE_VERSION, updateRuntimeClock } from './runtime.js';
import { runSchedules } from './reminders.js';
import { settleFeedback } from './feedback.js';
import { synchronizeClocks } from './timeline.js';
import { StartupError } from './startup-error.js';
import { settleSupport } from './demo.js';
import { initLearning, settleLearning } from './learning.js';
import { migrateText } from './text-migration.js';
// A single readwrite transaction contains validation, reservation, both journal
// sides, and notification. Broadcasts carry invalidation only, never money.
const DB = 'cx2-demo-spaces-v1', TABLE = 'spaces';
/** Share routes never manufacture a matching space when the source database is absent. */
export async function readExistingSpace(id) { if (!/^[a-zA-Z0-9-]{8,80}$/.test(id))
    return null; return new Promise((resolve, reject) => { const r = indexedDB.open(DB, STORAGE_VERSION); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TABLE))
    r.result.createObjectStore(TABLE); }; r.onerror = () => reject(r.error); r.onsuccess = () => { const db = r.result, tx = db.transaction(TABLE, 'readonly'), q = tx.objectStore(TABLE).get(id); q.onsuccess = () => resolve(q.result ?? null); q.onerror = () => reject(q.error); tx.oncomplete = () => db.close(); }; }); }
const sessionFields = new Set(['actorId', 'activeAccountId', 'activeFamilyId', 'selectedTripId', 'demoSpaceId', 'messages']);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function key(x) { return x?.id ?? x?.key ?? (x?.familyId && x?.personId ? x.familyId + ':' + x.personId : JSON.stringify(x)); }
export function mergeChanges(current, before, after, path = '') {
    if (!path && (current?.dataContractVersion !== before?.dataContractVersion || current?.tripCleanup?.id !== before?.tripCleanup?.id || current?.tripCleanup?.release !== before?.tripCleanup?.release || current?.journeyRelease?.version !== before?.journeyRelease?.version || current?.seedVersion !== before?.seedVersion || current?.recoverySeedVersion !== before?.recoverySeedVersion))
        throw Error('演示行程已更新，請重新整理後再操作。');
    if (equal(before, after))
        return current;
    if (Array.isArray(before) && Array.isArray(after) && Array.isArray(current)) {
        const b = new Map(before.map(x => [key(x), x])), a = new Map(after.map(x => [key(x), x]));
        const result = current.filter(x => !b.has(key(x)) || a.has(key(x))).map(x => a.has(key(x)) && b.has(key(x)) ? mergeChanges(x, b.get(key(x)), a.get(key(x)), path) : x);
        for (const x of after)
            if (!b.has(key(x)) && !result.some(y => key(y) === key(x)))
                result.push(structuredClone(x));
        return result;
    }
    if (before && after && current && typeof before === 'object' && typeof after === 'object' && !Array.isArray(after)) {
        const result = { ...current };
        for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (!path && sessionFields.has(k) || path === 'journeys' && k === 'selectedId')
                continue;
            if (!(k in after)) {
                delete result[k];
                continue;
            }
            result[k] = mergeChanges(current[k], before[k], after[k], path ? path + '.' + k : k);
        }
        return result;
    }
    if (path === 'counter')
        return Math.max(current ?? 0, after ?? 0);
    return structuredClone(after);
}
export class DemoStorage {
    spaceId;
    db;
    channel;
    poll;
    observed = '';
    queue = Promise.resolve();
    onChange = () => { };
    constructor(spaceId) {
        this.spaceId = spaceId;
    }
    async open(initial, prepare = s => s) {
        this.close();
        try {
            this.db = await new Promise((resolve, reject) => { let done = false; const fail = (e) => { if (done)
                return; done = true; clearTimeout(timer); reject(e); }; const timer = setTimeout(() => fail(new DOMException('Storage open timed out', 'TimeoutError')), 8000); let r; try {
                r = indexedDB.open(DB, STORAGE_VERSION);
            }
            catch (e) {
                fail(e);
                return;
            } r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TABLE))
                r.result.createObjectStore(TABLE); }; r.onsuccess = () => { if (done) {
                r.result.close();
                return;
            } done = true; clearTimeout(timer); resolve(r.result); }; r.onerror = () => fail(r.error); r.onblocked = () => fail(new DOMException('Close other tabs before retrying', 'BlockedError')); });
        }
        catch (e) {
            throw new StartupError('open', e);
        }
        this.db.onversionchange = () => this.close();
        let result;
        try {
            result = await this.write(s => { try {
                if (s && !demoOwned(s))
                    throw Error("此資料空間不屬於已授權的演示帳號，未修改原資料。");
                return removeRecordingTrip(installBookingPreferences(prepare(updateRuntimeClock(initLearning(migrateText(clearRetiredTrips(s ?? initial)))))));
            }
            catch (e) {
                throw new StartupError('migration', e);
            } }, true);
        }
        catch (e) {
            this.close();
            throw e instanceof StartupError ? e : new StartupError('readwrite', e);
        }
        // Cross-tab notifications are optional. Their availability must never decide
        // whether a successfully committed database can be used.
        try {
            if (typeof BroadcastChannel === 'undefined')
                throw Error('Unavailable');
            this.channel = new BroadcastChannel('cx2-demo:' + this.spaceId);
            this.channel.onmessage = () => this.onChange();
        }
        catch {
            this.startPolling();
        }
        this.published(result);
        return result;
    }
    startPolling() { if (this.poll)
        return; this.poll = setInterval(() => { void this.read().then(s => { const value = JSON.stringify(s); if (value !== this.observed) {
        this.observed = value;
        this.onChange();
    } }).catch(() => { }); }, 1500); }
    published(s) { this.observed = JSON.stringify(s); try {
        this.channel?.postMessage({ type: 'invalidate' });
    }
    catch {
        this.channel?.close();
        this.channel = undefined;
        this.startPolling();
    } }
    write(change, initial = false) { const operation = this.queue.catch(() => { }).then(() => new Promise((resolve, reject) => { const tx = this.db.transaction(TABLE, 'readwrite'), store = tx.objectStore(TABLE), r = store.get(this.spaceId); let result; let error; r.onsuccess = () => { try {
        if (!r.result && !initial)
            throw Error('演示空间不存在');
        const original = r.result;
        const contractBackup = initial && original && original.dataContractVersion !== 1 ? structuredClone(original) : undefined;
        const cleanupBackup = initial && needsRequestedCleanup(original, this.spaceId) ? structuredClone(original) : undefined;
        if (original)
            original.demoSpaceId = this.spaceId;
        if (!initial && original?.tripCleanup?.release && original.tripCleanup.release !== TRIP_RELEASE)
            throw Error('資料版本已更新，請重新整理。');
        if (original?.tripCleanup)
            updateRuntimeClock(original);
        result = change(original);
        result.demoSpaceId = this.spaceId;
        if (initial) {
            removeRequestedTrips(result, this.spaceId);
            if (cleanupBackup && result.requestedTripCleanup?.removed.length)
                store.put(cleanupBackup, this.spaceId + ':backup:' + REQUESTED_TRIP_CLEANUP);
        }
        if (contractBackup)
            store.put(contractBackup, this.spaceId + ':backup:seven-contract-v1');
        result.dataContractVersion = 1;
        normalizeDisruptionTasks(result);
        migrateServiceCases(result);
        repairAirlineMisroutes(result);
        repairTripCare(result);
        if (original?.tripCleanup && result.tripCleanup?.id !== original.tripCleanup.id)
            throw Error('資料版本已更新，請重新整理。');
        if (initial && result.tripCleanup && !original?.tripCleanup)
            for (const suffix of ['journey-data-v1', 'scene-v1', 'timeline-v1'])
                store.delete(this.spaceId + ':backup:' + suffix);
        updateRuntimeClock(result);
        synchronizeClocks(result);
        runSchedules(result);
        store.put(result, this.spaceId);
    }
    catch (e) {
        error = e;
        tx.abort();
    } }; tx.oncomplete = () => { this.published(result); resolve(result); }; tx.onabort = () => reject(error ?? tx.error ?? Error('事务未完成')); tx.onerror = () => { error ??= tx.error; }; })); this.queue = operation; return operation; }
    async flush() { await this.queue.catch(() => { }); }
    async read() { await this.flush(); return new Promise((resolve, reject) => { const tx = this.db.transaction(TABLE, 'readonly'), r = tx.objectStore(TABLE).get(this.spaceId); r.onsuccess = () => r.result ? resolve(r.result) : reject(Error('演示空间不存在')); r.onerror = () => reject(r.error); }); }
    saveDelta(before, after) { return this.write(current => mergeChanges(current, before, after)); }
    async settle() { const s = await this.read(); if (s.flightChanges?.recording.some(c => c.spaceId === this.spaceId && c.status === 'scheduled' && (c.dueAt ?? Infinity) <= Date.now())) {
        await this.write(current => { deliverFlightChanges(current, this.spaceId); return current; });
        return true;
    } if ((Object.values(s.serviceJobs ?? {}).some(j => j.status === 'pending' && j.dueAt <= Date.now()) || Object.values(s.serviceReplies ?? {}).some(j => j.status === 'pending' && j.dueAt <= Date.now()))) {
        await this.write(current => settleServiceJobs(current));
        return true;
    } if (!Object.values(s.feedbackRewards ?? {}).some(e => e.status === 'processing' && (e.dueAt ?? Infinity) <= Date.now()) && !Object.values(s.dual?.transactions ?? {}).some(t => t.status === 'pending' && t.dueAt <= Date.now()) && !Object.values(s.learning?.events ?? {}).some(e => e.status === 'processing' && (e.dueAt ?? Infinity) <= Date.now()))
        return false; await this.write(current => { for (const e of Object.values(current.feedbackRewards ?? {}))
        if (e.status === 'processing')
            settleFeedback(current, e.key); for (const t of Object.values(current.dual?.transactions ?? {}))
        if (t.status === 'pending')
            settleSupport(current, t.id); for (const e of Object.values(current.learning?.events ?? {}))
        if (e.status === 'processing')
            settleLearning(current, e.key); return current; }); return true; }
    close() { this.channel?.close(); this.channel = undefined; if (this.poll)
        clearInterval(this.poll); this.poll = undefined; this.db?.close(); }
}
export function demoSpaceId() { const q = new URLSearchParams(location.search).get('space'); if (q && /^[a-zA-Z0-9-]{8,80}$/.test(q)) {
    sessionStorage.setItem('cx2-tab-demo-space', q);
    return q;
} const tab = sessionStorage.getItem('cx2-tab-demo-space'); if (tab)
    return tab; let id = localStorage.getItem('cx2-current-demo-space'); if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('cx2-current-demo-space', id);
} sessionStorage.setItem('cx2-tab-demo-space', id); return id; }
