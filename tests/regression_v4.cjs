const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(projectRoot, 'src', 'app.src.html'), 'utf8');
let script = require('./helpers/inline_app_script.cjs')(html, projectRoot);
script = script.replace(/\/\* ---------- INIT ---------- \*\/[\s\S]*$/, '');
const store = new Map();
const classes = () => ({ set:new Set(), add(x){this.set.add(x)}, remove(x){this.set.delete(x)}, contains(x){return this.set.has(x)}, toggle(x,v){ if (v === undefined) v=!this.set.has(x); v?this.set.add(x):this.set.delete(x); return v } });
class E {
  constructor(id=''){this.id=id;this.value='';this.textContent='';this.innerHTML='';this.hidden=false;this.inert=false;this.disabled=false;this.attributes={};this.dataset={};this.classList=classes();this.children=[];this.style={setProperty(){}};this.attrs=new Map();this.checked=false;this.isConnected=true;}
  setAttribute(k,v){this.attrs.set(k,String(v));this.attributes[k]=String(v)}
  getAttribute(k){return this.attrs.get(k)||null}
  removeAttribute(k){this.attrs.delete(k);delete this.attributes[k]}
  appendChild(el){this.children.push(el);return el}
  replaceChildren(...els){this.children=[];this.innerHTML='';this.children.push(...els)}
  querySelector(s){return this.querySelectorMap?.[s]||null}
  querySelectorAll(s){return this.querySelectorAllMap?.[s]||[]}
  addEventListener(){}
  removeEventListener(){}
  focus(){}
  scrollIntoView(){}
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
for (const id of ['hubCommissionBtn','profileAccessOverlay','onboardingOverlay','creatorSubmitButton','creatorDashboardLaunch','commissionRequestClient','commissionRequestTitleInput','commissionRequestBudget','commissionRequestUsage','commissionRequestBrief','commissionRequestFeedback','commissionRequestOverlay','creatorCommissionQueueList','creatorCommissionPendingCount','creatorStudioAlertCount','creatorStudioAlertTray','creatorAutomationEventLog','creatorCommissionGovernorStatus','creatorCommissionsOpen','creatorAvailableSlots','toast','panel-portfolio','panel-wips','panel-recents']) elements.set(id,new E(id));
const localStorage = {
  getItem(k){return store.has(k)?store.get(k):null},
  setItem(k,v){store.set(k,String(v))},
  removeItem(k){store.delete(k)}
};
const window = {
  localStorage, document, crypto:{randomUUID(){return '123e4567-e89b-42d3-a456-426614174000'},getRandomValues(a){a.fill(1);return a}},
  setTimeout(fn){return 1}, clearTimeout(){}, requestAnimationFrame(fn){fn()}, addEventListener(){}, removeEventListener(){},
  matchMedia(){return {matches:false}}, getComputedStyle(){return {display:'block',visibility:'visible'}}, location:{href:'https://local.test/'}
};
const ctx = {window,document,localStorage,console,Math,Date,JSON,Set,Map,Array,Number,String,RegExp,Uint8Array,MutationObserver:undefined,
  setTimeout:window.setTimeout, clearTimeout:window.clearTimeout, requestAnimationFrame:window.requestAnimationFrame,
  fetch:async()=>{throw new Error('no network in harness')}, URL, Blob, FileReader:function(){},
  navigator:{userAgent:'test'}, crypto:window.crypto};
vm.createContext(ctx);
vm.runInContext(script, ctx, {timeout:10000});
const run = code => vm.runInContext(code, ctx, {timeout:10000});
// Poster cards follow image orientation and keep the full image visible. External video URLs are HTTPS links only.
assert.equal(run(`safeCreatorExternalVideoUrl('https://youtu.be/example')`), 'https://youtu.be/example');
assert.equal(run(`safeCreatorExternalVideoUrl('http://video.example/watch')`), '');
assert.equal(run(`safeCreatorExternalVideoUrl('javascript:alert(1)')`), '');
assert.equal(run(`safeCreatorExternalVideoUrl('https://user:pass@video.example/watch')`), '');
assert.equal(run(`normalizeCreatorWork({id:'cw-video-safe',title:'Video',image:'data:image/webp;base64,YQ==',medium:'Digital Art',video_url:'https://youtu.be/example'}).video_url`), 'https://youtu.be/example');
assert.equal(run(`normalizeCreatorWork({id:'cw-video-unsafe',title:'Video',image:'data:image/webp;base64,YQ==',medium:'Digital Art',video_url:'http://video.example/watch'}).video_url`), '');
assert.equal(run(`(()=>{const image={naturalWidth:600,naturalHeight:1200,parentElement:{dataset:{}}};adaptFeedArtworkImage(image);return image.parentElement.dataset.mediaShape})()`), 'portrait');
assert.equal(run(`(()=>{const image={naturalWidth:1000,naturalHeight:1000,parentElement:{dataset:{}}};adaptFeedArtworkImage(image);return image.parentElement.dataset.mediaShape})()`), 'square');
assert.equal(run(`(()=>{const image={naturalWidth:1600,naturalHeight:1200,parentElement:{dataset:{}}};adaptFeedArtworkImage(image);return image.parentElement.dataset.mediaShape})()`), 'landscape');
assert.equal(run(`(()=>{const image={naturalWidth:1920,naturalHeight:1080,parentElement:{dataset:{}}};adaptFeedArtworkImage(image);return image.parentElement.dataset.mediaShape})()`), 'wide');
assert.match(html, /#app-viewport \.feed-img-box img \{[\s\S]*?object-fit: contain;/);
assert.match(html, /target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" onclick="event\.stopPropagation\(\)"/);
assert.match(html, /YouTube\/Vimeo links can load in the in-app player only after a visitor clicks the VIDEO control/);
const publicVideoWork = run(`normalizeCreatorWork({id:'cw-video-public-gate',title:'Video',image:'data:image/webp;base64,YQ==',medium:'Digital Art',visibility:'public',video_url:'https://youtu.be/example'})`);
const publicVideoFeedEntry = run(`makeCreatorFeedEntry(normalizeCreatorWork({id:'cw-video-public-gate',title:'Video',image:'data:image/webp;base64,YQ==',medium:'Digital Art',visibility:'public',video_url:'https://youtu.be/example'}),987654300,0)`);
assert.equal(publicVideoWork.video_url, 'https://youtu.be/example', 'local work normalization can preserve the artist-entered URL');
assert.equal(publicVideoFeedEntry.video_url, undefined, 'public video metadata is not mapped into the shared feed before inventory review');
// Regression: opening Creator Setup from My Profile closes the higher-z-index parent before launch.
run(`restoreLandingBackdropToSplash=function(){}; attachLandingBackdropToSignUp=function(){}; window._originalCreatorWorkReset=resetCreatorWorkUploadForm; resetCreatorWorkUploadForm=function(){}; resetToStepGate=function(){}; activateModal=function(root){activeModalRoot=root}; modalStack=[]; modalReturnFocus=document.getElementById('header-profile-button'); activeModalRoot=document.getElementById('profileAccessOverlay'); document.getElementById('profileAccessOverlay').classList.remove('hidden'); openOnboarding()`);
assert.equal(elements.get('profileAccessOverlay').classList.contains('hidden'),true);
assert.equal(elements.get('onboardingOverlay').classList.contains('hidden'),false);
assert.equal(run(`activeModalRoot.id`),'onboardingOverlay');
assert.equal(run(`modalStack.length`),0);
// Prepare a local Creator profile and target DOM controls.
run(`creatorProfile = {artist_id:'123e4567-e89b-42d3-a456-426614174000', name:'Studio One', studio_name:'Studio One', isCreatorProfile:true, works:[], projects:[]}; viewArtist={id:CREATOR_PROFILE_ID}; creatorCommissionSettings=loadCreatorCommissionSettings(); refreshWipBars=function(){};`);
// Commission settings and local proposal behavior remain implemented, but their public/Studio controls are hidden.
assert.equal(run('creatorCommissionSettings.openForCommissions'),true);
assert.equal(run('creatorCommissionSettings.availableSlots'),5);
run(`updateCommissionProfileCTA()`);
assert.equal(elements.get('hubCommissionBtn').hidden,true, 'commission CTA is hidden in the community edition');
run(`creatorCommissionSettings={openForCommissions:false,availableSlots:5}; updateCommissionProfileCTA()`);
assert.equal(elements.get('hubCommissionBtn').hidden,true, 'closed commission state remains hidden without deleting its data');
assert.equal(run('artistHasOpenCommissions(creatorProfile)'),false);
run(`creatorCommissionSettings={openForCommissions:true,availableSlots:2}; updateCommissionProfileCTA()`);
assert.equal(elements.get('hubCommissionBtn').hidden,true, 'the CTA stays hidden even when the local intake is open');
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
assert.match(elements.get('commissionRequestFeedback').textContent, /not sent|not delivered/i);
// Accept consumes one slot and resolves the commission locally.
const requestId = reqs[0].id;
run(`resolveCreatorQueueItem(${JSON.stringify(requestId)}, 'commission-request', 'accept')`);
reqs = JSON.parse(localStorage.getItem('artNexusCreatorCommissionRequests:123e4567-e89b-42d3-a456-426614174000'));
assert.equal(reqs[0].status,'In_Production');
assert.equal(run('creatorCommissionSettings.availableSlots'),1);
assert.equal(elements.get('creatorStudioAlertCount').textContent,'0');
// Cart/order capture is retired in this local-only build; commission proposals remain local previews.
assert.equal(run('NONPROFIT_PILLARS_LOCAL_MODE'), true);
assert.doesNotMatch(html, /artNexusLocalEventBroker|creatorAutomationEventLog/);
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
console.log('Baseline V3 regression cases passed: My Profile setup handoff, first-time-open commissions CTA, closed-state label, local proposal/slot decrement, order status routing, and public migration overlays.');
// V4 Folio Stack schema, builder state, single-card feed representation, and vertical lightbox rendering.
const folioTest = run(`(async()=>{
  creatorProfile={artist_id:'123e4567-e89b-42d3-a456-426614174000',name:'Studio One',studio_name:'Studio One',verified_mediums:['Digital Art'],works:[],projects:[]};
  setCreatorReleaseMode('folio');
  processCreatorArtworkFile=async file => file.name==='cover.jpg' ? 'data:image/jpeg;base64,YQ==' : 'data:image/jpeg;base64,Yg==';
  await appendCreatorFolioFiles([{name:'cover.jpg',type:'image/jpeg',size:10},{name:'slide.jpg',type:'image/jpeg',size:10}]);
  const work=normalizeCreatorWork({id:'cw-folio-test',title:'Folio Test',description:'',image:creatorFolioSelectedImages[0].image,medium:'Digital Art',folio_slides:creatorFolioSelectedImages.slice(1).map(slide=>slide.image),visibility:'public',is_for_sale:false,status:'unlisted'});
  creatorProfile.works=[work];
  const feed=makeCreatorFeedEntry(work,987654321,0);
  mockArtDatabase=[feed];
  return {work,feed};
})()`);
folioTest.then(async ({work,feed})=>{
  assert.equal(work.is_folio_stack,true); assert.equal(work.folio_slides.length,1); assert.equal(work.folio_presentation,'vertical');
  assert.equal(feed.image,'data:image/jpeg;base64,YQ=='); assert.equal(feed.is_folio_stack,true); assert.equal(feed.folio_slides.length,1); assert.equal(feed.folio_presentation,'vertical');
  assert.equal(run('creatorFolioSelectedImages.length'),2);
  run(`openFolioStack('cw-folio-test')`);
  assert.equal(elements.get('folioStackLightbox').hidden,false);
  assert.equal(elements.get('folioStackGallery').classList.contains('is-carousel'),false);
  assert.equal(elements.get('folioStackCarouselControls').hidden,true);
  assert.equal(elements.get('folioLightboxCount').textContent,'2 images · scroll down to explore');
  assert.equal(elements.get('folioStackScrollHint').classList.contains('is-visible'),true);
  assert.equal(elements.get('folioStackScrollHintText').textContent,'Scroll down to explore all 2 images');
  assert.ok(elements.get('folioStackGallery').innerHTML.includes('Slide 2 · 2 / 2'));
  assert.ok(elements.get('folioStackGallery').innerHTML.includes('data:image/jpeg;base64,Yg=='));
  run(`closeFolioStack()`);
  assert.equal(elements.get('folioStackScrollHint').classList.contains('is-visible'),false);
  run(`removeCreatorFolioSlide(1)`);
  assert.equal(run('creatorFolioSelectedImages.length'),1);
  run(`clearCreatorFolioImages()`);
  assert.equal(run('creatorFolioSelectedImages.length'),0);
  console.log('V4 Folio harness passed: multi-image selection state, cover/slide schema, single poster feed entry, vertical lightbox, and secondary-slide removal.');
  run(`creatorProfile={id:CREATOR_PROFILE_ID,artist_id:'123e4567-e89b-42d3-a456-426614174000',name:'Studio One',studio_name:'Studio One',verified_mediums:['Digital Art'],isCreatorProfile:true,works:[],video_releases:[],projects:[]}; mockArtDatabase=[]; creatorFolioSelectedImages=[{sourceFile:{name:'cover.jpg',type:'image/jpeg',size:10}},{sourceFile:{name:'slide.jpg',type:'image/jpeg',size:10}}]; creatorFolioProcessing=false; setCreatorReleaseMode('folio'); setCreatorFolioPresentation('carousel'); processCreatorArtworkPreview720Webp=async file=>file.name==='cover.jpg'?'data:image/webp;base64,YQ==':'data:image/webp;base64,Yg=='; refreshCreatorProfileViews=function(){}; const legacyPrivateDraft=normalizeCreatorWork({id:'cw-legacy-private',title:'Legacy private draft',image:'data:image/jpeg;base64,ZA==',medium:'Digital Art',visibility:'private',local_only_draft:true,local_preview_owned:true,status:'unlisted'}); creatorProfile.works=[legacyPrivateDraft]; document.getElementById('creatorWorkTitle').value='Public Folio Release'; document.getElementById('creatorWorkDescription').value='Two public images'; document.getElementById('creatorWorkMedium').value='Digital Art'; document.getElementById('creatorWorkVideoUrl').value='https://youtu.be/local-draft'; document.getElementById('creatorWorkImage').files=[]; document.getElementById('creatorWorkAddButton').disabled=false; document.getElementById('creatorWorkUploadStatus').textContent=''; document.getElementById('creatorWorkList').innerHTML=''; showToast=function(){};`);
  assert.equal(elements.get('creatorFolioLayoutCarousel').getAttribute('aria-pressed'),'true');
  assert.equal(elements.get('creatorFolioLayoutVertical').getAttribute('aria-pressed'),'false');
  await run(`addCreatorWork()`);
  assert.equal(run('creatorProfile.works.length'),2, 'the pre-existing private draft is preserved beside the new public Folio');
  assert.equal(run('creatorProfile.works[0].is_folio_stack'),true);
  assert.equal(run('creatorProfile.works[0].folio_presentation'),'carousel');
  assert.equal(run('creatorProfile.works[0].local_only_draft'),false);
  assert.equal(run('creatorProfile.works[0].local_preview_owned'),true);
  assert.equal(run('creatorProfile.works[0].visibility'),'public');
  assert.equal(run('creatorProfile.works[0].video_url'),'https://youtu.be/local-draft');
  assert.equal(run('creatorProfile.works[0].storage_nodes.length'),0, 'new releases no longer expose the optional Master storage-pointer editor');
  const legacyPointers = run(`normalizeStorageNodes([{protocol:'ipfs',address:'b'+'a'.repeat(58)},{protocol:'local-handshake',address:'local-master-01'}])`);
  assert.equal(legacyPointers.length,2, 'previously stored pointer metadata remains valid and retained by its normalizer');
  assert.equal(legacyPointers[0].verified,false);
  assert.equal(legacyPointers[1].uri,null);
  assert.equal(legacyPointers[1].is_local_reference,true);
  assert.equal(run('ensureCreatorStorageNodeForm() === null'), true, 'the pointer form is not injected in the community edition');
  assert.equal(run('creatorProfile.works[0].is_for_sale'),false);
  assert.equal(run('creatorProfile.works[0].price_value'),null);
  assert.equal(JSON.parse(localStorage.getItem('artNexusCreatorWorks')).length,1);
  assert.equal(JSON.parse(localStorage.getItem('artNexusCreatorWorks'))[0].image,'data:image/webp;base64,YQ==');
  assert.equal(JSON.parse(localStorage.getItem('artNexusCreatorPrivateDrafts')).length,1, 'the existing private draft is retained');
  assert.equal(run(`creatorProfile.works.find(work=>work.id==='cw-legacy-private').visibility`),'private', 'existing private drafts are not retroactively published');
  assert.equal(run('mockArtDatabase.filter(card=>card.creatorWorkId).length'),1,'a new public Folio enters the local Browse feed while the private draft stays off it');
  assert.match(elements.get('creatorWorkUploadStatus').textContent, /published to Browse and your Creator profile in this browser preview/i);
  assert.match(html, /function processCreatorArtworkPreview720Webp/);
  assert.match(script, /async function compressToPreviewWebP/);
  assert.match(html, /Creator artwork uploads and catalog writes are disabled in this local-only preview/);
  assert.match(html, /Private WIP Projects/);

  // Existing private drafts stay local; only an explicit visibility edit can change one.
  assert.equal(run(`creatorProfile.works.find(work=>work.id==='cw-legacy-private').local_only_draft`),true);
  assert.equal(run('mockArtDatabase.filter(card=>card.creatorWorkId).length'),1,'the preserved private draft remains out of Browse');

  // Existing release details remain editable without a visibility selector or an implicit publication change.
  const folioId = run(`creatorProfile.works.find(work=>work.is_folio_stack).id`);
  const draftId = 'cw-legacy-private';
  run(`renderCreatorWorkManager()`);
  assert.doesNotMatch(elements.get('creatorWorkList').innerHTML,/creatorWorkVisibility-|>Visibility</, 'the release manager no longer offers a private/public choice');
  for (const id of [folioId,draftId]) {
    for (const suffix of ['Title','Description','Medium','Tools','Technique','Progression','License','VideoUrl']) elements.set(`creatorWork${suffix}-${id}`, new E(`creatorWork${suffix}-${id}`));
  }
  elements.get(`creatorWorkTitle-${draftId}`).value='Edited legacy private draft';
  elements.get(`creatorWorkMedium-${draftId}`).value='Digital Art';
  await run(`saveCreatorWork(${JSON.stringify(draftId)})`);
  assert.equal(run(`creatorProfile.works.find(work=>work.id==='cw-legacy-private').title`),'Edited legacy private draft');
  assert.equal(run(`creatorProfile.works.find(work=>work.id==='cw-legacy-private').visibility`),'private');
  assert.equal(run(`creatorProfile.works.find(work=>work.id==='cw-legacy-private').local_only_draft`),true);
  assert.equal(run('mockArtDatabase.filter(card=>card.creatorWorkId).length'),1,'editing a private draft never publishes it');
  elements.get(`creatorWorkTitle-${folioId}`).value='Edited Folio Release';
  elements.get(`creatorWorkDescription-${folioId}`).value='Updated Folio description';
  elements.get(`creatorWorkMedium-${folioId}`).value='Digital Art';
  await run(`saveCreatorWork(${JSON.stringify(folioId)})`);
  assert.equal(run(`creatorProfile.works.find(work=>work.id===${JSON.stringify(folioId)}).title`),'Edited Folio Release');
  assert.equal(run(`creatorProfile.works.find(work=>work.id===${JSON.stringify(folioId)}).visibility`),'public');
  assert.equal(run('mockArtDatabase.filter(card=>card.creatorWorkId).length'),1,'editing an existing public release does not silently change its visibility');

  // Delete controls remove only the local authored work, not the separate private draft or its account data.
  run(`window.confirm=()=>true`);
  await run(`removeCreatorWork(${JSON.stringify(folioId)})`);
  assert.equal(run(`creatorProfile.works.some(work=>work.id===${JSON.stringify(folioId)})`),false);
  assert.equal(run('creatorProfile.works.length'),1);
  assert.equal(run(`creatorProfile.works[0].visibility`),'private', 'the original private draft remains after deleting another release');

  // Production-loaded work is marked as server-managed and must not be edited/deleted by local controls.
  run(`creatorProfile.works=normalizeProductionPublicArtists([{user_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',studio_name:'Catalog Artist',verified_mediums:['Digital Art'],works:[{work_key:'cw-production-managed-v4',title:'Production Catalog Work',image:'data:image/webp;base64,YQ==',medium:'Digital Art',visibility:'public',listing_key:'listing:production-v4'}]}])[0].works; window.localStorage.setItem(CREATOR_WORK_STORAGE_KEY,JSON.stringify(creatorProfile.works)); renderCreatorPrivateWorkManager();`);
  const managedId='cw-production-managed-v4';
  assert.equal(run(`creatorProfile.works[0].production_managed`),true);
  assert.equal(run(`isCreatorLocallyManagedWork(creatorProfile.works[0])`),false);
  assert.match(elements.get('creatorWorkList').innerHTML,/EXISTING CATALOG WORK · NOT CHANGED BY THIS LOCAL PREVIEW/);
  assert.doesNotMatch(elements.get('creatorWorkList').innerHTML,/Save changes|Delete local release/);
  elements.set(`creatorWorkTitle-${managedId}`,new E(`creatorWorkTitle-${managedId}`));
  elements.get(`creatorWorkTitle-${managedId}`).value='Attempted local edit';
  run(`window.confirmCalls=0; window.confirm=()=>{window.confirmCalls++;return true};`);
  await run(`saveCreatorWork(${JSON.stringify(managedId)})`);
  await run(`removeCreatorWork(${JSON.stringify(managedId)})`);
  assert.equal(run(`creatorProfile.works[0].title`),'Production Catalog Work');
  assert.equal(run(`window.confirmCalls`),0,'managed work is refused before even opening the delete confirmation');
  assert.equal(JSON.parse(localStorage.getItem('artNexusCreatorWorks'))[0].title,'Production Catalog Work');
  assert.equal(run(`isCreatorLocallyManagedWork(loadCreatorWorks().find(work=>work.id===${JSON.stringify(managedId)}))`),false,'production metadata survives a local storage reload without becoming Creator-owned');

  // Standalone video releases are public-only, locally editable without changing visibility, and removable.
  run(`setCreatorReleaseMode('video'); document.getElementById('creatorWorkTitle').value='Studio short film'; document.getElementById('creatorWorkDescription').value='A short process film'; document.getElementById('creatorVideoUrl').value='https://youtu.be/studio12345'; document.getElementById('creatorWorkImage').files=[];`);
  assert.equal(elements.get('creatorReleaseModeVideo').getAttribute('aria-pressed'),'true');
  assert.equal(elements.get('creatorVideoUrl').required,true);
  assert.equal(elements.get('creatorWorkMedium').required,false);
  await run(`addCreatorWork()`);
  assert.equal(run('creatorProfile.video_releases.length'),1);
  const videoId = run('creatorProfile.video_releases[0].id');
  assert.equal(run('creatorProfile.video_releases[0].visibility'),'public');
  assert.equal(run('creatorProfile.video_releases[0].video_url'),'https://youtu.be/studio12345');
  assert.equal(run('creatorProfile.video_releases[0].thumbnail_url'),'https://i.ytimg.com/vi/studio12345/hqdefault.jpg', 'YouTube video releases receive a safe thumbnail URL automatically');
  assert.equal(JSON.parse(localStorage.getItem('artNexusCreatorVideoReleases:123e4567-e89b-42d3-a456-426614174000')).length,1);
  run(`viewArtist=creatorProfile; renderArtistCommissionDetails=function(){}; renderArtistRecommendations=function(){}; updateCommissionProfileCTA=function(){}; getArtistTransactionLinks=function(){return []}; renderArtistHub()`);
  const publicVideoProfileMarkup = elements.get('panel-portfolio').innerHTML;
  assert.match(publicVideoProfileMarkup, /Studio short film/);
  assert.match(publicVideoProfileMarkup, /https:\/\/i\.ytimg\.com\/vi\/studio12345\/hqdefault\.jpg/);
  assert.match(publicVideoProfileMarkup, /PLAY VIDEO/);
  assert.match(publicVideoProfileMarkup, /openCreatorVideoPlayerFromProfile/);
  assert.doesNotMatch(publicVideoProfileMarkup, /<iframe|<video\b/);
  run(`renderCreatorPrivateWorkManager()`);
  assert.match(elements.get('creatorWorkList').innerHTML, /YOUTUBE THUMBNAIL/);
  assert.match(elements.get('creatorWorkList').innerHTML, /https:\/\/youtu\.be\/studio12345/);
  assert.doesNotMatch(elements.get('creatorWorkList').innerHTML, /<iframe|<video\b/);
  const playerOverlay = document.getElementById('creatorVideoPlayerOverlay');
  const playerFrame = document.getElementById('creatorVideoPlayerFrame');
  playerOverlay.hidden = true;
  playerFrame.replaceChildren();
  assert.equal(playerFrame.children.length,0,'the player iframe is absent before a visitor clicks Play');
  assert.equal(run(`openCreatorVideoPlayerFromProfile(${JSON.stringify(videoId)})`),true);
  assert.equal(playerOverlay.hidden,false);
  assert.match(playerFrame.children[0].src,/youtube-nocookie\.com\/embed\/studio12345\?autoplay=1/);
  run(`closeCreatorVideoPlayer()`);
  assert.equal(playerOverlay.hidden,true);
  assert.equal(playerFrame.children.length,0,'closing playback removes the player iframe');
  assert.doesNotMatch(elements.get('creatorWorkList').innerHTML,/creatorVideoVisibility-|>Visibility</, 'video releases also have no visibility selector');
  for (const suffix of ['Title','Description','Url']) elements.set(`creatorVideo${suffix}-${videoId}`, new E(`creatorVideo${suffix}-${videoId}`));
  elements.get(`creatorVideoTitle-${videoId}`).value='Edited Studio film';
  elements.get(`creatorVideoDescription-${videoId}`).value='Updated video details';
  elements.get(`creatorVideoUrl-${videoId}`).value='https://video.example/edited';
  await run(`saveCreatorVideoRelease(${JSON.stringify(videoId)})`);
  assert.equal(run('creatorProfile.video_releases[0].title'),'Edited Studio film');
  assert.equal(run('creatorProfile.video_releases[0].visibility'),'public', 'editing a video does not change its existing visibility');
  assert.equal(run('creatorProfile.video_releases[0].video_url'),'https://video.example/edited');
  run(`removeCreatorVideoRelease(${JSON.stringify(videoId)})`);
  assert.equal(run('creatorProfile.video_releases.length'),0);
  assert.equal(JSON.parse(localStorage.getItem('artNexusCreatorVideoReleases:123e4567-e89b-42d3-a456-426614174000')).length,0);
  run(`setCreatorReleaseMode('video'); document.getElementById('creatorWorkTitle').value='Invalid video'; document.getElementById('creatorVideoUrl').value='http://video.example/watch';`);
  await run(`addCreatorWork()`);
  assert.equal(run('creatorProfile.video_releases.length'),0,'non-HTTPS video URLs are rejected');
  assert.match(elements.get('creatorWorkUploadStatus').textContent, /valid HTTPS video URL/i);

  // A 720p WebP hard-limit failure is visible and never falls back to an oversized image.
  run(`creatorProfile.works=[]; mockArtDatabase=[]; localStorage.removeItem('artNexusCreatorWorks'); localStorage.removeItem('artNexusCreatorPrivateDrafts'); creatorFolioSelectedImages=[]; creatorFolioProcessing=false; setCreatorReleaseMode('single'); processCreatorArtworkPreview720Webp=async()=>{throw new Error('The 720p WebP preview could not be compressed to 300,000 bytes or less.')}; document.getElementById('creatorWorkTitle').value='Oversized preview'; document.getElementById('creatorWorkMedium').value='Digital Art'; document.getElementById('creatorWorkImage').files=[{name:'large.jpg',type:'image/jpeg',size:100}]; document.getElementById('creatorWorkUploadStatus').textContent='';`);
  await run(`addCreatorWork()`);
  assert.equal(run('creatorProfile.works.length'),0,'a failed 720p compression must not save a fallback image');
  assert.match(elements.get('creatorWorkUploadStatus').textContent, /could not be compressed to 300,000 bytes or less/i);
  assert.equal(localStorage.getItem('artNexusCreatorPrivateDrafts'),null);
  assert.equal(localStorage.getItem('artNexusCreatorWorks'),null);
  console.log('V4 local Creator regression passed: public-only new artwork/Folio/video publishing, preservation of existing private drafts, edit/delete and production-managed protections, hidden optional storage-pointer UI, YouTube thumbnails with click-to-load playback, HTTPS validation, local feed/profile visibility, and the strict 300,000-byte image limit.');
}).catch(error=>{console.error(error);process.exitCode=1;});
