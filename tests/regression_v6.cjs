const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(projectRoot, 'src', 'app.src.html'), 'utf8');
assert.match(html, /<\/body>\s*<\/html>\s*$/i, 'app source must end at the document boundary with no trailing text fragments');
assert.equal((html.match(/<\/html>/gi) || []).length, 1, 'app source must contain exactly one closing html tag');
const previewAssetMap = Object.fromEntries([
  'art-moth.jpg','art-creature.jpg','art-doll.jpg','art-megaphone.jpg','art-anime.jpg',
  'art-silhouettes.jpg','art-mask.jpg','art-streetlight.jpg','art-birdcage.jpg','art-moonless.jpg',
  'art-eye-mural.jpg','art-balloons.jpg','art-river.jpg','art-market.jpg','art-terracotta.jpg',
  'art-celadon.jpg','art-carabao.jpg','art-tapestry.jpg','art-indigo.jpg','art-wovenface.jpg'
].map((name,index)=>[name,`data:image/jpeg;base64,${Buffer.from(`preview-${index}`).toString('base64')}`]));
assert.match(html, /id="welcomeSplashMessage" aria-label="Welcome to Art Nexus">Welcome to<\/h1>/);
assert.match(html, /class="welcome-splash-logo" data-img="logo-amber-on-dark\.png" alt="" aria-hidden="true"/);
assert.match(html, /\.welcome-splash-whiteout \{[^}]*var\(--cordillera-void\)/);
assert.match(html, /\.welcome-splash-logo \{[^}]*width: min\(42cqw, 180px\)/);
assert.match(html, /\.welcome-splash-subtitle \{[^}]*color: var\(--nexus-amber\)/);
assert.match(html, /\.welcome-creator-identifier \{[\s\S]*?font-family: var\(--font-stack\);[\s\S]*?font-size: var\(--welcome-name-size/);
assert.ok(html.includes('function setWelcomeCreatorIdentifier(name)'));
assert.ok(html.includes('Math.min(42, frameWidth * 0.12, frameHeight * 0.10)'));
assert.ok(html.includes('function renderWelcomeArtworkCollage()'));
assert.match(html, /\.welcome-splash\.is-animating \.welcome-art-tile[\s\S]*?animation: welcomeArtJourney 3880ms linear/);
assert.match(html, /@keyframes welcomeArtJourney[\s\S]*?scale\(0\.06\)[\s\S]*?scale\(3\.2\)[\s\S]*?opacity: 0/);
assert.doesNotMatch(html, /welcomeCoreZoom|scale\(500\)/);
assert.ok(!html.includes('See Full Gallery'));
assert.match(html, /id="screenArtistProfile"[\s\S]*?<\/div>\s*<\/div>\s*<div class="commission-request-overlay"/);
assert.ok(html.includes('Similar Artworks &amp; Styles'));
assert.match(html, /id="hubExploreMore" aria-controls="hubRecommendations" aria-describedby="hubExploreMoreHint" onclick="scrollToArtistRecommendations\(\)">Explore More<\/button>/);
assert.match(html, /id="hubExploreMoreHint">Return to Browse with these four previewed artworks prioritized at the top\./);
assert.match(html, /id="hubRecommendationsBack" onclick="closeArtistHub\(\)" aria-label="Return to the Browse window">← Back to Browse<\/button>/);
assert.match(html, /id="hubRecommendationGrid"[\s\S]*?id="hubRecommendationStyles"/);
assert.match(html, /\.artist-hub\.fade-to-browse:not\(\.open\) \{[\s\S]*?opacity: 0;[\s\S]*?transition: opacity 180ms ease-out, visibility 0s linear 180ms;/);
assert.doesNotMatch(html, /hubRecommendationsLift|hub-recommendations\.is-entering/);
assert.ok(!html.includes('class="feed-mode-row"'));
assert.match(html, /Folio Stacks first; artwork cards shuffle on each visit[\s\S]*?Choose pages or infinite scroll; no engagement ranking/);
assert.match(html, /id="feedModeToggle"[^>]*role="switch"[^>]*aria-checked="false"/);
assert.match(html, /aria-label="Infinite scroll" aria-describedby="feedModeHelp"/);
assert.match(html, /let infiniteScrollEnabled = false/);
assert.match(html, /id="folioStackHeartBtn"[^>]*data-artwork-action="heart"/);
assert.match(html, /function toggleArtworkHeart\(id\)/);
assert.match(html, /const activityActions = renderArtworkActivityButtons\(activityKey, card\.title\)/);
assert.match(html, /\$\{activityActions\}/);
assert.doesNotMatch(html, /folioStackHeartCount|artworkHeartCount|publicLikeCount/);
assert.match(html, /Folio Stacks remain first; cards within each group receive a session-stable random order/);
assert.ok(html.includes('FOLIO STACK</span>'));
assert.ok(html.includes('FOLIO STACK · <span id="folioStackImageCount">0 IMAGES</span>'));
assert.ok(html.includes('function moveCreatorFolioSlide(index, delta)'));
assert.ok(html.includes('border: 0; line-height: 0; scroll-snap-align: start;'));
assert.match(html, /\.folio-stack-gallery\.is-carousel \{[^}]*--folio-carousel-card-size: clamp\(220px, 42%, 280px\);[^}]*gap: 8px;[^}]*scroll-snap-type: x mandatory/);
assert.match(html, /\.folio-stack-gallery\.is-carousel::after \{[^}]*calc\(100% - var\(--folio-carousel-card-size\)\)/);
assert.match(html, /\.folio-stack-gallery\.is-carousel \{ --folio-carousel-card-size: 74%;/);
assert.ok(html.includes('function canPersistDeviceWelcome()'));
assert.match(html, /\.screen\[hidden\] \{ display: none !important; \}/);
const rippleRule = html.match(/\.landing-water-ripple \{[\s\S]*?\n        \}/);
assert.ok(rippleRule && rippleRule[0].includes('filter: blur(22px)'));
assert.ok(rippleRule && rippleRule[0].includes('border: 0'));
let script = require('./helpers/inline_app_script.cjs')(html, projectRoot);
script = script.replace(/\/\* ---------- INIT ---------- \*\/[\s\S]*$/, '');
const store = new Map();
const classes = () => ({ set:new Set(), add(x){this.set.add(x)}, remove(x){this.set.delete(x)}, contains(x){return this.set.has(x)}, toggle(x,v){ if (v === undefined) v=!this.set.has(x); v?this.set.add(x):this.set.delete(x); return v } });
class E {
  constructor(id=''){this.id=id;this.value='';this.textContent='';this.innerHTML='';this.hidden=false;this.inert=false;this.disabled=false;this.attributes={};this.dataset={};this.classList=classes();this.children=[];this.style={values:new Map(),setProperty(k,v){this.values.set(k,String(v))},getPropertyValue(k){return this.values.get(k)||''},removeProperty(k){this.values.delete(k)}};this.attrs=new Map();this.checked=false;this.isConnected=true;this.listeners=new Map();}
  setAttribute(k,v){this.attrs.set(k,String(v));this.attributes[k]=String(v)}
  getAttribute(k){return this.attrs.get(k)||null}
  removeAttribute(k){this.attrs.delete(k);delete this.attributes[k]}
  appendChild(el){this.children.push(el);return el}
  replaceChildren(...els){this.children=els;return undefined}
  querySelector(s){return this.querySelectorMap?.[s]||null}
  querySelectorAll(s){return this.querySelectorAllMap?.[s]||[]}
  addEventListener(type,fn){const rows=this.listeners.get(type)||[];rows.push(fn);this.listeners.set(type,rows)}
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item!==fn))}
  dispatch(type,extra={}){const event={type,target:this,animationName:'',...extra};for(const fn of [...(this.listeners.get(type)||[])])fn(event);return event}
  checkValidity(){return true}
  focus(){this.focused=true}
  scrollIntoView(){this.didScrollIntoView=true}
  scrollTo(options){this.didScroll=true;this.scrollOptions=options; if(options&&typeof options.top==='number')this.scrollTop=options.top; if(options&&typeof options.left==='number')this.scrollLeft=options.left}
  getBoundingClientRect(){return this.rect||{top:0,left:0,right:0,bottom:0,width:0,height:0}}
  closest(){return null}
  getClientRects(){return [{width:1,height:1}]}
}
const elements = new Map();
const document = {
  querySelectorAll(){return []}, querySelector(){return null}, addEventListener(){}, removeEventListener(){},
  getElementById(id){if (!elements.has(id)) elements.set(id,new E(id)); return elements.get(id)},
  createElement(tag){return new E(tag)},
  documentElement:new E('html'), body:new E('body'), activeElement:new E('active')
};
for (const id of ['hubCommissionBtn','profileAccessOverlay','onboardingOverlay','creatorSubmitButton','creatorDashboardLaunch','commissionRequestClient','commissionRequestTitleInput','commissionRequestBudget','commissionRequestUsage','commissionRequestBrief','commissionRequestFeedback','commissionRequestOverlay','creatorCommissionQueueList','creatorCommissionPendingCount','creatorStudioAlertCount','creatorStudioAlertTray','creatorAutomationEventLog','creatorCommissionGovernorStatus','creatorCommissionsOpen','creatorAvailableSlots','toast','hubRecommendationStyles','hubRecommendationGrid','hubRecommendations','hubRecommendationsTitle','hubRecommendationsBack','hubExploreMore','screenArtistProfile','hubScroller','browse-focus-return','panel-portfolio','panel-wips','panel-recents']) elements.set(id,new E(id));
const localStorage = {
  get length(){return store.size},
  key(index){return Array.from(store.keys())[index]??null},
  getItem(k){return store.has(k)?store.get(k):null},
  setItem(k,v){store.set(k,String(v))},
  removeItem(k){store.delete(k)}
};
const scheduledTimers = [];
const window = {
  localStorage, document, crypto:{randomUUID(){return '123e4567-e89b-42d3-a456-426614174000'},getRandomValues(a){a.fill(1);return a}},
  setTimeout(fn,ms){scheduledTimers.push({fn,ms});return scheduledTimers.length}, clearTimeout(id){if(scheduledTimers[id-1]) scheduledTimers[id-1].cleared=true}, requestAnimationFrame(fn){fn()}, addEventListener(){}, removeEventListener(){},
  matchMedia(){return {matches:false}}, getComputedStyle(){return {display:'block',visibility:'visible'}}, location:{href:'https://local.test/'}
};
const ctx = {window,document,localStorage,console,Math,Date,JSON,Set,Map,Array,Number,String,RegExp,Uint8Array,MutationObserver:undefined,
  setTimeout:window.setTimeout, clearTimeout:window.clearTimeout, requestAnimationFrame:window.requestAnimationFrame,
  fetch:async()=>{throw new Error('no network in harness')}, URL, Blob, FileReader:function(){},
  navigator:{userAgent:'test'}, crypto:window.crypto};
