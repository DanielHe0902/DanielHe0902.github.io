const identity = value => value;
const traditional = globalThis.OpenCC?.Converter({ from: 'cn', to: 'hk' }) ?? identity;
const simplified = globalThis.OpenCC?.Converter({ from: 'hk', to: 'cn' }) ?? identity;
export const tc = (value) => traditional(value).replaceAll('照護檔案', '照護資料').replaceAll('裏數', '里數').replaceAll('裏可用', '里數可用').replaceAll('里可用', '里數可用').replace(/([0-9,]\s*)裏/g, '$1里');
export const sc = (value) => simplified(value);
export function localize(root) {
    if ((root instanceof Element ? root : root.parentElement)?.closest('script,style,code,[data-no-translate]'))
        return;
    if (root.nodeType === Node.TEXT_NODE) {
        if (root.parentElement?.closest('textarea,input'))
            return;
        const old = root.nodeValue ?? '', next = tc(old);
        if (old !== next)
            root.nodeValue = next;
        return;
    }
    if (root instanceof Element) {
        // Options without an explicit value otherwise change their submitted value with their label.
        if (root instanceof HTMLOptionElement && !root.hasAttribute('value'))
            root.value = root.textContent ?? '';
        for (const key of ['aria-label', 'title', 'placeholder']) {
            const old = root.getAttribute(key);
            if (old && tc(old) !== old)
                root.setAttribute(key, tc(old));
        }
        if (root.matches('input,textarea'))
            return;
    }
    for (const child of Array.from(root.childNodes))
        localize(child);
}
export function observeLocale() {
    localize(document.body);
    const observer = new MutationObserver(records => { for (const record of records) {
        if (record.type === 'characterData')
            localize(record.target);
        else
            for (const node of record.addedNodes)
                localize(node);
    } });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
