import { BRAND } from '/assets/ee1ad71b9a14d41f146c/web/brand.js';
import { esc } from '/assets/ee1ad71b9a14d41f146c/ui.js';
const brandAsset = (name) => new URL('./web/assets/brand/' + name + '.svg', import.meta.url).href;
export function brandLockup(navigation = true) { return '<a class="brand brand-identity" href="/"' + (navigation ? ' data-view="home"' : '') + ' aria-label="' + esc(BRAND.names[BRAND.locale] + ' ' + BRAND.names.en) + '"><img class="official-cathay" src="' + brandAsset('cathay80-en') + '" width="690" height="120" alt="Cathay 80"><span class="product-wordmark"><strong>' + esc(BRAND.names[BRAND.locale]) + '</strong><small lang="en">' + esc(BRAND.names.en) + '</small></span></a>'; }
export function newJourneyButton() { return '<button type="button" class="button new-journey-button" data-new-plan><img class="booking-flight-icon" src="' + brandAsset('booking-flight') + '" width="24" height="25" alt="" aria-hidden="true"><span>新增行程</span></button>'; }
export function allianceMark() { return '<img class="oneworld-mark" src="' + brandAsset('oneworld') + '" width="50" height="50" alt="oneworld">'; }
export function brandWelcome() { return '<section class="home-brand-intro" aria-labelledby="brand-promise"><h1 id="brand-promise">' + esc(BRAND.tagline) + '</h1><p lang="en">' + esc(BRAND.taglineEn) + '</p></section>'; }