vm.createContext(ctx);
vm.runInContext(script, ctx, {timeout:10000});
const run = code => vm.runInContext(code, ctx, {timeout:10000});
// Preserve the modal-manager implementations before replacing them for the Creator Setup handoff test.
run(`window._realActivateModal=activateModal; window._realDeactivateModal=deactivateModal`);
// Regression: opening Creator Setup from My Profile closes the higher-z-index parent before launch.
run(`restoreLandingBackdropToSplash=function(){}; attachLandingBackdropToSignUp=function(){}; resetCreatorWorkUploadForm=function(){}; resetToStepGate=function(){}; activateModal=function(root){activeModalRoot=root}; modalStack=[]; modalReturnFocus=document.getElementById('header-profile-button'); activeModalRoot=document.getElementById('profileAccessOverlay'); document.getElementById('profileAccessOverlay').classList.remove('hidden'); openOnboarding()`);
assert.equal(elements.get('profileAccessOverlay').classList.contains('hidden'),true);
assert.equal(elements.get('onboardingOverlay').classList.contains('hidden'),false);
assert.equal(run(`activeModalRoot.id`),'onboardingOverlay');
assert.equal(run(`modalStack.length`),0);
// Prepare a local Creator profile and target DOM controls.
run(`creatorProfile = {artist_id:'123e4567-e89b-42d3-a456-426614174000', name:'Studio One', studio_name:'Studio One', isCreatorProfile:true, works:[], projects:[]}; viewArtist={id:CREATOR_PROFILE_ID}; creatorCommissionSettings=loadCreatorCommissionSettings(); refreshWipBars=function(){};`);
// Commission data and handlers remain intact; public and Studio controls are reversibly hidden.
assert.equal(run('creatorCommissionSettings.openForCommissions'),true);
assert.equal(run('creatorCommissionSettings.availableSlots'),5);
run(`updateCommissionProfileCTA()`);
assert.equal(elements.get('hubCommissionBtn').hidden,true);
run(`creatorCommissionSettings={openForCommissions:false,availableSlots:5}; updateCommissionProfileCTA()`);
assert.equal(elements.get('hubCommissionBtn').hidden,true, 'closed intake remains hidden without deleting its setting');
run(`creatorCommissionSettings={openForCommissions:true,availableSlots:2}; updateCommissionProfileCTA()`);
assert.equal(elements.get('hubCommissionBtn').hidden,true, 'the CTA stays hidden even when local intake is open');
// The commission dialog must live outside the profile modal so inerting its parent cannot freeze the form.
run(`activateModal=window._realActivateModal; deactivateModal=window._realDeactivateModal; const requestOverlay=document.getElementById('commissionRequestOverlay'); requestOverlay.hidden=true; requestOverlay.inert=true; requestOverlay.setAttribute('aria-hidden','true'); requestOverlay.querySelectorMap={'#commissionRequestClient':document.getElementById('commissionRequestClient')}; const hubRoot=document.getElementById('screenArtistProfile'); hubRoot.inert=false; hubRoot.classList.add('open'); hubRoot.setAttribute('aria-hidden','false'); activeModalRoot=hubRoot; modalStack=[]; modalReturnFocus=document.getElementById('browse-focus-return'); modalBackgroundState=[]; openCommissionRequestForm()`);
assert.equal(elements.get('commissionRequestOverlay').hidden, false);
assert.equal(elements.get('commissionRequestOverlay').inert, false);
assert.equal(elements.get('commissionRequestOverlay').getAttribute('aria-hidden'), 'false');
assert.equal(elements.get('commissionRequestClient').focused, true);
assert.equal(run('activeModalRoot.id'), 'commissionRequestOverlay');
assert.equal(elements.get('screenArtistProfile').inert, true);
run(`closeCommissionRequestForm(false,true)`);
assert.equal(elements.get('commissionRequestOverlay').hidden, true);
assert.equal(run('activeModalRoot.id'), 'screenArtistProfile');
assert.equal(elements.get('screenArtistProfile').inert, false);
run(`activateModal=window._realActivateModal; deactivateModal=window._realDeactivateModal`);
// Local commission submission creates a pending request and event preview.
elements.get('commissionRequestClient').value='Ari';
elements.get('commissionRequestTitleInput').value='Digital mural';
elements.get('commissionRequestBudget').value='8000';
elements.get('commissionRequestUsage').value='Commercial digital use only';
elements.get('commissionRequestBrief').value='A three-panel concept';
run(`submitCommissionRequest({preventDefault(){}})`);
let reqs = JSON.parse(localStorage.getItem('artNexusCreatorCommissionRequests:123e4567-e89b-42d3-a456-426614174000'));
assert.equal(reqs.length,1); assert.equal(reqs[0].status,'Pending_Acceptance'); assert.equal(reqs[0].intendedUsage,'Commercial digital use only');
assert.ok(elements.get('creatorCommissionQueueList').innerHTML.includes('Intended usage rights:'));
assert.ok(elements.get('creatorCommissionQueueList').innerHTML.includes('✓ Accept Proposal'));
assert.ok(elements.get('creatorCommissionQueueList').innerHTML.includes('✕ Decline Request'));
assert.ok(elements.get('creatorCommissionQueueList').innerHTML.includes('Digital mural')); assert.ok(elements.get('creatorCommissionQueueList').innerHTML.includes('Ari'));
assert.ok(elements.get('creatorCommissionQueueList').innerHTML.includes(reqs[0].id));
assert.equal(elements.get('creatorStudioAlertCount').textContent,'1');
assert.equal(reqs[0].deliveryStatus,'Local preview only · not sent');
// Accept consumes one slot and resolves the commission locally.
const requestId = reqs[0].id;
run(`resolveCreatorQueueItem(${JSON.stringify(requestId)}, 'commission-request', 'accept')`);
reqs = JSON.parse(localStorage.getItem('artNexusCreatorCommissionRequests:123e4567-e89b-42d3-a456-426614174000'));
assert.equal(reqs[0].status,'In_Production');
assert.equal(run('creatorCommissionSettings.availableSlots'),1);
assert.equal(elements.get('creatorStudioAlertCount').textContent,'0');
// Legacy checkout/order capture remain disabled; the new Browse mode switch is exercised below.
assert.equal(run('NONPROFIT_PILLARS_LOCAL_MODE'), true);
assert.doesNotMatch(html, /artNexusLocalDemoOrderQueue|toggleFolioStackLike/);
// Public WIP/Recents tabs preserve the source content and show exact, panel-local overlay text.
const wips=elements.get('panel-wips'); wips.appendChild(new E('existing-wip-content'));
run(`switchProfileTab('wips')`);
const overlay=wips.children.find(el=>el.className==='hub-under-construction-overlay');
assert.ok(overlay);
assert.equal(overlay.textContent,'🛠️ Under Construction • This studio workspace module is migrating to our secure backend pipeline.');
assert.equal(wips.children.length,2);
assert.equal(wips.children[0].inert,true);
run(`switchProfileTab('recents')`);
assert.equal(elements.get('panel-recents').children.find(el=>el.className==='hub-under-construction-overlay').textContent,'🛠️ Under Construction • This studio workspace module is migrating to our secure backend pipeline.');
// V6 availability data remains available to retained code, while every commission badge/CTA stays hidden.
run(`creatorProfile={id:CREATOR_PROFILE_ID,artist_id:'123e4567-e89b-42d3-a456-426614174000',name:'Studio One',studio_name:'Studio One',isCreatorProfile:true,works:[],projects:[]}; viewArtist={id:CREATOR_PROFILE_ID}; creatorCommissionSettings={openForCommissions:true,availableSlots:3}; currentScreen='browse'; updateCommissionProfileCTA()`);
assert.equal(elements.get('hubCommissionBtn').hidden,true);
assert.equal(elements.get('hubCommissionOpenBadge').hidden,true);
assert.ok(run('creatorDirectoryRowMarkup()').includes('data-future-feature="commission"'), 'the future badge implementation remains reversible in source');
assert.equal(run(`artistHasOpenCommissions({id:'test-artist',openForCommissions:true,availableSlots:2})`),true);
assert.equal(run(`artistHasOpenCommissions({id:'test-artist',open_for_commissions:true,available_slots:0})`),false);
run(`creatorCommissionSettings={openForCommissions:false,availableSlots:3}; updateCommissionProfileCTA()`);
assert.equal(elements.get('hubCommissionBtn').hidden,true);
assert.equal(elements.get('hubCommissionOpenBadge').hidden,true);
run(`Object.assign(IMG,${JSON.stringify(previewAssetMap)})`);
// Folio Stacks stay first, while cards flow in a session-randomized order that remains stable across rerenders.
run(`mockArtDatabase=[{id:'single-1',is_folio_stack:false},{id:'folio-1',is_folio_stack:true},{id:'single-2',is_folio_stack:false},{id:'folio-2',is_folio_stack:true}]; promotedRecommendationKeys=[]`);
const randomizedBrowseOrder = run(`getFilteredFeedCards().map(card=>card.id).join('|')`);
assert.deepEqual(randomizedBrowseOrder.split('|').slice(0,2).sort(), ['folio-1','folio-2']);
assert.deepEqual(randomizedBrowseOrder.split('|').slice(2).sort(), ['single-1','single-2']);
assert.equal(run(`getFilteredFeedCards().map(card=>card.id).join('|')`), randomizedBrowseOrder, 'presentation shuffle stays stable between renders');
run(`mockArtDatabase.reverse()`);
assert.equal(run(`getFilteredFeedCards().map(card=>card.id).join('|')`), randomizedBrowseOrder, 'the randomized rank does not depend on source-array order');
assert.match(html, /#app-viewport \.feed-desktop-grid \{[\s\S]*?column-count: 2;[\s\S]*?column-fill: balance;/);
assert.match(html, /#app-viewport \.feed-desktop-grid > \.feed-card \{[\s\S]*?break-inside: avoid;/);
// Explicit Explore More priorities still take precedence over the randomized base order.
run(`mockArtDatabase.find(card=>card.id==='single-1').creatorWorkId='work-one'; promotedRecommendationKeys=['creator:work-one'];`);
assert.equal(run(`getFilteredFeedCards()[0].id`), 'single-1');
// Visitors can switch between 15-item pages and working infinite scroll without losing the selected mode state.
run(`promotedRecommendationKeys=[]; mockArtDatabase=Array.from({length:31},(_,i)=>({id:i+1,title:'Artwork '+(i+1),artist:'marco',image:'missing.jpg',style:'Painting',medium:'Painting',materials:[],is_folio_stack:false})); infiniteScrollEnabled=false; currentFeedPage=1; infiniteVisibleCount=FEED_PAGE_SIZE; feedInfiniteFallbackAttached=false; syncFeedModeToggle()`);
assert.equal(elements.get('feedModeToggle').getAttribute('aria-checked'),'false');
run(`toggleFeedMode(true)`);
assert.equal(run('infiniteScrollEnabled'),true);
assert.equal(elements.get('feedModeToggle').getAttribute('aria-checked'),'true');
assert.equal(elements.get('feedPagination').hidden,true);
assert.equal(elements.get('feedInfiniteStatus').hidden,false);
assert.equal(run('infiniteVisibleCount'),run('FEED_PAGE_SIZE'));
run(`requestMoreInfiniteItems()`);
assert.equal(run('infiniteVisibleCount'),30);
assert.equal((elements.get('masonryDesktopGrid').innerHTML.match(/class="feed-card"/g)||[]).length,30);
run(`toggleFeedMode(false)`);
assert.equal(run('infiniteScrollEnabled'),false);
assert.equal(elements.get('feedModeToggle').getAttribute('aria-checked'),'false');
assert.equal(elements.get('feedPagination').hidden,false);
assert.equal(elements.get('feedInfiniteStatus').hidden,true);
run(`mockArtDatabase=[

  {id:73,artist:'liza',title:'Terracotta Light',image:'art-terracotta.jpg',medium:'Painting'},
  {id:74,artist:'paeng',title:'Blue Passage',image:'art-eye-mural.jpg',medium:'Painting'},
  {id:75,artist:'kaye',title:'Quiet Weather',image:'art-tapestry.jpg',medium:'Painting'},
  {id:76,artist:'noel',title:'Night Market',image:'art-market.jpg',medium:'Painting'}
]; promotedRecommendationKeys=[]`);
// Explore More returns to Browse, clears stale filters, and promotes the four previewed works.
run(`renderArtistRecommendations(ARTISTS.find(artist=>artist.id==='marco'),false)`);
assert.ok(elements.get('hubRecommendationStyles').innerHTML.includes('Style · Painting'));
assert.ok(elements.get('hubRecommendationGrid').innerHTML.includes('hub-recommendation-card'));
assert.match(elements.get('hubRecommendationGrid').innerHTML, /onclick="openArtistRecommendation\('/, 'clicking a similar artwork routes through the Browse-resume handler');
assert.ok(elements.get('hubRecommendationGrid').innerHTML.includes('Marco Reyes')===false);
run(`window._artistRecommendationOriginals={scrollToArtistRecommendations,openArtDetailModal,openCreatorArtwork}; window._artistRecommendationCalls=[]; scrollToArtistRecommendations=function(){window._artistRecommendationCalls.push('fade-to-browse')}; openArtDetailModal=function(id){window._artistRecommendationCalls.push('feed:'+id)}; openCreatorArtwork=function(id){window._artistRecommendationCalls.push('creator:'+id)}; document.getElementById('screenArtistProfile').classList.add('open'); openArtistRecommendation('feed',73); openArtistRecommendation('creator','cw-test')`);
assert.equal(run(`window._artistRecommendationCalls.join('|')`), 'fade-to-browse|feed:73|fade-to-browse|creator:cw-test');
run(`scrollToArtistRecommendations=window._artistRecommendationOriginals.scrollToArtistRecommendations; openArtDetailModal=window._artistRecommendationOriginals.openArtDetailModal; openCreatorArtwork=window._artistRecommendationOriginals.openCreatorArtwork; delete window._artistRecommendationOriginals; delete window._artistRecommendationCalls`);
const artistHub = elements.get('screenArtistProfile');
const previewedKeys = run('lastArtistRecommendationKeys.slice(0,4)');
run(`document.getElementById('feedSearch').value='will-not-match'; document.getElementById('feedArtistFilter').value='marco'`);
scheduledTimers.length=0;
run(`landingReducedMotionQuery={matches:false}; window._exploreMorePromise=scrollToArtistRecommendations()`);
assert.equal(run('currentScreen'),'browse');
assert.equal(artistHub.classList.contains('open'),false);
assert.deepEqual(run('promotedRecommendationKeys'),previewedKeys);
assert.equal(elements.get('feedSearch').value,'');
assert.equal(elements.get('feedArtistFilter').value,'');
assert.deepEqual(run('getFilteredFeedCards().slice(0,4).map(recommendationKeyForFeedCard)'),previewedKeys);
assert.ok(artistHub.classList.contains('fade-to-browse'));
assert.doesNotMatch(html, /function createRecommendationsTransitionClone|function animateRecommendationsTransition|clone\.animate\(/);
assert.match(html, /window\.setTimeout\(\(\) => hub\.classList\.remove\('fade-to-browse'\), 240\)/);
const exploreFadeTimer = scheduledTimers.find(timer => timer.ms === 240);
assert.ok(exploreFadeTimer, 'Explore More clears the temporary fade class after the opacity transition');
exploreFadeTimer.fn();
assert.equal(artistHub.classList.contains('fade-to-browse'), false);
// Artwork detail closes back to Browse without resetting the feed's scroll position.
const browseScroller = elements.get('screenBrowse');
browseScroller.scrollTop = 468;
run(`currentScreen='browse'; modalStack=[]; modalReturnFocus=null; modalBackgroundState=[]; document.getElementById('screenArtDetail').classList.add('open'); activeModalRoot=document.getElementById('screenArtDetail'); closeSale(false,true)`);
assert.equal(run('currentScreen'), 'browse');
assert.equal(elements.get('screenArtDetail').classList.contains('open'), false);
assert.equal(browseScroller.scrollTop, 468);
artistHub.classList.add('open');
artistHub.inert=false;
artistHub.setAttribute('aria-hidden','false');
run(`currentScreen='browse'; activeModalRoot=document.getElementById('screenArtistProfile'); modalStack=[]; modalReturnFocus=document.getElementById('browse-focus-return'); modalBackgroundState=[]; closeArtistHub()`);
assert.equal(artistHub.classList.contains('open'),false);
assert.equal(artistHub.getAttribute('aria-hidden'),'true');
assert.equal(artistHub.inert,true);
assert.equal(run('activeModalRoot'),null);
assert.equal(run('currentScreen'),'browse');
assert.equal(elements.get('browse-focus-return').focused,true);
// Dynamic welcome typography uses the app font and scales a long accented name to fit the frame.
const appViewport=document.getElementById('app-viewport'); appViewport.clientWidth=457; appViewport.clientHeight=557;
run(`setWelcomeCreatorIdentifier('Niño Jose Seriosa')`);
const fittedWelcomeNameSize=parseFloat(elements.get('welcomeCreatorIdentifier').style.getPropertyValue('--welcome-name-size'));
assert.equal(elements.get('welcomeCreatorIdentifier').textContent,'Niño Jose Seriosa');
assert.ok(fittedWelcomeNameSize>=38 && fittedWelcomeNameSize<=42);
// V6 welcome restores the earlier 4-second animated artwork collage, with no 500× brand zoom.
run(`landingVisitorCompleted=false; landingVisitorName=''; landingVisitorNameEdited=false; landingReducedMotionQuery={matches:false}; goTo=function(){currentScreen='browse'}; document.getElementById('landingVisitorName').value='Ari';`);
scheduledTimers.length=0;
run(`submitLandingWelcome({preventDefault(){}})`);
assert.equal(localStorage.getItem('artNexusVisitorDisplayNameV1'),'Ari');
assert.equal(localStorage.getItem('artNexusWelcomeCompletedV1'),'1');
assert.equal(elements.get('welcomeCreatorIdentifier').textContent,'Ari');
assert.equal(elements.get('welcomeSplash').hidden,false);
assert.equal(elements.get('welcomeSplash').classList.contains('is-visible'),true);
assert.equal(elements.get('welcomeSplash').classList.contains('is-animating'),true);
assert.equal(elements.get('welcomeSplash').classList.contains('is-message-visible'),false);
assert.equal(elements.get('welcomeSplashArtwork').children.length,20);
assert.equal(new Set(elements.get('welcomeSplashArtwork').children.map(tile=>tile.src)).size,20);
assert.equal(elements.get('screen-browse').inert,true);
assert.deepEqual(scheduledTimers.map(timer=>timer.ms),[1550,2650,3300,4000]);
scheduledTimers[0].fn();
assert.equal(elements.get('welcomeSplash').classList.contains('is-message-visible'),true);
scheduledTimers[1].fn();
assert.equal(elements.get('welcomeSplash').classList.contains('is-whiteout'),true);
scheduledTimers[2].fn();
assert.equal(elements.get('welcomeSplash').classList.contains('is-final-reveal'),true);
scheduledTimers[3].fn();
assert.equal(elements.get('welcomeSplash').hidden,true);
assert.equal(elements.get('welcomeCreatorIdentifier').textContent,'');
assert.equal(elements.get('welcomeCreatorIdentifier').style.getPropertyValue('--welcome-name-size'),'');
assert.equal(elements.get('screen-browse').inert,false);
// A returning browser skips both splash layers, removes the landing screen immediately, and keeps the device display name.
run(`landingVisitorCompleted=false; landingVisitorName=''; landingVisitorNameEdited=false; currentScreen='landing'; document.getElementById('landingVisitorName').value=''; document.getElementById('screen-landing').hidden=false; document.getElementById('screen-landing').classList.add('active'); document.getElementById('screen-browse').classList.remove('active'); document.getElementById('welcomeSplash').hidden=false; document.getElementById('welcomeSplash').classList.add('is-visible'); initLandingVisitorName()`);
assert.equal(run('landingVisitorCompleted'),true);
assert.equal(run('currentScreen'),'browse');
assert.equal(elements.get('screen-landing').hidden,true);
assert.equal(elements.get('screen-landing').classList.contains('active'),false);
assert.equal(elements.get('screen-browse').classList.contains('active'),true);
assert.equal(elements.get('welcomeSplash').hidden,true);
assert.equal(elements.get('welcomeSplash').classList.contains('is-visible'),false);
assert.equal(run('currentPersonalizedUserName()'),'Ari');
run(`productionAuthMode=true; productionAuthUser={id:'22222222-2222-4222-8222-222222222222',displayName:'Different Account'}; syncPersonalizedBrowseGreeting()`);
assert.equal(run('currentPersonalizedUserName()'),'Different Account');
assert.equal(elements.get('browsePersonalGreeting').textContent,'Welcome, Different Account');
run(`productionAuthUser=null; syncPersonalizedBrowseGreeting()`);
assert.equal(elements.get('browsePersonalGreeting').textContent,'Welcome, Ari');
run(`productionAuthMode=false`);
// If browser storage cannot retain the once-per-device marker, startup still fails open to Browse instead of repeating the splash.
run(`localStorage.removeItem('artNexusVisitorDisplayNameV1'); localStorage.removeItem('artNexusWelcomeCompletedV1'); localStorage.removeItem('artNexusUserSession'); landingVisitorCompleted=false; landingVisitorName=''; landingVisitorNameEdited=false; currentScreen='landing'; document.getElementById('landingVisitorName').value=''; document.getElementById('screen-landing').hidden=false; document.getElementById('screen-landing').classList.add('active'); document.getElementById('screen-browse').classList.remove('active'); window._restoreWelcomeStorageSet=localStorage.setItem; localStorage.setItem=function(){throw new Error('storage blocked')}; initLandingVisitorName()`);
assert.equal(run('currentScreen'),'browse');
assert.equal(elements.get('screen-landing').hidden,true);
assert.equal(elements.get('screen-browse').classList.contains('active'),true);
assert.equal(elements.get('welcomeSplash').hidden,true);
run(`localStorage.setItem=window._restoreWelcomeStorageSet; delete window._restoreWelcomeStorageSet`);
// Reduced motion skips the animation and reveal delay immediately.
const scheduledBeforeReduced=scheduledTimers.length;
run(`landingVisitorCompleted=false; landingVisitorName=''; landingVisitorNameEdited=false; landingReducedMotionQuery={matches:true}; document.getElementById('landingVisitorName').value='Maya'; document.getElementById('screen-landing').hidden=false; document.getElementById('screen-landing').classList.add('active'); document.getElementById('screen-browse').classList.remove('active');`);
run(`submitLandingWelcome({preventDefault(){}})`);
assert.equal(elements.get('welcomeSplash').hidden,true);
assert.equal(elements.get('screen-browse').inert,false);
assert.equal(scheduledTimers.length,scheduledBeforeReduced);
console.log('V6 welcome/status harness passed: returning-device direct Browse with both splashes hidden, blocked-storage fallback, account-specific display-name priority, reduced-motion behavior, Folio-first Browse order, Explore More navigation, and commission availability.');
console.log('Baseline regressions passed: My Profile setup handoff, local-only commission proposal and slot decrement, and public profile migration overlays.');
// V4 Folio Stack schema, builder state, single-card feed representation, and vertical lightbox rendering.
const folioTest = run(`(async()=>{
  creatorProfile={id:CREATOR_PROFILE_ID,artist_id:'123e4567-e89b-42d3-a456-426614174000',name:'Studio One',studio_name:'Studio One',isCreatorProfile:true,verified_mediums:['Digital Art'],works:[],projects:[]};
  creatorCommissionSettings={openForCommissions:true,availableSlots:3};
  setCreatorReleaseMode('folio');
  processCreatorArtworkFile=async file => file.name==='cover.jpg' ? 'data:image/jpeg;base64,YQ==' : file.name==='slide.jpg' ? 'data:image/jpeg;base64,Yg==' : 'data:image/jpeg;base64,Yw==';
  await appendCreatorFolioFiles([{name:'cover.jpg',type:'image/jpeg',size:10},{name:'slide.jpg',type:'image/jpeg',size:10},{name:'slide-third.jpg',type:'image/jpeg',size:10}]);
  moveCreatorFolioSlide(2,-1);
  const orderedImages=creatorFolioSelectedImages.map(slide=>slide.image).join(',');
  const privateDefault=normalizeCreatorWork({id:'cw-private-default',title:'Private by default',image:creatorFolioSelectedImages[0].image,medium:'Digital Art'});
  const work=normalizeCreatorWork({id:'cw-folio-test',title:'Folio Test',description:'A three-image local sequence',image:creatorFolioSelectedImages[0].image,medium:'Digital Art',folio_slides:creatorFolioSelectedImages.slice(1).map(slide=>slide.image),folio_presentation:'carousel',visibility:'public',is_for_sale:false,status:'unlisted'});
  creatorProfile.works=[privateDefault,work];
  const feed=makeCreatorFeedEntry(work,987654321,0);
  mockArtDatabase=[feed];
  return {work,feed,orderedImages,privateDefault};
})()`);
folioTest.then(async ({work,feed,orderedImages,privateDefault})=>{
  assert.equal(privateDefault.visibility,'private');
  assert.equal(run('makeCreatorFeedEntry(creatorProfile.works[0],987654320,0)'),null,'private works do not enter the feed without explicit public visibility');
  assert.equal(work.is_folio_stack,true); assert.equal(work.folio_slides.length,2); assert.equal(work.folio_presentation,'carousel');
  assert.equal(feed.image,'data:image/jpeg;base64,YQ=='); assert.equal(feed.is_folio_stack,true); assert.equal(feed.folio_slides.length,2); assert.equal(feed.folio_presentation,'carousel');
  assert.equal(orderedImages,'data:image/jpeg;base64,YQ==,data:image/jpeg;base64,Yw==,data:image/jpeg;base64,Yg==');
  run(`moveCreatorFolioSlide(1,-1)`);
  assert.equal(run('creatorFolioSelectedImages[0].image'),'data:image/jpeg;base64,YQ==');
  assert.equal(run('creatorFolioSelectedImages.length'),3);
  run(`openFolioStack('cw-folio-test')`);
  const folioGallery=elements.get('folioStackGallery');
  folioGallery.querySelectorAllMap={'.folio-stack-slide':[12,160,308].map((offset,index)=>Object.assign(new E(`folioSlide-${index+1}`),{offsetLeft:offset}))};
  assert.equal(elements.get('folioStackLightbox').hidden,false);
  assert.equal(elements.get('folioLightboxCount').textContent,'3 images · swipe horizontally or use the arrows');
  assert.equal(elements.get('folioStackGallery').classList.contains('is-carousel'),true);
  assert.equal(elements.get('folioStackCarouselControls').hidden,false);
  assert.equal(elements.get('folioStackCarouselStatus').textContent,'Image 1 of 3');
  assert.equal(elements.get('folioStackCarouselPrevious').disabled,true);
  assert.equal(elements.get('folioStackCarouselNext').disabled,false);
  assert.equal(elements.get('folioStackScrollHint').classList.contains('is-visible'),true);
  assert.equal(elements.get('folioStackScrollHintText').textContent,'Swipe or use the arrows to explore all 3 images');
  elements.get('folioStackGallery').clientWidth=320;
  run(`window._folioArrowPrevented=false; handleFolioStackGalleryKeydown({key:'ArrowRight',preventDefault(){window._folioArrowPrevented=true}})`);
  assert.equal(run('window._folioArrowPrevented'),true);
  assert.equal(elements.get('folioStackCarouselStatus').textContent,'Image 2 of 3');
  assert.equal(folioGallery.scrollOptions.left,148,'arrow navigation snaps by the individual card offset, not a full viewport');
  elements.get('folioStackGallery').scrollLeft=160;
  elements.get('folioStackGallery').dispatch('scroll');
  assert.equal(elements.get('folioStackScrollHint').classList.contains('is-visible'),false);
  assert.equal(elements.get('folioStackCarouselStatus').textContent,'Image 2 of 3');
  assert.equal(elements.get('folioStackCarouselPrevious').disabled,false);
  assert.equal(elements.get('folioStackCarouselNext').disabled,false);
  run(`changeFolioStackSlide(1)`);
  assert.equal(elements.get('folioStackCarouselStatus').textContent,'Image 3 of 3');
  assert.equal(elements.get('folioStackCarouselNext').disabled,true);
  assert.ok(elements.get('folioStackGallery').innerHTML.includes('Slide 3 · 3 / 3'));
  assert.ok(elements.get('folioStackGallery').innerHTML.includes('data:image/jpeg;base64,Yw=='));
  assert.equal(elements.get('folioStackFooterTitle').textContent,'Folio Test');
  assert.equal(elements.get('folioStackFooterArtist').textContent,'By Studio One');
  assert.ok(elements.get('folioStackFooterMeta').textContent.includes('Folio Stack'));
  assert.equal(elements.get('folioStackImageCount').textContent,'3 images');
  assert.equal(elements.get('folioLightboxBackdrop').src,'data:image/jpeg;base64,YQ==');
  assert.equal(elements.get('folioLightboxSaleBar').hidden,true,'sale metadata is omitted in local-only mode');
  assert.equal(elements.get('folioStackCommissionAction').hidden,false);
  assert.equal(elements.get('folioStackCommissionAction').disabled,false);
  assert.equal(elements.get('folioStackCommissionAction').textContent,'● Open for Commission');
  assert.ok(html.includes('id="folioStackHeartBtn"'));
  run(`toggleFolioCollectionSave()`);
  assert.equal(elements.get('folioStackSaveCollection').getAttribute('aria-pressed'),'true');
  assert.equal(elements.get('folioStackSaveCollection').classList.contains('is-active'),true);
  run(`toggleArtworkHeart('creator:cw-folio-test')`);
  assert.equal(run(`artworkActivity.heartedIds.has('creator:cw-folio-test')`),true);
  assert.equal(elements.get('folioStackHeartBtn').getAttribute('aria-pressed'),'true');
  assert.ok(JSON.parse(localStorage.getItem('artNexusArtworkActivity')).heartedIds.includes('creator:cw-folio-test'));
  run(`closeFolioStack()`);
  run(`openFolioStack('cw-folio-test')`);
  assert.equal(elements.get('folioStackSaveCollection').getAttribute('aria-pressed'),'true');
  assert.equal(elements.get('folioStackScrollHint').classList.contains('is-visible'),true);
  run(`closeFolioStack()`);
  assert.equal(elements.get('folioStackScrollHint').classList.contains('is-visible'),false);
  run(`removeCreatorFolioSlide(1)`);
  assert.equal(run('creatorFolioSelectedImages.length'),2);
  run(`clearCreatorFolioImages()`);
  assert.equal(run('creatorFolioSelectedImages.length'),0);
  console.log('V6 Folio harness passed: multi-image selection/reordering, Thread-style peek carousel and per-card snapping, cover/slide schema, local footer actions, collection saving, and slide removal.');
  // The retired for-sale publisher and local event-broker harness are intentionally not exercised.
}).catch(error=>{console.error(error);process.exitCode=1;});
