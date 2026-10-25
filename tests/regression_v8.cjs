const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(projectRoot, 'src', 'app.src.html'), 'utf8');
const vercelConfig = fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8');
assert.match(html, /onsubmit="return saveCreatorAccountName\(event\)"[\s\S]*?id="creatorAccountName"/);
assert.match(html, /onsubmit="return saveCreatorStudioName\(event\)"[\s\S]*?id="creatorAccountStudioName"/);
assert.match(html, /onsubmit="return requestCreatorAccountEmailChange\(event\)"[\s\S]*?id="creatorAccountEmail"/);
assert.match(html, /id="landingVisitorName"[^>]*required/);
assert.match(html, /const VISITOR_NAME_DEVICE_KEY = 'artNexusVisitorDisplayNameV1'/);
assert.match(html, /const VISITOR_WELCOME_DEVICE_KEY = 'artNexusWelcomeCompletedV1'/);
assert.match(html, /function persistDeviceWelcome\(name\)/);
const splashMarkup = html.match(/<section class="screen active" id="screen-landing"[\s\S]*?<\/section>/)?.[0] || '';
assert.equal((splashMarkup.match(/<input\b/g) || []).length, 1, 'the splash has one input: the visitor name');
assert.doesNotMatch(splashMarkup, /type="email"|landingVisitorEmail/);
assert.match(html, /id="browsePersonalGreeting"/);
assert.match(html, /Save a work to your private collection on this device/);
assert.doesNotMatch(html, /artNexusLocalEventBroker|eventBroker/);
assert.match(html, /async function syncPlatformData\(\)[\s\S]*?ART_NEXUS_LEGACY_PLATFORM_SYNC !== true/);
assert.doesNotMatch(html, /async function toggleFollowArtist/, 'retired follow event delivery is not part of the local preview');
assert.doesNotMatch(html, /id="creatorReleaseVisibilityPrivate"|Save as a private draft/, 'new-release form no longer offers a private-draft choice');
assert.match(html, /function getCreatorReleaseVisibility\(\)[\s\S]*?return 'public'/, 'all new publish actions are public');
assert.match(html, /New releases publish publicly[\s\S]*?Existing private drafts remain private/);
assert.match(html, /id="creatorReleaseModeVideo"[^>]*onclick="setCreatorReleaseMode\('video'\)"/);
assert.match(html, /id="creatorVideoReleaseFields"[\s\S]*?YouTube or Vimeo HTTPS link[\s\S]*?thumbnail is derived automatically[\s\S]*?player stays unloaded until a visitor selects Play/);
assert.match(html, /id="creatorSocialLinksRows"/);
assert.match(html, /onclick="addCreatorSocialLinkRow\(\)"/);
assert.match(html, /function readCreatorSocialLinksEditor\(\)/);
assert.match(html, /Choose a platform and add its URL/);
assert.match(html, /creatorSocialPlatform-/);
assert.match(html, /getCreatorVideoProviderDetails\(value\)/);
assert.match(html, /youtube-nocookie\.com\/embed/);
assert.match(html, /vimeo\.com\/api\/oembed\.json/);
assert.match(html, /openCreatorVideoPlayerFromProfile\(releaseId\)/);
assert.match(html, /The selected video provider is loaded only after you choose Play/);
assert.match(html, /COMMUNITY_EDITION_FUTURE_FEATURES = Object\.freeze/);
assert.match(html, /data-future-feature="commission"/);
assert.match(html, /data-future-feature="artist-transaction-links"/);
assert.match(html, /data-future-feature="creator-wip"/);
assert.match(html, /data-future-feature="master-storage-pointers"/);
assert.match(html, /body\.community-edition \[data-future-feature="commission"\][\s\S]*?display: none !important/);
const videoPlayerMarkup = html.match(/id="creatorVideoPlayerOverlay"[\s\S]*?<!-- Toast -->/)?.[0] || '';
assert.ok(videoPlayerMarkup, 'the explicit-click video player overlay is present');
assert.doesNotMatch(videoPlayerMarkup, /<iframe\b|<video\b/, 'no remote player loads before a visitor click');
assert.match(vercelConfig, /frame-src 'self' https:\/\/www\.youtube-nocookie\.com https:\/\/player\.vimeo\.com/);
assert.match(vercelConfig, /connect-src[^;]*https:\/\/vimeo\.com; frame-src/);
assert.match(html, /function addCreatorLocalRelease\(\)/);
assert.match(html, /function saveCreatorLocalWork\(workId\)/);
assert.match(html, /creator-work-format-badge[\s\S]*?FOLIO STACK/);
assert.match(html, /id="creatorDriveAgreementCheck" aria-describedby="creatorDriveConsentHint" onchange=/);
assert.match(html, /if \(NONPROFIT_PILLARS_LOCAL_MODE\)[\s\S]*?Drive upload or connection is started/);
assert.match(html, /id="hubCommissionDetails"[\s\S]*?Terms &amp; Conditions[\s\S]*?Accepted payment methods/);
assert.match(html, /id="creatorCommissionTermsInput"/);
assert.match(html, /Artist-managed external links · optional[\s\S]*?Saved on this device only; no Art Nexus checkout/);
assert.doesNotMatch(html, /id="creatorCommissionPaymentMethodsInput"/);
assert.doesNotMatch(html, /class="folio-lightbox-header"|class="folio-lightbox-home"/);
assert.match(html, /class="folio-stack-view-controls" role="group" aria-label="Folio Stack viewing controls"[\s\S]*?data-theme-toggle[\s\S]*?id="folioStackClose"/);
assert.match(html, /<html lang="en" data-theme="dark">/);
assert.match(html, /class="folio-stack-lightbox" id="folioStackLightbox"[^>]*onclick="if \(event.target === this\) closeFolioStack\(\)"/);
assert.match(html, /class="folio-lightbox-backdrop" id="folioLightboxBackdrop"/);
assert.match(html, /id="folioStackSaveCollection"[\s\S]*?Save this Folio Stack to a private collection/);
assert.match(html, /id="folioStackHeartBtn"[^>]*data-artwork-action="heart"/);
assert.match(html, /function toggleArtworkHeart\(id\)[\s\S]*?no public count or artist notification was sent/);
assert.doesNotMatch(html, /toggleArtworkLike|folioStackHeartCount|artworkHeartCount|publicLikeCount/);
assert.match(html, /\.folio-stack-gallery \{[^}]*width: min\(calc\(100% - 32px\), 600px\)/);
assert.match(html, /\.folio-stack-footer \{[^}]*width: min\(calc\(100% - 32px\), 760px\)/);
assert.ok((html.match(/data-theme-toggle/g) || []).length >= 6);
assert.match(html, /function applyAppTheme\(theme, persist = true\)/);
assert.match(html, /case 'folioStackLightbox': closeFolioStack\(false, true\); break;/);
assert.match(html, /id="integratedRatingCard"[^>]*data-contrast-surface="void"/);
assert.match(html, /function syncIntegratedRatingCard\(\)/);
assert.match(html, /function dismissRatingPrompt\(permanent = true\)/);
assert.match(html, /const INTEGRATED_RATING_CARD_HIDDEN_KEY = 'artNexusIntegratedRatingCardHidden'/);
assert.match(html, /id="integratedRatingAction"[^>]*disabled/);
assert.doesNotMatch(html, /href="https:\/\/appstore\.com/);
assert.doesNotMatch(html, /0% commission|community-owned protocol/);
assert.match(html, /<button class="drawer-link" onclick="navTo\('network'\)" hidden>/, 'Network remains in source but is hidden from the submenu');
assert.match(html, /<button class="drawer-link" onclick="navTo\('gallery-me'\)" hidden>/, 'My Gallery remains in source but is hidden from the submenu');
const futureDevelopmentNote = html.match(/<p class="drawer-future-note"[^>]*>([\s\S]*?)<\/p>/)?.[1] || '';
assert.match(futureDevelopmentNote, /Network, My Gallery, and marketplace functions/);
assert.doesNotMatch(futureDevelopmentNote, /<(?:a|button)\b/i, 'the future-development note is non-interactive');
assert.match(html, /\.hub-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[^}]*align-items: start/);
assert.match(html, /@container app \(min-width: 1100px\) \{[\s\S]*?\.hub-grid \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); gap: 18px; \}/, 'a wide Portfolio shows four Browse-sized works across');
assert.match(html, /\.hub-work\[data-media-shape="square"\][^}]*aspect-ratio: 1 \/ 1/);
assert.match(html, /\.hub-work\[data-media-shape="landscape"\][^}]*aspect-ratio: 4 \/ 3/);
assert.match(html, /\.hub-work\[data-media-shape="wide"\][^}]*aspect-ratio: 16 \/ 9/);
assert.match(html, /\.hub-work:not\(\.creator-profile-video-card\) > img \{[^}]*object-fit: contain/);
assert.match(html, /function adaptPortfolioArtworkImages\(container\)/);
assert.match(html, /adaptPortfolioArtworkImages\(portfolioPanel\)/);

