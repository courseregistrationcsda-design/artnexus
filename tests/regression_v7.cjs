const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(projectRoot, 'src', 'app.src.html'), 'utf8');
assert.match(html, /window\.setTimeout\(openCreatorStudioDashboard, 320\)/);
assert.match(html, /onclick="openProfileAccess\(this\)" aria-label="Open My Profile options" aria-haspopup="menu"/);
assert.match(html, /id="profileAccessMenu" role="menu"[\s\S]*?handleProfileAccessMenuKeydown/);
assert.match(html, /function rememberSignedOutCreatorPreviewOwner\(profile\)/);
assert.match(html, /function loadSignedOutCreatorPreview\(\)/);
assert.match(html, /window\.location\.reload\(\)/);
assert.match(html, /artNexusLocalProfileState:/);
assert.doesNotMatch(html, /function restoreFollowingState|function toggleFollowArtist|artNexusFollowingArtists/);
assert.match(html, /function saveLocalPillarStateSnapshot\(/);
assert.match(html, /artNexusLocalPillarState:/);
assert.match(html, /CLOUD_STATE_EXACT_KEYS = new Set\(\['artNexusUserSession'\]\)/);

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
const document = {
  querySelectorAll() { return []; }, querySelector() { return null; }, addEventListener() {}, removeEventListener() {},
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
const timers = [];
const window = {
  localStorage, document,
  crypto: { randomUUID() { return '123e4567-e89b-42d3-a456-426614174000'; }, getRandomValues(a) { a.fill(1); return a; } },
  setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {},
  requestAnimationFrame(fn) { fn(); }, addEventListener() {}, removeEventListener() {},
  matchMedia() { return { matches: false }; }, getComputedStyle() { return { display: 'block', visibility: 'visible' }; },
  location: { href: 'https://local.test/', protocol: 'https:' }
};
window.location.reload = function() { window.__reloadCount = (window.__reloadCount || 0) + 1; };
const ctx = {
  window, document, localStorage, console, Math, Date, JSON, Set, Map, Array, Number, String, RegExp, Uint8Array,
  MutationObserver: undefined, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
  requestAnimationFrame: window.requestAnimationFrame, fetch: async () => { throw new Error('network disabled in harness'); },
  URL, Blob, FileReader: function () {}, navigator: { userAgent: 'test' }, crypto: window.crypto
};
vm.createContext(ctx);
vm.runInContext(script, ctx, { timeout: 10000 });
const run = code => vm.runInContext(code, ctx, { timeout: 10000 });
for (const id of ['profileAccessOverlay', 'profileAccessMenu', 'profileAccessContent', 'profileAccessSignInEmail', 'profileAccessName', 'onboardingOverlay', 'creatorStudioDashboard', 'screenArtistProfile', 'toast']) elements.set(id, new E(id));
elements.get('creatorStudioDashboard').hidden = true;
elements.get('profileAccessOverlay').classList.add('hidden');
elements.get('profileAccessMenu').hidden = true;
elements.get('profileAccessMenu').inert = true;
elements.get('onboardingOverlay').classList.add('hidden');
const headerProfileButton = new E('header-profile-button');
headerProfileButton.classList.add('header-profile-button');
elements.set('header-profile-button', headerProfileButton);

// Keep the real snapshot and account-switch logic while isolating unrelated page rendering in this harness.
run(`
  renderAll=function(){};
  renderCart=function(){};
  window._renderProfileAccessOriginal=renderProfileAccess;
  renderProfileAccess=function(){};
  updateHeaderProfileAvatars=function(){};
  loadCreatorOperationalState=function(){};
  initFeedFilters=function(){};
  applyFeedFilters=function(){};
  renderArtistsList=function(){};
  renderCreatorMediumTags=function(){};
  closeOnboarding=function(){};
  attachLandingBackdropToSignUp=function(){};
  restoreLandingBackdropToSplash=function(){};
  showToast=function(){};
`);

const profileA = { name: 'Ari', email: 'ari@example.test', avatar: '', createdAt: '2026-10-15T00:00:00.000Z' };
const profileB = { name: 'Bia', email: 'bia@example.test', avatar: '', createdAt: '2026-10-15T00:00:00.000Z' };
const creatorSessionA = {
  role: 'Creator', name: 'Ari Studio', bio: 'Saved bio', studio_name: 'Ari Studio', biography: 'Saved bio',
  email: profileA.email, artist_id: '123e4567-e89b-42d3-a456-426614174000',
  verified_mediums: ['Digital Art'], medium: 'Digital Art', interests: ['Illustration'], createdAt: '2026-10-15T00:00:00.000Z'
};
const savedWork = {
  id: 'cw-saved-work', title: 'Saved Portfolio Piece', description: 'Saved locally',
  image: 'data:image/webp;base64,YQ==', medium: 'Digital Art', status: 'unlisted', visibility: 'private', local_only_draft: true, is_for_sale: false
};
const savedProject = {
  id: 'wp-saved-project', project_name: 'Saved WIP', status_summary: 'In progress', completion_percentage: 45,
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z',
  milestones: [{ id: 'wm-saved-update', timestamp: '2026-10-10T00:00:00.000Z', log_text: 'Saved project update' }]
};
localStorage.setItem('artNexusLocalPreviewProfiles', JSON.stringify([profileA, profileB]));
localStorage.setItem('artNexusUserSession', JSON.stringify(creatorSessionA));
localStorage.setItem('artNexusCreatorWorks', JSON.stringify([savedWork]));
localStorage.setItem('artNexusCreatorWipProjects', JSON.stringify([savedProject]));
localStorage.setItem('artNexusArtworkActivity', JSON.stringify({ bookmarkedIds: ['creator:cw-saved-work'], heartedIds: ['creator:cw-saved-work'], meta: { 'creator:cw-saved-work': { title: 'Saved Portfolio Piece', artist: 'Ari Studio', updatedAt: '2026-10-14T00:00:00.000Z' } } }));
localStorage.setItem('artNexusCreatorTransactionLinks:123e4567-e89b-42d3-a456-426614174000', JSON.stringify([{ label: 'Artist site', url: 'https://artist.example.test/' }]));
localStorage.setItem('artNexusLocalCommissionProposals:local-ari%40example.test', JSON.stringify([{ id: 'proposal-ari', targetArtistName: 'Marco', status: 'Local_Preview_Only' }]));
localStorage.setItem('artNexusCreatorCommissionSettings:123e4567-e89b-42d3-a456-426614174000', JSON.stringify({ openForCommissions: false, availableSlots: 2 }));
run(`localProfileRecords=[${JSON.stringify(profileA)},${JSON.stringify(profileB)}]; activeLocalProfile=localProfileRecords[0]; persistActiveLocalProfileSession(activeLocalProfile); creatorProfile=buildCreatorProfileFromSession(JSON.parse(localStorage.getItem('artNexusUserSession'))); creatorProfile.works=loadCreatorWorks(); creatorProfile.projects=loadCreatorWipProjects(); refreshArtworkActivityFromStorage();`);

// Sign-out snapshots local Creator data; only the profile preview is restored while signed out.
run('signOutLocalProfile()');
assert.equal(run('window.__reloadCount'), 1);
// Model the new document after location.reload(): no account session, but the signed-out Creator preview is rebuilt from its protected snapshot.
run('clearLocalProfileRuntimeState(); initOnboarding({skipCreatorRegistrySync:true})');
assert.equal(localStorage.getItem('artNexusLocalProfileSessionEmail'), null);
assert.equal(localStorage.getItem('artNexusUserSession'), null);
assert.equal(localStorage.getItem('artNexusCreatorWorks'), null);
assert.equal(localStorage.getItem('artNexusArtworkActivity'), null);
assert.equal(localStorage.getItem('artNexusCreatorPrivateDrafts'), null);
const ariSnapshotRaw = localStorage.getItem('artNexusLocalProfileState:ari%40example.test');
assert.ok(ariSnapshotRaw);
assert.equal(localStorage.getItem('artNexusSignedOutCreatorPreviewOwner'), profileA.email);
const ariSnapshot = JSON.parse(ariSnapshotRaw);
assert.ok(ariSnapshot.storage.artNexusUserSession);
assert.ok(ariSnapshot.storage.artNexusCreatorPrivateDrafts);
assert.ok(ariSnapshot.storage.artNexusCreatorWipProjects);
assert.ok(ariSnapshot.storage['artNexusCreatorTransactionLinks:123e4567-e89b-42d3-a456-426614174000']);
assert.ok(ariSnapshot.storage['artNexusLocalCommissionProposals:local-ari%40example.test']);
assert.equal(run('activeLocalProfile'), null);
assert.equal(run('isSignedOutCreatorPreview'), true);
assert.equal(run('creatorProfile.name'), 'Ari Studio');
assert.equal(run('creatorProfile.works[0].title'), 'Saved Portfolio Piece');
assert.equal(run('creatorProfile.projects[0].project_name'), 'Saved WIP');
assert.equal(run('artworkActivity.bookmarkedIds.size'), 0);
assert.equal(run('artworkActivity.heartedIds.size'), 0);
assert.equal(run('cart.length'), 0);

// Logged-out My Profile is only a dropdown with Sign Up and Sign In, never the Creator dashboard.
run("openProfileAccess(document.getElementById('header-profile-button'))");
assert.equal(elements.get('profileAccessMenu').hidden, false);
assert.ok(elements.get('profileAccessMenu').innerHTML.includes('Sign Up'));
assert.ok(elements.get('profileAccessMenu').innerHTML.includes('Sign In'));
assert.ok(!elements.get('profileAccessMenu').innerHTML.includes('Creator Studio Dashboard'));
run("openProfileAccessForm('signin')");
assert.equal(elements.get('profileAccessOverlay').classList.contains('hidden'), false);
run("showProfileAccessMode('home')");
assert.equal(elements.get('profileAccessOverlay').classList.contains('hidden'), true);
assert.equal(elements.get('profileAccessMenu').hidden, false);
run('closeProfileAccessMenu(false)');

// Signing back in restores local state without sending a registry request.
run(`window.ART_NEXUS_CREATOR_REGISTRY_ENDPOINT='https://example.test/creator'; window.__registryCalls=0; syncCreatorSessionRegistry=()=>{window.__registryCalls++; return Promise.resolve({synced:true})};`);
elements.get('profileAccessSignInEmail').value = profileA.email;
run('signInLocalProfile({preventDefault(){}})');
assert.equal(run('window.__registryCalls'), 0);
assert.equal(run('activeLocalProfile.email'), profileA.email);
assert.equal(run('creatorProfile.name'), 'Ari Studio');
assert.equal(run('creatorProfile.works[0].title'), 'Saved Portfolio Piece');
assert.equal(run('creatorProfile.projects[0].project_name'), 'Saved WIP');
assert.equal(run("artworkActivity.bookmarkedIds.has('creator:cw-saved-work')"), true);
assert.equal(run("artworkActivity.heartedIds.has('creator:cw-saved-work')"), true);
assert.equal(JSON.parse(localStorage.getItem('artNexusCreatorTransactionLinks:123e4567-e89b-42d3-a456-426614174000'))[0].label, 'Artist site');
assert.equal(JSON.parse(localStorage.getItem('artNexusLocalCommissionProposals:local-ari%40example.test'))[0].id, 'proposal-ari');
assert.equal(localStorage.getItem('artNexusLocalProfileState:ari%40example.test'), null);

// Switching to another local profile saves Ari's state and starts Bia with no cross-account leakage.
elements.get('profileAccessSignInEmail').value = profileB.email;
run('signInLocalProfile({preventDefault(){}})');
assert.equal(run('activeLocalProfile.email'), profileB.email);
assert.equal(run('creatorProfile'), null);
assert.equal(run('artworkActivity.bookmarkedIds.size'), 0);
assert.equal(run('artworkActivity.heartedIds.size'), 0);
assert.equal(run('cart.length'), 0);
assert.equal(localStorage.getItem('artNexusUserSession'), null);
assert.ok(localStorage.getItem('artNexusLocalProfileState:ari%40example.test'));

// State created while Bia is active remains isolated and is restored on her next sign-in.
run(`
  creatorProfile=null;
  artworkActivity.bookmarkedIds.add('feed:22');
  artworkActivity.heartedIds.add('feed:heart-bia');
  artworkActivity.meta['feed:22']={title:'Bia Sketch',artist:'Bia Studio',updatedAt:'2026-10-18T00:00:00.000Z'};
  persistArtworkActivity();
  localStorage.setItem('artNexusUserSession', JSON.stringify({ role:'Creator', name:'Bia Studio', studio_name:'Bia Studio', biography:'Bia bio', email:${JSON.stringify(profileB.email)}, artist_id:'123e4567-e89b-42d3-a456-426614174001', verified_mediums:['Painting'], medium:'Painting' }));
  localStorage.setItem('artNexusCreatorWorks', JSON.stringify([{ id:'cw-bia-work', title:'Bia Portfolio', image:'data:image/webp;base64,Yg==', medium:'Painting', status:'unlisted', visibility:'private', local_only_draft:true }]));
`);
run('signOutLocalProfile()');
elements.get('profileAccessSignInEmail').value = profileA.email;
run('signInLocalProfile({preventDefault(){}})');
assert.equal(run('creatorProfile.name'), 'Ari Studio');
assert.equal(run("artworkActivity.bookmarkedIds.has('creator:cw-saved-work')"), true);
assert.equal(run("artworkActivity.heartedIds.has('creator:cw-saved-work')"), true);
elements.get('profileAccessSignInEmail').value = profileB.email;
run('signInLocalProfile({preventDefault(){}})');
assert.equal(run('creatorProfile.name'), 'Bia Studio');
assert.equal(run('creatorProfile.works[0].title'), 'Bia Portfolio');
assert.equal(run("artworkActivity.bookmarkedIds.has('feed:22')"), true);
assert.equal(run("artworkActivity.bookmarkedIds.has('creator:cw-saved-work')"), false);
assert.equal(run("artworkActivity.heartedIds.has('feed:heart-bia')"), true);
assert.equal(run("artworkActivity.heartedIds.has('creator:cw-saved-work')"), false);

// Logged-in Creator menu offers the dashboard, edit flow and sign-out; the dashboard isn't in the logged-out menu.
run("openProfileAccess(document.getElementById('header-profile-button'))");
assert.equal(elements.get('profileAccessMenu').hidden, false);
assert.ok(elements.get('profileAccessMenu').innerHTML.includes('Creator Studio Dashboard'));
assert.ok(elements.get('profileAccessMenu').innerHTML.includes('Edit Creator Profile'));
assert.ok(elements.get('profileAccessMenu').innerHTML.includes('Sign Out'));
run(`window._savedCreatorProfile=creatorProfile; creatorProfile=null; renderProfileAccessMenu()`);
assert.ok(!elements.get('profileAccessMenu').innerHTML.includes('Creator Studio Dashboard'));
assert.ok(!elements.get('profileAccessMenu').innerHTML.includes('Edit Creator Profile'));
assert.ok(elements.get('profileAccessMenu').innerHTML.includes('Set Up Creator Profile'));
assert.ok(elements.get('profileAccessMenu').innerHTML.includes('Sign Out'));
run(`creatorProfile=window._savedCreatorProfile; delete window._savedCreatorProfile; renderProfileAccessMenu()`);
run('closeProfileAccessMenu(false)');

// Regression: Edit Creator Profile closes the higher-z-index My Profile overlay before launching Creator Setup.
run(`
  resetCreatorWorkUploadForm=function(){};
  renderCreatorWorkManager=function(){};
  renderCreatorWipDashboard=function(){};
  attachLandingBackdropToSignUp=function(){};
  restoreLandingBackdropToSplash=function(){};
  document.getElementById('profileAccessOverlay').classList.remove('hidden');
  document.getElementById('onboardingOverlay').classList.add('hidden');
  activeModalRoot=document.getElementById('profileAccessOverlay');
  modalStack=[];
  modalReturnFocus=document.getElementById('header-profile-button');
  editCreatorProfile();
`);
assert.equal(elements.get('profileAccessOverlay').classList.contains('hidden'), true);
assert.equal(elements.get('onboardingOverlay').classList.contains('hidden'), false);
assert.equal(run('activeModalRoot.id'), 'onboardingOverlay');
assert.equal(run('modalStack.length'), 0);
assert.equal(elements.get('creatorName').value, 'Bia Studio');
console.log('V7 local-account regression passed: sign-out preserves private Creator drafts, WIP, links, proposals, bookmarks and device-local hearts in account snapshots; signed-out My Profile shows Sign Up/Sign In; local account data restores without cross-account leakage.');
