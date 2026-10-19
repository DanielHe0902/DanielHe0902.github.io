import { icon } from '/assets/e680549b4bafa81e51ac/ui.js';
let openPicker;
window.addEventListener('resize', () => { if (openPicker?.control.isConnected)
    openPicker.position();
else
    openPicker = undefined; });
const aliases = {
    HKG: 'hong kong hongkong 香港', TPE: 'taipei taoyuan 台北 臺北 桃園 桃园',
    NRT: 'tokyo narita 東京 东京 成田', SIN: 'singapore changi 新加坡 樟宜',
    PVG: 'shanghai pudong 上海 浦東 浦东', PEK: 'beijing peking 北京 首都',
    LHR: 'london heathrow 倫敦 伦敦 希思羅 希思罗', SYD: 'sydney 悉尼 雪梨',
};
/** Enhance the real select, retaining its name/value and a native no-JS fallback.
 * Results use the project's local airport catalogue; no invented live inventory. */
export function bindAirportPickers(root) {
    root.querySelectorAll('select[data-airport-select]').forEach(select => {
        const field = select.closest('.field');
        if (field.dataset.airportEnhanced)
            return;
        field.dataset.airportEnhanced = 'true';
        const id = select.id, label = field.querySelector('label');
        const options = Array.from(select.options).filter(o => o.value).map(o => ({ value: o.value, text: o.text }));
        const control = document.createElement('div');
        control.className = 'airport-control';
        const query = document.createElement('input');
        query.type = 'text';
        query.id = id + '-query';
        query.autocomplete = 'off';
        query.placeholder = '城市、機場或代碼';
        query.setAttribute('role', 'combobox');
        query.setAttribute('aria-autocomplete', 'list');
        query.setAttribute('aria-expanded', 'false');
        query.setAttribute('aria-controls', id + '-list');
        query.setAttribute('aria-haspopup', 'listbox');
        query.setAttribute('aria-required', String(select.required));
        label.htmlFor = query.id;
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'airport-clear';
        clear.innerHTML = icon('close');
        clear.setAttribute('aria-label', '清除' + label.textContent);
        const list = document.createElement('div');
        list.id = id + '-list';
        list.className = 'airport-results';
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', label.textContent ?? '機場');
        list.hidden = true;
        const status = document.createElement('small');
        status.className = 'sr-only';
        status.setAttribute('role', 'status');
        control.append(query, clear, list, status);
        field.insertBefore(control, select);
        select.hidden = true;
        select.tabIndex = -1;
        let matches = options, active = -1, searching = false;
        const scrollArea = control.closest('.assistant-messages');
        const position = () => {
            if (list.hidden)
                return;
            const box = control.getBoundingClientRect(), area = scrollArea?.getBoundingClientRect();
            const top = Math.max(8, area?.top ?? 8), bottom = Math.min(innerHeight - 8, area?.bottom ?? innerHeight - 8);
            const below = bottom - box.bottom - 8, above = box.top - top - 8, wanted = Math.min(240, Math.max(56, matches.length * 46 + 8));
            const up = below < wanted && above > below;
            list.style.top = up ? 'auto' : 'calc(100% + 4px)';
            list.style.bottom = up ? 'calc(100% + 4px)' : 'auto';
            list.style.maxHeight = Math.max(40, Math.min(wanted, up ? above : below)) + 'px';
            list.dataset.placement = up ? 'above' : 'below';
        };
        scrollArea?.addEventListener('scroll', position, { passive: true });
        const sync = () => { query.value = options.find(o => o.value === select.value)?.text ?? ''; clear.hidden = !select.value; };
        const close = () => { list.hidden = true; if (openPicker?.control === control)
            openPicker = undefined; query.setAttribute('aria-expanded', 'false'); query.removeAttribute('aria-activedescendant'); active = -1; searching = false; sync(); };
        const commit = (value) => { select.value = value; select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); close(); query.focus(); };
        const paint = () => {
            const term = searching ? query.value.trim().toLocaleLowerCase() : '';
            matches = options.filter(o => (o.value + ' ' + o.text + ' ' + aliases[o.value]).toLocaleLowerCase().includes(term));
            list.replaceChildren();
            active = -1;
            query.removeAttribute('aria-activedescendant');
            matches.forEach((o, i) => { const item = document.createElement('div'); item.id = id + '-option-' + i; item.setAttribute('role', 'option'); item.setAttribute('aria-selected', String(o.value === select.value)); item.dataset.value = o.value; item.textContent = o.text; item.onpointerdown = e => e.preventDefault(); item.onclick = () => commit(o.value); list.append(item); });
            if (!matches.length) {
                const empty = document.createElement('p');
                empty.className = 'airport-no-results';
                empty.textContent = '沒有符合的機場。試試城市名稱或三字代碼。';
                list.append(empty);
            }
            status.textContent = matches.length + ' 個機場選項';
            list.hidden = false;
            query.setAttribute('aria-expanded', 'true');
            position();
            openPicker = { control, position };
        };
        query.addEventListener('focus', () => { searching = false; paint(); query.select(); });
        query.addEventListener('click', () => { if (list.hidden)
            paint(); });
        query.addEventListener('input', () => { searching = true; clear.hidden = !query.value && !select.value; paint(); });
        query.addEventListener('keydown', e => {
            if (e.key === 'Escape' && !list.hidden) {
                e.preventDefault();
                e.stopPropagation();
                close();
                return;
            }
            if (e.key === 'Tab') {
                close();
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (list.hidden)
                    paint();
                if (!matches.length)
                    return;
                active = active < 0 ? (e.key === 'ArrowDown' ? 0 : matches.length - 1) : (active + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
                list.querySelectorAll('[role=option]').forEach((el, i) => el.classList.toggle('is-active', i === active));
                const option = list.children[active];
                query.setAttribute('aria-activedescendant', option.id);
                option.scrollIntoView({ block: 'nearest' });
            }
            else if (e.key === 'Enter' && !list.hidden) {
                e.preventDefault();
                if (active >= 0)
                    commit(matches[active].value);
                else if (matches.length === 1)
                    commit(matches[0].value);
            }
        });
        control.addEventListener('focusout', () => queueMicrotask(() => { if (!control.contains(document.activeElement))
            close(); }));
        clear.addEventListener('click', () => { commit(''); searching = true; paint(); });
        select.addEventListener('change', sync);
        select.addEventListener('focus', () => query.focus());
        // Expose domain/HTML validation on the visible control, including its error text.
        new MutationObserver(() => {
            for (const attr of ['aria-invalid', 'aria-describedby']) {
                const value = select.getAttribute(attr);
                if (value)
                    query.setAttribute(attr, value);
                else
                    query.removeAttribute(attr);
            }
        }).observe(select, { attributes: true, attributeFilter: ['aria-invalid', 'aria-describedby'] });
        sync();
    });
}