let script = require('./helpers/inline_app_script.cjs')(html, projectRoot);
script = script.replace(/\/\* ---------- INIT ---------- \*\/[\s\S]*$/, '');
const store = new Map();
const classes = () => ({
  set: new Set(), add(x) { this.set.add(x); }, remove(x) { this.set.delete(x); },
  contains(x) { return this.set.has(x); }, toggle(x, v) { if (v === undefined) v = !this.set.has(x); v ? this.set.add(x) : this.set.delete(x); return v; }
});
class E {
  constructor(id = '') {
    this.id = id; this.value = ''; this.textContent = ''; this.innerHTML = ''; this.hidden = false;
    this.inert = false; this.disabled = false; this.attributes = {}; this.dataset = {}; this.classList = classes();
    this.children = []; this.style = { setProperty() {}, getPropertyValue() { return ''; }, removeProperty() {} };
    this.attrs = new Map(); this.checked = false; this.isConnected = true; this.listeners = new Map();
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); this.attributes[k] = String(v); }
  getAttribute(k) { return this.attrs.get(k) || null; }
  removeAttribute(k) { this.attrs.delete(k); delete this.attributes[k]; }
  appendChild(el) { this.children.push(el); return el; }
  replaceChildren(...els) { this.children = els; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  addEventListener(type, fn) { const rows = this.listeners.get(type) || []; rows.push(fn); this.listeners.set(type, rows); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== fn)); }
  checkValidity() { return true; }
  focus() { this.focused = true; }
  scrollIntoView() {}
  scrollTo() {}
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  closest() { return null; }
  getClientRects() { return [{ width: 1, height: 1 }]; }
}
const elements = new Map();
const consentLabel = new E('creator-drive-consent-label');
const document = {
  querySelectorAll() { return []; },
  querySelector(selector) { return selector === 'label[for="creatorDriveAgreementCheck"]' ? consentLabel : null; },
  addEventListener() {}, removeEventListener() {},
  getElementById(id) { if (!elements.has(id)) elements.set(id, new E(id)); return elements.get(id); },
  createElement(tag) { return new E(tag); },
  documentElement: new E('html'), body: new E('body'), activeElement: new E('active')
};
const localStorage = {
  get length() { return store.size; },
  key(index) { return Array.from(store.keys())[index] ?? null; },
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); }
};
const sessionStore = new Map();
const sessionStorage = {
  getItem(key) { return sessionStore.has(key) ? sessionStore.get(key) : null; },
  setItem(key, value) { sessionStore.set(key, String(value)); },
  removeItem(key) { sessionStore.delete(key); }
};
const window = {
  localStorage, sessionStorage, document,
  crypto: { randomUUID() { return '123e4567-e89b-42d3-a456-426614174000'; }, getRandomValues(a) { a.fill(1); return a; } },
  setTimeout(fn) { return 1; }, clearTimeout() {}, requestAnimationFrame(fn) { fn(); },
  addEventListener() {}, removeEventListener() {}, matchMedia() { return { matches: false }; },
  getComputedStyle() { return { display: 'block', visibility: 'visible' }; },
  location: { href: 'https://local.test/', origin: 'https://local.test', protocol: 'https:' }
};
const ctx = {
  window, document, localStorage, console, Math, Date, JSON, Set, Map, Array, Number, String, RegExp, Uint8Array,
  MutationObserver: undefined, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
  requestAnimationFrame: window.requestAnimationFrame, fetch: async () => { throw new Error('network disabled in harness'); },
  URL, Blob, FileReader: function () {}, navigator: { userAgent: 'test' }, crypto: window.crypto
};
vm.createContext(ctx);
vm.runInContext(script, ctx, { timeout: 10000 });
const run = code => vm.runInContext(code, ctx, { timeout: 10000 });
assert.equal(run('getCreatorReleaseVisibility()'), 'public', 'new releases remain public regardless of stale form state');
assert.equal(run('ensureCreatorStorageNodeForm() === null'), true, 'the optional Master storage-pointer editor stays un-injected');
run(`switchCreatorStudioTab('wip')`);
assert.equal(elements.get('creatorStudioTabWip').hidden, true, 'the Creator Studio WIP tab stays hidden even if code requests it');
assert.equal(elements.get('creatorStudioWipPanel').hidden, true, 'the WIP panel cannot be activated in community edition');
assert.equal(elements.get('creatorStudioArtworkPanel').hidden, false);
for (const [width, height, expectedShape] of [[600, 1200, 'portrait'], [1000, 1000, 'square'], [1400, 1000, 'landscape'], [1800, 900, 'wide']]) {
  const actualShape = run(`(() => { const parent = { dataset: {} }; adaptFeedArtworkImage({ naturalWidth: ${width}, naturalHeight: ${height}, parentElement: parent }); return parent.dataset.mediaShape; })()`);
  assert.equal(actualShape, expectedShape, 'Portfolio and Browse share source-orientation detection');
}
assert.equal(run(`(() => { const parent = { dataset: {} }; const image = { complete: true, naturalWidth: 1000, naturalHeight: 1000, parentElement: parent, addEventListener() {} }; adaptPortfolioArtworkImages({ querySelectorAll() { return [image]; } }); return parent.dataset.mediaShape; })()`), 'square', 'loaded Portfolio artwork is adapted to the Browse-matched frame');
assert.equal(run("routeInterceptor('/api/config').status"), 403, 'same-origin config fetch is blocked');
assert.equal(run("routeInterceptor('/api/catalog').status"), 403, 'same-origin provider API routes are blocked');
assert.equal(run("routeInterceptor('https://project.supabase.co/auth/v1/user').status"), 403, 'configured Supabase host is blocked');
assert.equal(run("routeInterceptor('https://api.paymongo.com/v1/checkout_sessions').status"), 403, 'configured PayMongo host is blocked');
assert.equal(run("routeInterceptor('https://drive.google.com/file/d/abc/view').status"), 403, 'Google Drive provider host is blocked');
assert.equal(run("routeInterceptor('https://artist.example/commission')"), null, 'artist-managed external links are not blocked');
run(`applyAppTheme('light')`);
assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
assert.equal(localStorage.getItem('artNexusAppTheme'), 'light');
run(`toggleAppTheme()`);
assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
assert.equal(localStorage.getItem('artNexusAppTheme'), 'dark');
for (const id of [
  'creatorAccountName','creatorAccountStudioName','creatorAccountEmail','creatorAccountCurrentEmail','creatorAccountSettingsStatus','creatorAccountNameButton','creatorAccountStudioNameButton','creatorAccountEmailButton',
  'landingVisitorName','landingGreetingButton','landingGateStatus','screen-landing','screen-browse','welcomeSplash','welcomeSplashMessage','welcomeCreatorIdentifier','landingVisitorForm','browsePersonalGreeting','heroBanner',
  'creatorCommissionTermsInput','creatorCommissionProfileStatus','creatorCommissionProfileSettingsNote','creatorTransactionLinksInput','creatorTransactionLinksStatus','creatorSocialLinksInput','creatorSocialLinksStatus','hubSocialLinks','hubTransactionLinks',
  'creatorDriveConnectionStatus','creatorDriveAgreementCheck','creatorDriveConsentHint','creatorDriveConnectButton','creatorDriveDisconnectButton',
  'commissionRequestArtistName','commissionRequestArtistTerms','commissionRequestArtistPayments','commissionRequestClient','commissionRequestTitleInput',
  'commissionRequestBudget','commissionRequestUsage','commissionRequestBrief','commissionRequestFeedback','commissionRequestOverlay',
  'creatorCommissionQueueList','creatorCommissionPendingCount','creatorStudioAlertCount','creatorStudioAlertTray','creatorAutomationEventLog','creatorCommissionGovernorStatus',
  'creatorCommissionsOpen','creatorAvailableSlots','hubCommissionBtn','hubCommissionOpenBadge','hubCommissionAvailability','hubCommissionTerms','hubCommissionPaymentMethods',
  'profileAccessContent','creatorStudioEnvironmentLabel','creatorStudioSubtitle','creatorStudioSaveNote'
]) elements.set(id, new E(id));

