import { calendarDate } from '/assets/b53849a26298fd713aba/web/calendar-contract.js';
import { importCalendarFile, calendarPatch, mergeCalendar, clearCalendarCache } from '/assets/b53849a26298fd713aba/calendar-import.js';
import { esc, icon } from '/assets/b53849a26298fd713aba/ui.js';
const labels = { school: '學校', start: '開學', exam: '考試', holiday: '假期開始', holidayEnd: '假期結束', dorm: '宿舍開放', graduation: '畢業典禮' };
export function calendarController(h) {
    let controller = null, status = '', error = '', revision = 0, preview = '', currentFile = '', pending = null;
    const releasePreview = () => { if (preview)
        URL.revokeObjectURL(preview); preview = ''; };
    function cancel(clear = false) { controller?.abort(); controller = null; status = ''; revision++; if (clear) {
        pending = null;
        currentFile = '';
        error = '';
        releasePreview();
        clearCalendarCache();
    } }
    async function read(file) {
        cancel();
        releasePreview();
        error = '';
        currentFile = file.name;
        const account = h.state().activeAccountId, actor = h.state().actorId, version = revision;
        controller = new AbortController();
        const active = controller, timer = setTimeout(() => active.abort('timeout'), 90000);
        if (/\.jpe?g$/i.test(file.name) && file.size <= 5 * 1024 * 1024)
            preview = URL.createObjectURL(file);
        try {
            const result = await importCalendarFile(file, { accountId: account, planId: 'student:' + actor, draftVersion: version }, active.signal, text => { status = text; h.render(); });
            if (active.signal.aborted || account !== h.state().activeAccountId || version !== revision)
                return;
            pending = result;
            status = '';
            h.set(mergeCalendar(h.plan(), result), result.events.find(e => e.scope === result.scope && calendarDate(e.start))?.start.slice(0, 7));
        }
        catch (e) {
            if (account !== h.state().activeAccountId || version !== revision)
                return;
            status = '';
            error = active.signal.aborted ? '整理已取消或逾時，現有資料已保留。' : e.message;
            h.render();
        }
        finally {
            clearTimeout(timer);
            if (controller === active)
                controller = null;
        }
    }
    function panel(p) {
        const r = p.calendarImport ?? pending, patch = r && r.scope ? calendarPatch(r) : {}, conflicts = Object.entries(patch).filter(([k, v]) => String(p[k] ?? '') && String(p[k]) !== v), scopes = r ? [...new Set(r.events.map(e => e.scope))] : [];
        return `<section class="calendar-import" aria-labelledby="calendar-import-title" data-calendar-drop><div class="section-title"><div><h2 id="calendar-import-title">上傳校曆，自動整理學期安排</h2><p>拖放檔案至此，或選擇檔案</p></div>${icon('calendar')}</div><div class="button-row"><label class="button secondary calendar-file">${currentFile ? '重新選擇' : '選擇檔案'}<input type="file" data-calendar-file accept=".pdf,.jpg,.jpeg,.dat" aria-label="選擇校曆檔案"></label>${status ? '<button type="button" class="text-link" data-calendar-cancel>取消識別</button>' : ''}</div><p class="meta">PDF、JPG／JPEG、DAT（依內容解析） · 最多 5 MB、8 頁；圖片最多 16 百萬像素。僅用於整理你的校曆。</p>${currentFile ? `<p class="meta">${esc(currentFile)}</p>` : ''}${preview ? `<details><summary>查看圖片</summary><img class="calendar-image-preview" src="${esc(preview)}" alt="本次選擇的校曆圖片"></details>` : ''}<p role="status" aria-live="polite">${esc(status)}</p>${error ? `<p role="alert" class="error">${esc(error)}</p>` : ''}${r ? `<div class="calendar-review" data-calendar-result="${esc(r.id)}"><h3>已整理出 ${r.events.length} 項日期</h3><label class="field"><span>適用學期／校區</span><select data-calendar-scope><option value="">請選擇適用範圍</option>${scopes.map(s => `<option ${s === r.scope ? 'selected' : ''} value="${esc(s)}">${esc(s)}</option>`).join('')}</select></label>${r.warnings.map(w => `<p class="error">${esc(w)}</p>`).join('')}${conflicts.map(([k, v]) => `<div class="calendar-conflict"><strong>${labels[k]}需要核對</strong><p>目前：${esc(p[k])}　檔案：${esc(v)}</p><div class="button-row"><button type="button" class="button secondary" data-calendar-choice="${k}" data-choice="file">採用檔案日期</button><button type="button" class="text-link" data-calendar-choice="${k}" data-choice="existing">${r.choices[k] === 'existing' ? '已選擇保留目前資料' : '保留目前資料'}</button></div></div>`).join('')}<details ${r.events.some(e => e.scope === r.scope && e.issue) ? 'open' : ''}><summary>查看日期及來源</summary>${r.events.filter(e => e.scope === r.scope).map(e => `<article class="calendar-evidence"><strong>${esc(e.name)}</strong><p>${esc(e.start || '日期待核對')}${e.end !== e.start ? ' — ' + esc(e.end) : ''}${e.timezone ? ' · ' + esc(e.timezone) : ''}</p>${e.issue ? `<p class="error">${esc(e.issue)}</p><label class="field"><span>核對開始日期</span><input type="date" data-calendar-event="${e.id}" data-edge="start" value="${esc(e.start)}"></label><label class="field"><span>核對結束日期</span><input type="date" data-calendar-event="${e.id}" data-edge="end" value="${esc(e.end)}"></label><button type="button" class="text-link" data-calendar-resolve="${e.id}">已核對此日期</button>` : ''}<small>第 ${e.page} 頁${e.line ? ' · 第 ' + e.line + ' 行' : ''}：${esc(e.excerpt)}</small></article>`).join('')}</details>${r.scope ? `<label class="check"><input type="checkbox" data-calendar-reviewed ${r.reviewed ? 'checked' : ''} ${conflicts.some(([k]) => !r.choices[k]) ? 'disabled' : ''}>我已核對適用學期、日期及差異</label>` : ''}<details class="calendar-preserved"><summary>未由檔案提供的資料</summary><p>出發日期、航線、預算、行李及簽證沿用目前草稿，未由本次文件推算。</p><p>預算 HK$ ${p.budget ?? '未設定'} · 托運行李 ${p.bags ?? '未設定'} 件 · 簽證 ${esc(p.visa || '未設定')}</p></details><p class="meta">${r.reviewed ? '核對完成，請保存校曆。' : '已填入可核對草稿；未提供的資料保留原值。'}</p></div>` : ''}</section>`;
    }
    function change(fn) { const p = structuredClone(h.plan()), r = p.calendarImport ?? pending; if (!r)
        return; fn(r); r.reviewed = false; pending = r; h.set(mergeCalendar(p, r), r.events.find(e => e.scope === r.scope && calendarDate(e.start))?.start.slice(0, 7)); }
    function bind() { document.querySelectorAll('[data-calendar-file]').forEach(input => input.onchange = () => { const f = input.files?.[0]; if (f)
        void read(f); }); const drop = document.querySelector('[data-calendar-drop]'); if (drop) {
        drop.ondragover = e => e.preventDefault();
        drop.ondrop = e => { e.preventDefault(); const files = e.dataTransfer?.files; if (files?.length === 1)
            void read(files[0]);
        else {
            error = '請一次選擇一份校曆。';
            h.render();
        } };
    } document.querySelector('[data-calendar-cancel]')?.addEventListener('click', () => { cancel(); h.render(); }); document.querySelector('[data-calendar-scope]')?.addEventListener('change', e => change(r => { r.scope = e.target.value; r.choices = {}; })); document.querySelectorAll('[data-calendar-choice]').forEach(b => b.onclick = () => change(r => { r.choices[b.dataset.calendarChoice] = b.dataset.choice; })); document.querySelectorAll('[data-calendar-event]').forEach(el => el.onchange = () => change(r => { const e = r.events.find(e => e.id === el.dataset.calendarEvent); e[el.dataset.edge] = el.value; })); document.querySelectorAll('[data-calendar-resolve]').forEach(b => b.onclick = () => change(r => { const e = r.events.find(e => e.id === b.dataset.calendarResolve); if (calendarDate(e.start) && calendarDate(e.end) && e.end >= e.start)
        e.issue = ''; })); document.querySelector('[data-calendar-reviewed]')?.addEventListener('change', e => { const p = structuredClone(h.plan()); p.calendarImport.reviewed = e.target.checked; for (const event of p.calendarImport.events)
        if (event.scope === p.calendarImport.scope)
            event.review = p.calendarImport.reviewed ? 'confirmed' : 'unreviewed'; h.set(p); }); document.querySelectorAll('[data-calendar-open]').forEach(el => el.onclick = () => h.open()); }
    return { panel, bind, cancel, edited: () => { revision++; if (controller) {
            controller.abort();
            controller = null;
            status = '';
            error = '你已修改草稿，請重新選擇檔案以免覆蓋本輪修改。';
            queueMicrotask(h.render);
        } }, read };
}