async function main() {
  const blockedApiResponse = await run("fetch('/api/config')");
  assert.equal(blockedApiResponse.status, 403);
  assert.equal((await blockedApiResponse.json()).error, 'local_community_mode');
  const blockedProviderResponse = await run("fetch('https://api.paymongo.com/v1/checkout_sessions')");
  assert.equal(blockedProviderResponse.status, 403);
  // Drive access is disabled in the local-only product mode, even if Auth or OAuth is configured.
  run(`productionAuthMode=true; productionAuthUser={id:'123e4567-e89b-42d3-a456-426614174000',role:'creator',email:'creator@example.test',emailVerified:true}; creatorDriveConnection={configured:true,connected:false,googleEmail:''}; renderCreatorDriveStatus()`);
  assert.equal(elements.get('creatorDriveAgreementCheck').disabled, true);
  assert.equal(consentLabel.hidden, true);
  assert.equal(elements.get('creatorDriveConnectButton').disabled, true);
  assert.equal(elements.get('creatorDriveConnectButton').hidden, true);
  assert.match(elements.get('creatorDriveConnectionStatus').textContent, /Disabled in this local-only preview/i);
  let driveRequests = 0;
  ctx.fetch = async () => { driveRequests += 1; throw new Error('unexpected Drive request'); };
  await run(`connectCreatorGoogleDrive()`);
  assert.equal(driveRequests, 0);

  // Personal and public studio names are separate, independently editable profile values.
  const profile = { name: 'Ari Studio', studio_name: 'Ari Studio', bio: 'A saved bio', biography: 'A saved bio', artist_id: '123e4567-e89b-42d3-a456-426614174000', verified_mediums: ['Digital Art'], medium: 'Digital Art', isCreatorProfile: true, works: [], projects: [] };
  const local = { name: 'Ari', email: 'ari@example.test', avatar: '', createdAt: '2026-10-15T00:00:00.000Z' };
  run(`productionAuthMode=false; productionAuthUser=null; creatorProfile=${JSON.stringify(profile)}; activeLocalProfile=${JSON.stringify(local)}; localProfileRecords=[${JSON.stringify(local)}]; updateCreatorProfileViewsAfterAccountChange=function(){};`);
  elements.get('creatorAccountName').value = 'Ari Navarro';
  await run(`saveCreatorAccountName({preventDefault(){}})`);
  assert.equal(run('creatorProfile.name'), 'Ari Studio');
  assert.equal(run('activeLocalProfile.name'), 'Ari Navarro');
  assert.equal(JSON.parse(localStorage.getItem('artNexusUserSession')).studio_name, 'Ari Studio');
  assert.equal(JSON.parse(localStorage.getItem('artNexusUserSession')).accountName, 'Ari Navarro');
  elements.get('creatorAccountStudioName').value = 'Ari Studio North';
  await run(`saveCreatorStudioName({preventDefault(){}})`);
  assert.equal(run('creatorProfile.name'), 'Ari Studio North');
  assert.equal(run('activeLocalProfile.name'), 'Ari Navarro');
  assert.equal(JSON.parse(localStorage.getItem('artNexusUserSession')).studio_name, 'Ari Studio North');
  assert.equal(JSON.parse(localStorage.getItem('artNexusUserSession')).accountName, 'Ari Navarro');
  elements.get('creatorAccountEmail').value = 'ari.new@example.test';
  await run(`requestCreatorAccountEmailChange({preventDefault(){}})`);
  assert.equal(run('activeLocalProfile.email'), 'ari.new@example.test');
  assert.equal(JSON.parse(localStorage.getItem('artNexusUserSession')).email, 'ari.new@example.test');
  assert.match(elements.get('creatorAccountSettingsStatus').textContent, /not verified and no email was sent/i);

  // Production email changes use the Auth endpoint and leave the current email in place while confirmation is pending.
  let emailChangeRequest = null;
  ctx.fetch = async (path, options) => {
    emailChangeRequest = { path, options };
    return { ok: true, async json() { return { ok: true, email: 'ari.new@example.test', requestedEmail: 'confirmed.later@example.test', emailChangePending: true, message: 'Follow the Supabase confirmation steps.' }; } };
  };
  run(`productionAuthMode=true; productionAuthUser={id:'123e4567-e89b-42d3-a456-426614174000',role:'creator',displayName:'Ari Studio North',email:'ari.new@example.test',emailVerified:true}; renderCreatorAccountSettings()`);
  elements.get('creatorAccountEmail').value = 'confirmed.later@example.test';
  await run(`requestCreatorAccountEmailChange({preventDefault(){}})`);
  assert.equal(emailChangeRequest.path, '/api/auth/update-email');
  assert.equal(JSON.parse(emailChangeRequest.options.body).email, 'confirmed.later@example.test');
  assert.equal(run('productionAuthUser.email'), 'ari.new@example.test');
  assert.match(elements.get('creatorAccountSettingsStatus').textContent, /Supabase confirmation steps/i);

  // Saved local and production sessions hydrate personal and studio names independently.
  const hydratedLocalSession = { role: 'Creator', name: 'Ari Atelier', studio_name: 'Ari Atelier', accountName: 'Ari Navarro', account_name: 'Ari Navarro', bio: 'Saved bio', verified_mediums: ['Digital Art'], artist_id: '123e4567-e89b-42d3-a456-426614174000', createdAt: '2026-10-15T00:00:00.000Z' };
  localStorage.setItem('artNexusUserSession', JSON.stringify(hydratedLocalSession));
  run(`productionAuthMode=false; productionAuthUser=null; activeLocalProfile=null; landingVisitorName=''; landingVisitorCompleted=false; landingVisitorNameEdited=false; initOnboarding({skipCreatorRegistrySync:true})`);
  assert.equal(run('creatorProfile.name'), 'Ari Atelier');
  assert.equal(run('currentPersonalizedUserName()'), 'Ari Navarro');
  const hydratedProductionUser = { id: '123e4567-e89b-42d3-a456-426614174000', role: 'creator', displayName: 'Ari Navarro Cloud', email: 'ari@example.test', emailVerified: true, creatorProfile: { studio_name: 'Ari Atelier Cloud', bio: 'Cloud bio', verified_mediums: ['Digital Art'], avatar_url: '' } };
  run(`window.__v8Originals={renderAll,renderCart}; renderAll=function(){}; renderCart=function(){}; productionAuthMode=true; productionAuthUser=${JSON.stringify(hydratedProductionUser)}; applyProductionAccountState(productionAuthUser,{version:1,storage:{artNexusUserSession:${JSON.stringify(JSON.stringify(hydratedLocalSession))}}})`);
  assert.equal(run('creatorProfile.name'), 'Ari Atelier Cloud');
  assert.equal(run('currentPersonalizedUserName()'), 'Ari Navarro Cloud');
  assert.equal(JSON.parse(localStorage.getItem('artNexusUserSession')).accountName, 'Ari Navarro Cloud');
  assert.equal(JSON.parse(localStorage.getItem('artNexusUserSession')).studio_name, 'Ari Atelier Cloud');
  run(`renderAll=window.__v8Originals.renderAll; renderCart=window.__v8Originals.renderCart; delete window.__v8Originals`);

  // The one-time splash saves a device display name; active account names take precedence without exposing email/password credentials.
  localStorage.removeItem('artNexusUserSession');
  run(`productionAuthMode=false; productionAuthUser=null; activeLocalProfile=null; isSignedOutCreatorPreview=false; creatorProfile=null; landingVisitorCompleted=false; landingVisitorName=''; landingVisitorNameEdited=false; currentScreen='landing'; goTo=function(id){currentScreen=id}; renderWelcomeArtworkCollage=function(){return 0}; showToast=function(message){testToast=message}; testToast=''`);
  sessionStorage.setItem('artNexusVisitorName', 'Saved visitor');
  elements.get('landingVisitorName').value = 'Onin';
  run(`clearLandingVisitorError(document.getElementById('landingVisitorName')); initLandingVisitorName()`);
  assert.equal(run('landingVisitorName'), 'Onin', 'a name typed on the splash is not replaced by a saved or hydrated name');
  assert.equal(elements.get('landingVisitorName').value, 'Onin');
  assert.equal(elements.get('landingGreetingButton').textContent, 'Hello, Onin!');
  await run(`submitLandingWelcome({preventDefault(){}})`);
  assert.equal(run('landingVisitorName'), 'Onin');
  assert.equal(sessionStorage.getItem('artNexusVisitorName'), 'Onin');
  assert.equal(localStorage.getItem('artNexusVisitorDisplayNameV1'), 'Onin');
  assert.equal(localStorage.getItem('artNexusWelcomeCompletedV1'), '1');
  assert.equal(elements.get('browsePersonalGreeting').textContent, 'Welcome, Onin');
  run(`landingVisitorCompleted=false; landingVisitorName=''; landingVisitorNameEdited=false; currentScreen='landing'; document.getElementById('landingVisitorName').value=''; initLandingVisitorName()`);
  assert.equal(run('landingVisitorCompleted'), true);
  assert.equal(run('currentScreen'), 'browse');
  assert.equal(run('currentPersonalizedUserName()'), 'Onin');
  run(`productionAuthMode=true; productionAuthUser={id:'22222222-2222-4222-8222-222222222222',displayName:'Another Account'}; syncPersonalizedBrowseGreeting()`);
  assert.equal(run('currentPersonalizedUserName()'), 'Another Account');
  assert.equal(elements.get('browsePersonalGreeting').textContent, 'Welcome, Another Account');
  run(`productionAuthUser=null; productionAuthMode=false; activeLocalProfile={name:'Local Account'}; syncPersonalizedBrowseGreeting()`);
  assert.equal(run('currentPersonalizedUserName()'), 'Local Account');
  run(`activeLocalProfile=null; syncPersonalizedBrowseGreeting()`);
  assert.equal(elements.get('browsePersonalGreeting').textContent, 'Welcome, Onin');
  run(`artworkActivity.meta['feed:test-heart']={title:'River Light',artist:'Kaye',updatedAt:''}; toggleArtworkHeart('feed:test-heart')`);
  assert.equal(run(`artworkActivity.heartedIds.has('feed:test-heart')`), true);
  assert.ok(JSON.parse(localStorage.getItem('artNexusArtworkActivity')).heartedIds.includes('feed:test-heart'));
  const heartMarkup = run(`renderArtworkActivityButtons('feed:test-heart','River Light')`);
  assert.match(heartMarkup, /data-artwork-action="heart"/);
  assert.match(heartMarkup, /aria-pressed="true"/);
  assert.match(run('testToast'), /no public count or artist notification/);
  run(`artworkActivity.meta['feed:test-bookmark']={title:'River Light',artist:'Kaye',updatedAt:''}; toggleArtworkBookmark('feed:test-bookmark')`);
  assert.match(run('testToast'), /Onin/);
  assert.match(run('testToast'), /Kaye’s River Light/);
  assert.equal(run(`artworkActivity.bookmarkedIds.has('feed:test-bookmark')`), true);

  // Unimplemented legacy feed/profile/follow endpoints are not called unless explicitly opted in.
  let unexpectedLegacyCalls = 0;
  ctx.fetch = async () => { unexpectedLegacyCalls += 1; throw new Error('unexpected legacy API request'); };
  await run(`syncPlatformData()`);
  assert.equal(run(`typeof toggleFollowArtist`), 'undefined');
  assert.equal(run(`typeof restoreFollowingState`), 'undefined');
  assert.equal(unexpectedLegacyCalls, 0);

  // Creator-supplied terms and artist-managed HTTPS links remain local; no Art Nexus payment methods or checkout are configured.
  elements.get('creatorCommissionTermsInput').value = '  50% deposit before work.\nOne revision included.  ';
  elements.get('creatorTransactionLinksInput').value = 'Ko-fi | https://ko-fi.com/ari\nPortfolio | https://artist.example/portfolio';
  run(`productionAuthMode=false; creatorProfile=${JSON.stringify(profile)}; activeLocalProfile=${JSON.stringify(local)}; localProfileRecords=[${JSON.stringify(local)}]; viewArtist=creatorProfile; creatorCommissionSettings={openForCommissions:true,availableSlots:2};`);
  run(`saveCreatorCommissionProfileDetails({preventDefault(){}})`);
  assert.equal(run('creatorProfile.commissionTerms'), '50% deposit before work.\nOne revision included.');
  run(`saveCreatorTransactionLinks({preventDefault(){}})`);
  assert.equal(run('getArtistTransactionLinks(creatorProfile).map(link=>link.label+"|"+link.url).join(";")'), 'Ko-fi|https://ko-fi.com/ari;Portfolio|https://artist.example/portfolio');
  const savedSession = JSON.parse(localStorage.getItem('artNexusUserSession'));
  assert.equal(savedSession.commissionTerms, '50% deposit before work.\nOne revision included.');
  assert.deepEqual(Array.from(savedSession.commissionPaymentMethods || []), [], 'no Art Nexus payment-method editor is active in this preview');
  run(`renderArtistCommissionDetails(creatorProfile); renderCommissionRequestArtistDetails(creatorProfile); renderArtistTransactionDrawer()`);
  assert.match(elements.get('hubCommissionTerms').textContent, /50% deposit/);
  assert.match(elements.get('commissionRequestArtistTerms').textContent, /One revision included/);
  assert.ok(elements.get('hubTransactionLinks').innerHTML.includes('https://ko-fi.com/ari'));
  assert.ok(elements.get('hubTransactionLinks').innerHTML.includes('https://artist.example/portfolio'));

  // Social links are editable per Creator, HTTPS-only, and rendered as click-only profile links.
  const socialProfile = { ...profile, artist_id: '123e4567-e89b-42d3-a456-426614174000', social_links: [] };
  run(`productionAuthMode=false; productionAuthUser=null; creatorProfile=${JSON.stringify(socialProfile)}; activeLocalProfile=${JSON.stringify(local)}; viewArtist=creatorProfile;`);
  elements.get('creatorSocialLinksInput').value = 'Instagram | https://instagram.com/ari\nPortfolio | https://artist.example/ari';
  run(`saveCreatorSocialLinks({preventDefault(){}})`);
  const socialKey = 'artNexusCreatorSocialLinks:123e4567-e89b-42d3-a456-426614174000';
  const savedSocialLinks = JSON.parse(localStorage.getItem(socialKey));
  assert.equal(savedSocialLinks.length, 2);
  assert.equal(savedSocialLinks[0].label, 'Instagram');
  assert.equal(run('creatorProfile.social_links.length'), 2);
  assert.match(elements.get('creatorSocialLinksStatus').textContent, /Saved on this device only/);
  run(`renderCreatorAccountSettings()`);
  assert.match(elements.get('creatorSocialLinksInput').value, /Instagram \| https:\/\/instagram\.com\/ari/);
  run(`renderArtistSocialLinks(creatorProfile)`);
  assert.match(elements.get('hubSocialLinks').innerHTML, /Instagram/);
  assert.match(elements.get('hubSocialLinks').innerHTML, /https:\/\/instagram\.com\/ari/);
  assert.match(elements.get('hubSocialLinks').innerHTML, /referrerpolicy="no-referrer"/);
  assert.doesNotMatch(elements.get('hubSocialLinks').innerHTML, /ready to fill|ARTIST_SOCIAL_LINKS/);
  const normalizedProductionArtist = run(`normalizeProductionPublicArtists([{user_id:'22222222-2222-4222-8222-222222222222',studio_name:'Public Artist',verified_mediums:['Digital Art'],works:[{work_key:'cw-social-test',title:'Sample work',image:'data:image/webp;base64,AAAA',medium:'Digital Art',visibility:'public'}],social_links:[{label:'Instagram',url:'https://instagram.com/public-artist'}]}])[0]`);
  assert.equal(normalizedProductionArtist.social_links, undefined, 'cross-account social-link publication remains gated on live inventory review');
  run(`renderArtistSocialLinks({id:'production-social',name:'Public Artist',isProductionArtist:true,social_links:[{label:'Instagram',url:'https://instagram.com/public-artist'}]})`);
  assert.equal(elements.get('hubSocialLinks').hidden, true, 'production social links are not exposed before separate approval');
  assert.equal(run(`parseCreatorSocialLinkRows([{label:'Instagram',url:'https://instagram.com/ari'}]).links[0].label`), 'Instagram');
  assert.match(run(`parseCreatorSocialLinkRows([{label:'Instagram',url:'http://instagram.com/ari'}]).error`), /HTTPS URL/);
  const youtubeRelease = run(`normalizeCreatorVideoRelease({id:'cv-legacy-private',title:'Private legacy video',video_url:'https://youtu.be/abcdefghijk',visibility:'private'})`);
  assert.equal(youtubeRelease.visibility, 'private', 'normalization preserves legacy private video drafts');
  assert.equal(youtubeRelease.thumbnail_url, 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg', 'YouTube thumbnail URLs are derived without loading a player');
  const vimeoDetails = run(`getCreatorVideoProviderDetails('https://vimeo.com/123456789')`);
  assert.equal(vimeoDetails.provider, 'vimeo');
  assert.match(vimeoDetails.embedUrl, /^https:\/\/player\.vimeo\.com\/video\/123456789\?/);
  assert.equal(run(`safeCreatorVideoThumbnailUrl('https://example.test/video/abc.jpg')`), '', 'unapproved thumbnail hosts are rejected');
  elements.get('creatorSocialLinksInput').value = 'Unsafe | http://example.test/profile';
  run(`saveCreatorSocialLinks({preventDefault(){}})`);
  assert.match(elements.get('creatorSocialLinksStatus').textContent, /valid HTTPS URL/);
  assert.deepEqual(JSON.parse(localStorage.getItem(socialKey)), savedSocialLinks, 'invalid links do not overwrite saved profile entries');
  assert.equal(run(`loadCreatorSocialLinksForId('22222222-2222-4222-8222-222222222222').length`), 0, 'social links do not leak to a different Creator account');
  const videoStorageKey = 'artNexusCreatorVideoReleases:123e4567-e89b-42d3-a456-426614174000';
  localStorage.setItem(videoStorageKey, JSON.stringify([{ id: 'cv-snapshot-test', title: 'Local video', description: '', video_url: 'https://video.example/local', visibility: 'public' }]));
  localStorage.setItem('artNexusCreatorWorks', '[]');
  assert.equal(run(`buildCreatorProfileFromSession({role:'Creator',name:'Ari',studio_name:'Ari',artist_id:'123e4567-e89b-42d3-a456-426614174000'}).social_links.length`), 2, 'Creator profile restoration hydrates its scoped social links');
  assert.equal(run(`buildCreatorProfileFromSession({role:'Creator',name:'Ari',studio_name:'Ari',artist_id:'123e4567-e89b-42d3-a456-426614174000'}).video_releases[0].id`), 'cv-snapshot-test', 'Creator profile restoration hydrates its scoped video releases');
  assert.equal(run(`isLocalPillarStateStorageKey(${JSON.stringify(socialKey)})`), true, 'social links are preserved in account-isolation snapshots');
  assert.equal(run(`isLocalPillarStateStorageKey(${JSON.stringify(videoStorageKey)})`), true, 'video releases are preserved in account-isolation snapshots');
  assert.equal(run(`isLocalPillarStateStorageKey('artNexusCreatorWorks')`), true, 'published local work is preserved in account-isolation snapshots');
  const snapshotOwner = { id: '123e4567-e89b-42d3-a456-426614174000', email: 'ari@example.test', role: 'creator' };
  assert.equal(run(`saveLocalPillarStateSnapshot(${JSON.stringify(snapshotOwner)})`), true);
  const snapshotKey = run(`localPillarStateStorageKey(${JSON.stringify(snapshotOwner)})`);
  const savedLocalState = JSON.parse(localStorage.getItem(snapshotKey));
  assert.ok(savedLocalState.storage[socialKey]);
  assert.ok(savedLocalState.storage[videoStorageKey]);
  assert.ok(savedLocalState.storage.artNexusCreatorWorks);
  run(`localStorage.removeItem(${JSON.stringify(socialKey)}); localStorage.removeItem(${JSON.stringify(videoStorageKey)}); localStorage.removeItem('artNexusCreatorWorks');`);
  assert.equal(run(`restoreLocalPillarStateSnapshot(${JSON.stringify(snapshotOwner)})`), true);
  assert.deepEqual(JSON.parse(localStorage.getItem(socialKey)), savedSocialLinks);
  assert.equal(JSON.parse(localStorage.getItem(videoStorageKey))[0].id, 'cv-snapshot-test');
  assert.equal(localStorage.getItem('artNexusCreatorWorks'), '[]');

  // An artist with explicitly open public commission data can be preview-requested; it is saved locally, never delivered remotely.
  const publicArtist = { id: 'production-22222222222242228222222222222222', artist_id: '22222222-2222-4222-8222-222222222222', name: 'Remote Artist', isProductionArtist: true, commissionAvailabilityKnown: true, openForCommissions: true, availableSlots: 3, commissionTerms: 'Artist-provided terms', commissionPaymentMethods: ['Artist-listed method'] };
  run(`productionAuthMode=true; productionAuthUser={id:'33333333-3333-4333-8333-333333333333',role:'collector',displayName:'Collector',email:'collector@example.test'}; activeLocalProfile=null; viewArtist=${JSON.stringify(publicArtist)}; activateModal=function(){}; deactivateModal=function(){}; showToast=function(){}; renderProfileAccess=function(){};`);
  run(`updateCommissionProfileCTA()`);
  assert.equal(elements.get('hubCommissionBtn').hidden, true, 'commission request UI is hidden in the reversible community edition');
  assert.equal(run('COMMUNITY_EDITION_FUTURE_FEATURES.commissions'), false);
  run(`openCommissionRequestForm(viewArtist)`);
  assert.equal(elements.get('commissionRequestArtistName').textContent, 'Commission details · Remote Artist');
  assert.equal(elements.get('commissionRequestArtistTerms').textContent, 'Artist-provided terms');
  elements.get('commissionRequestClient').value = 'Collector';
  elements.get('commissionRequestTitleInput').value = 'Portrait commission';
  elements.get('commissionRequestBudget').value = '7000';
  elements.get('commissionRequestUsage').value = 'Personal use';
  elements.get('commissionRequestBrief').value = 'One portrait';
  run(`submitCommissionRequest({preventDefault(){}})`);
  const savedProposal = JSON.parse(localStorage.getItem('artNexusLocalCommissionProposals:33333333-3333-4333-8333-333333333333'))[0];
  assert.equal(savedProposal.targetArtistName, 'Remote Artist');
  assert.equal(savedProposal.status, 'Local_Preview_Only');
  assert.equal(savedProposal.deliveryStatus, 'Local preview only · not sent');
  assert.match(run('localCommissionProposalHistoryMarkup()'), /not delivered to artists/i);
  assert.match(elements.get('commissionRequestFeedback').textContent, /not delivered to the artist/i);

  // In-development profile controls stay hidden; an available avatar opens uncropped and closes accessibly.
  run(`renderArtistSocialLinks=function(){}; renderArtistCommissionDetails=function(){}; renderArtistRecommendations=function(){}; getArtistTransactionLinks=function(){return []}; updateCommissionProfileCTA=function(){document.getElementById('hubCommissionBtn').hidden=true}; viewArtist={id:'production-profile-photo',name:'Sample Artist',isProductionArtist:true,works:[],medium:'Painting',avatar:'data:image/jpeg;base64,AAAA'}; renderArtistHub()`);
  assert.equal(elements.get('hubCollabBtn').hidden, true);
  assert.equal(elements.get('hubActions').hidden, true);
  assert.equal(elements.get('hubAvatar').disabled, false);
  assert.match(elements.get('hubAvatar').innerHTML, /<img/);
  assert.equal(run('currentArtistProfilePhoto.name'), 'Sample Artist');
  run(`openArtistProfilePhoto()`);
  assert.equal(elements.get('artistPhotoLightbox').hidden, false);
  assert.equal(elements.get('artistPhotoFullImage').src, 'data:image/jpeg;base64,AAAA');
  assert.match(elements.get('artistPhotoFullImage').alt, /shown uncropped/);
  run(`closeArtistProfilePhoto()`);
  assert.equal(elements.get('artistPhotoLightbox').hidden, true);
  run(`getCreatorPublicWorks=function(){return []}; getCreatorOwnedWorks=function(){return []}; getCreatorVideoReleases=function(){return []}; viewArtist={id:'creator-self',name:'My Studio',isCreatorProfile:true,works:[],projects:[],medium:'Painting',avatar:'data:image/jpeg;base64,AAAA'}; renderArtistHub()`);
  assert.equal(elements.get('hubCollabBtn').hidden, false);
  assert.equal(elements.get('hubCollabBtn').textContent, 'Edit Profile', 'hiding collaboration preserves the Creator self-edit action');
  assert.equal(elements.get('hubActions').hidden, false);

  // The rating prompt is device-local, survives app-version changes, and has no active review destination.
  const ratingCard = document.getElementById('integratedRatingCard');
  ratingCard.hidden = false;
  run(`dismissRatingPrompt(true)`);
  assert.equal(ratingCard.hidden, true);
  assert.equal(localStorage.getItem('artNexusIntegratedRatingCardHidden'), '1');
  ratingCard.hidden = false;
  run(`syncIntegratedRatingCard()`);
  assert.equal(ratingCard.hidden, true, 'the stable hide preference is restored across dashboard openings');
  localStorage.removeItem('artNexusIntegratedRatingCardHidden');
  run(`syncIntegratedRatingCard()`);
  assert.equal(ratingCard.hidden, false);

  console.log('V8 frontend regression passed: separate personal/studio names, one-time device welcome, Portfolio/Browse responsive sizing with uncropped orientation-aware art, hidden future navigation links, disabled Drive routes, local-only artwork actions, profile-photo lightbox, rating-prompt dismissal, and Folio controls.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
