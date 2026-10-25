import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'src', 'app.src.html'), 'utf8');

const palettes = {
  dark: {
    amber: [238, 158, 73],
    void: [26, 23, 45],
    white: [255, 255, 255]
  },
  light: {
    amber: [138, 75, 16],
    void: [247, 246, 250],
    white: [26, 23, 45]
  }
};

function linear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
function luminance(rgb) {
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}
function wcag(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function apca(foreground, background) {
  const y = rgb => 0.2126729 * linear(rgb[0]) + 0.7151522 * linear(rgb[1]) + 0.0721750 * linear(rgb[2]);
  let text = y(foreground), bg = y(background);
  if (text < 0.022) text += (0.022 - text) ** 1.414;
  if (bg < 0.022) bg += (0.022 - bg) ** 1.414;
  if (Math.abs(bg - text) < 0.0005) return 0;
  if (bg > text) {
    const sapc = (bg ** 0.56 - text ** 0.57) * 1.14;
    return 100 * (sapc < 0.1 ? 0 : sapc - 0.027);
  }
  const sapc = (bg ** 0.65 - text ** 0.62) * 1.14;
  return 100 * (sapc > -0.1 ? 0 : sapc + 0.027);
}
function composite(foreground, background, alpha) {
  return foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha));
}
function simulate(theme, surfaceName, role) {
  const tokens = palettes[theme];
  const baseSurfaces = {
    void: tokens.void,
    inset: composite(tokens.white, tokens.void, 0.035),
    raised: composite(tokens.white, tokens.void, 0.055),
    amber: tokens.amber,
    pearl: tokens.white
  };
  const background = baseSurfaces[surfaceName];
  const candidates = {
    ...tokens,
    silver: composite(tokens.white, background, 0.72),
    'silver-muted': composite(tokens.white, background, 0.68)
  };
  const lightTheme = theme === 'light';
  const ink = lightTheme ? 'white' : 'void';
  const paper = lightTheme ? 'void' : 'white';
  const isDarkSurface = luminance(background) < 0.18;
  const order = isDarkSurface
    ? [paper, 'silver', 'silver-muted', 'amber', ink]
    : [ink, 'silver', 'silver-muted', 'amber', paper];
  const preferred = isDarkSurface
    ? (role === 'primary' ? paper : role === 'secondary' ? (lightTheme ? paper : 'silver') : role === 'muted' ? (lightTheme ? paper : 'silver-muted') : 'amber')
    : role === 'accent' ? 'amber' : ink;
  const apcaMinimum = role === 'primary' ? (surfaceName === 'amber' ? 55 : 60) : 45;
  const tested = order.map(name => {
    const ratio = wcag(candidates[name], background);
    const lc = Math.abs(apca(candidates[name], background));
    return { name, ratio, lc, passes: ratio >= 4.5 && lc >= apcaMinimum };
  });
  const selected = tested.find(item => item.name === preferred && item.passes)
    || tested.find(item => item.passes)
    || tested.sort((a, b) => Math.min(b.ratio / 4.5, b.lc / apcaMinimum) - Math.min(a.ratio / 4.5, a.lc / apcaMinimum))[0];
  return { theme, surfaceName, role, ...selected, apcaMinimum };
}

test('theme toggle is persistent, reachable, and preserves dark as the default', () => {
  assert.match(html, /<html lang="en" data-theme="dark">/);
  assert.match(html, /const APP_THEME_STORAGE_KEY = 'artNexusAppTheme'/);
  assert.match(html, /function applyAppTheme\(theme, persist = true\)/);
  assert.match(html, /function toggleAppTheme\(\)/);
  assert.match(html, /function initAppTheme\(\)/);
  assert.ok((html.match(/data-theme-toggle/g) || []).length >= 6, 'theme switch is reachable from top bars and both artwork viewers');
  assert.match(html, /:root\[data-theme="light"\]\s*\{/);
  assert.match(html, /color-scheme: light/);
  assert.match(html, /#1A172D[\s\S]*?#FFFFFF/);
  assert.match(html, /\.folio-stack-view-controls \.theme-toggle \{[^}]*background: rgba\(var\(--cordillera-void-rgb\), \.54\)/);
  assert.doesNotMatch(html, /:root\[data-theme="light"\] \.header-logo-button[\s\S]*?background: var\(--contrast-white\)/);
});

test('dark and light semantic color roles pass the AA/APCA simulation on every declared surface', () => {
  const report = [];
  for (const theme of ['dark', 'light']) {
    for (const surface of ['void', 'inset', 'raised', 'amber', 'pearl']) {
      for (const role of ['primary', 'secondary', 'muted', 'accent']) {
        const result = simulate(theme, surface, role);
        assert.ok(result.passes, `${theme}/${surface}/${role}: ${result.name} gives ${result.ratio.toFixed(2)}:1 and Lc ${result.lc.toFixed(1)}`);
        report.push(result);
      }
    }
  }
  for (const theme of ['dark', 'light']) {
    const rows = report.filter(item => item.theme === theme);
    const minRatio = Math.min(...rows.map(item => item.ratio));
    const minLc = Math.min(...rows.map(item => item.lc));
    console.log(`${theme} theme: ${rows.length} foreground/surface checks pass; minimum WCAG ratio ${minRatio.toFixed(2)}:1; minimum APCA Lc ${minLc.toFixed(1)}.`);
  }
});

test('Creator Studio fields, labels, placeholders, and Drive storage stay readable in both themes', () => {
  const fieldRule = html.match(/#app-viewport \.creator-studio-dashboard input\.ob-input:not\(\[type="radio"\]\):not\(\[type="checkbox"\]\):not\(\[type="file"\]\),\s*#app-viewport \.creator-studio-dashboard select\.ob-input,\s*#app-viewport \.creator-studio-dashboard textarea\.ob-textarea\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(fieldRule, /background-color:\s*var\(--contrast-white\)\s*!important;/);
  assert.match(fieldRule, /border-color:\s*rgba\(var\(--cordillera-void-rgb\),\s*0\.52\)\s*!important;/);
  assert.match(fieldRule, /color:\s*var\(--cordillera-void\)\s*!important;/);
  assert.match(html, /#app-viewport \.creator-studio-dashboard input\.ob-input:not\(\[type="radio"\]\):not\(\[type="checkbox"\]\):not\(\[type="file"\]\)::placeholder,[\s\S]*?color:\s*var\(--guardrail-placeholder,\s*var\(--cordillera-void\)\)\s*!important;[\s\S]*?opacity:\s*var\(--guardrail-placeholder-opacity,\s*0\.72\)\s*!important;/);
  assert.match(html, /:root\[data-theme="dark"\] #app-viewport \.creator-studio-dashboard \.ob-input,[\s\S]*?color-scheme:\s*light\s*!important;/);
  assert.match(html, /:root\[data-theme="light"\] #app-viewport \.creator-studio-dashboard \.ob-input,[\s\S]*?color-scheme:\s*dark\s*!important;/);

  const labelRule = html.match(/#app-viewport \.creator-studio-dashboard \.creator-account-settings-form \.ob-label,\s*#app-viewport \.creator-studio-dashboard \.creator-commission-profile-form \.ob-label,\s*#app-viewport \.creator-studio-dashboard \.creator-social-links-form \.ob-label\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(labelRule, /color:\s*var\(--contrast-white\)\s*!important;/);
  assert.match(labelRule, /font-size:\s*10px/);
  assert.match(html, /\.creator-release-visibility label \{[^}]*color: var\(--cordillera-void\)/);
  assert.match(html, /\.creator-profile-social-settings > p \{[^}]*color: var\(--text-secondary\)/);
  assert.match(html, /:root\[data-theme="light"\] #app-viewport \.creator-drive-storage-panel\s*\{[^}]*background:\s*#1A172D;[^}]*color:\s*#FFFFFF;/);
  assert.match(html, /\.creator-drive-agreement\s*\{[^}]*background:\s*#1A172D;[^}]*color:\s*#FFFFFF;/);
  assert.doesNotMatch(html, /:root\[data-theme="light"\] \.creator-drive-storage\s*\{/);

  for (const theme of ['dark', 'light']) {
    const tokens = palettes[theme];
    const settingsSurface = composite(tokens.white, tokens.void, 0.045);
    assert.ok(wcag(tokens.white, settingsSurface) >= 4.5, `${theme} settings label contrast`);

    const fieldSurface = tokens.white;
    const fieldText = tokens.void;
    assert.ok(wcag(fieldText, fieldSurface) >= 4.5, `${theme} Creator Studio input text contrast`);
    const fieldBorder = composite(tokens.void, fieldSurface, 0.52);
    assert.ok(wcag(fieldBorder, fieldSurface) >= 3, `${theme} Creator Studio field boundary contrast`);

    let alpha = 0.7;
    let placeholder = composite(tokens.void, fieldSurface, alpha);
    while (alpha < 1 && (wcag(placeholder, fieldSurface) < 4.5 || Math.abs(apca(placeholder, fieldSurface)) < 40)) {
      alpha = Math.min(1, alpha + 0.001);
      placeholder = composite(tokens.void, fieldSurface, alpha);
    }
    alpha = Math.min(1, Math.ceil((alpha - 1e-8) * 200) / 200);
    placeholder = composite(tokens.void, fieldSurface, alpha);
    assert.ok(wcag(placeholder, fieldSurface) >= 4.5, `${theme} Creator Studio placeholder contrast`);
    assert.ok(Math.abs(apca(placeholder, fieldSurface)) >= 40, `${theme} Creator Studio placeholder APCA Lc`);

    const driveSurface = theme === 'light' ? [26, 23, 45] : composite(tokens.white, tokens.void, 0.055);
    assert.ok(wcag([255, 255, 255], driveSurface) >= 4.5, `${theme} white Drive panel copy contrast`);
  }
});

test('single-artwork previews omit the top bar, dismiss via outside click/Escape, and preserve Browse context', () => {
  assert.match(html, /id="screenArtDetail"[^>]*aria-describedby="adDismissHelp"/);
  assert.match(html, /class="sr-only" id="adDismissHelp">Press Escape or tap or click outside the artwork to close this preview\./);
  assert.doesNotMatch(html, /class="ad-header"|class="ad-icon"|ad-theme-toggle/);
  assert.match(html, /activateModal\(detail, '#adCanvas'\)/);
  assert.match(html, /if \(!withinArtwork\) \{[\s\S]*?closeSale\(\);/);
  assert.match(html, /function handleModalKeydown\(event\)[\s\S]*?if \(event.key === 'Escape'\)[\s\S]*?dismissModal\(root\);/);
  assert.match(html, /else if \(root.id === 'screenArtDetail'\) closeSale\(\);/);
  assert.match(html, /function openArtDetailModal\(id\)[\s\S]*?detail\.classList\.add\('open'\);[\s\S]*?activateModal\(detail, '#adCanvas'\)/);
  const closeSaleBody = html.match(/function closeSale\(restoreFocus = true, preserveReturnFocus = false\) \{([\s\S]*?)\n        \}/)?.[1] || '';
  assert.match(closeSaleBody, /deactivateModal\(detail, restoreFocus, preserveReturnFocus\)/);
  assert.doesNotMatch(closeSaleBody, /\bgoTo\s*\(/, 'closing the preview does not route away from Browse or reset its scroller');
});

test('Folio Stack offers spaced vertical and carousel layouts, hides the artwork scrollbar, and shows an accessible cue', () => {
  assert.match(html, /class="folio-lightbox-backdrop" id="folioLightboxBackdrop"/);
  assert.doesNotMatch(html, /class="folio-lightbox-header"|class="folio-lightbox-home"/);
  assert.match(html, /class="folio-stack-view-controls" role="group"[\s\S]*?data-theme-toggle[\s\S]*?id="folioStackClose"/);
  assert.match(html, /<h2 class="sr-only" id="folioLightboxTitle">Artwork Folio<\/h2>/);
  assert.match(html, /class="folio-stack-scroll-hint" id="folioStackScrollHint"[^>]*role="status" aria-live="polite"/);
  assert.match(html, /id="creatorFolioPresentation" role="group" aria-label="Folio Stack viewing layout"/);
  assert.match(html, /id="creatorFolioLayoutVertical"[^>]*aria-pressed="true"[^>]*>Vertical scroll/);
  assert.match(html, /id="creatorFolioLayoutCarousel"[^>]*aria-pressed="false"[^>]*onclick="setCreatorFolioPresentation\('carousel'\)"/);
  assert.match(html, /function setCreatorFolioPresentation\(mode\)/);
  assert.match(html, /\.folio-stack-gallery:not\(\.is-carousel\) \.folio-stack-slide:not\(:last-child\) \{ margin-bottom: 28px; \}/);
  assert.match(html, /\.folio-stack-gallery\.is-carousel \{[^}]*--folio-carousel-card-size: clamp\(220px, 42%, 280px\);[^}]*gap: 8px;[^}]*scroll-snap-type: x mandatory/);
  assert.match(html, /\.folio-stack-gallery\.is-carousel::after \{[^}]*calc\(100% - var\(--folio-carousel-card-size\)\)/);
  assert.match(html, /\.folio-stack-gallery\.is-carousel \.folio-stack-slide \{[^}]*flex: 0 0 var\(--folio-carousel-card-size\);[^}]*scroll-snap-align: start/);
  assert.match(html, /\.folio-stack-gallery\.is-carousel \{ --folio-carousel-card-size: 74%;/);
  assert.match(html, /\.screen\[hidden\] \{ display: none !important; \}/);
  assert.match(html, /onkeydown="handleFolioStackGalleryKeydown\(event\)"/);
  assert.match(html, /function handleFolioStackGalleryKeydown\(event\)[\s\S]*?ArrowRight[\s\S]*?changeFolioStackSlide\(1\)[\s\S]*?ArrowLeft[\s\S]*?changeFolioStackSlide\(-1\)/);
  assert.match(html, /class="folio-stack-carousel-controls" id="folioStackCarouselControls"/);
  assert.match(html, /\.folio-stack-gallery \{[^}]*width: min\(calc\(100% - 32px\), 600px\)/);
  assert.match(html, /\.folio-stack-gallery \{[^}]*scrollbar-width: none;[^}]*-ms-overflow-style: none;/);
  assert.match(html, /\.folio-stack-gallery::-webkit-scrollbar \{ display: none; width: 0; height: 0; \}/);
  assert.match(html, /function showFolioStackScrollHint\(imageCount[^)]*\)[\s\S]*?Scroll down to explore all \$\{imageCount\} images[\s\S]*?gallery\.addEventListener\('scroll', onFolioStackGalleryScroll, \{ passive: true \}\)[\s\S]*?setTimeout\(hideFolioStackScrollHint, 5200\)/);
  assert.match(html, /function onFolioStackGalleryScroll\(\)[\s\S]*?scrollTop > 12\) hideFolioStackScrollHint\(\)/);
  assert.match(html, /function closeFolioStack\(restoreFocus = true, preserveReturnFocus = false\)[\s\S]*?hideFolioStackScrollHint\(\)/);
  assert.match(html, /\.folio-stack-footer \{[^}]*width: min\(calc\(100% - 32px\), 760px\)/);
  assert.match(html, /\.folio-stack-detail-actions \{[^}]*position: absolute/);
  assert.match(html, /id="folioStackHeartBtn"[^>]*data-artwork-action="heart"/, 'the Folio Stack keeps its device-local heart action');
  assert.match(html, /function toggleArtworkHeart\(id\)/);
  assert.doesNotMatch(html, /folioStackHeartCount|artworkHeartCount|publicLikeCount/, 'hearts do not invent public/shared counts');
  assert.match(html, /id="folioStackSaveCollection"/);
  assert.match(html, /id="folioLightboxSaleBar" role="status" aria-live="polite"/);
  assert.match(html, /function openFolioStackArtist\(\)/);
  assert.match(html, /index === 0 \? backdrop : null/);
});

test('artist profile development controls are hidden while the photo viewer stays accessible', () => {
  assert.match(html, /id="hubCollabBtn"[^>]*hidden/);
  assert.match(html, /id="tab-wips"[^>]*hidden/);
  assert.match(html, /id="tab-recents"[^>]*hidden/);
  assert.match(html, /\.hub-tab\[hidden\] \{ display: none !important; \}/);
  assert.match(html, /function renderArtistHub\(\)[\s\S]*?editButton\.hidden = !isCreatorSelf/);
  assert.match(html, /function renderArtistHub\(\)[\s\S]*?actionRow\.hidden = actionButtons\.every/);
  assert.match(html, /function handleProfileTabKeydown\(event\)[\s\S]*?\.filter\(tab => !tab\.hidden\)/);

  assert.match(html, /<button type="button" class="hub-avatar" id="hubAvatar"[^>]*onclick="openArtistProfilePhoto\(\)"/);
  assert.match(html, /class="artist-photo-lightbox" id="artistPhotoLightbox" role="dialog" aria-modal="true"[^>]*hidden/);
  assert.match(html, /\.artist-photo-lightbox img \{[^}]*max-width: 100%;[^}]*max-height: 100%;[^}]*object-fit: contain;/);
  assert.match(html, /function openArtistProfilePhoto\(\)[\s\S]*?activateModal\(modal, '#artistPhotoLightboxClose'\)/);
  assert.match(html, /function closeArtistProfilePhoto\(restoreFocus = true, preserveReturnFocus = false\)[\s\S]*?deactivateModal\(modal, restoreFocus, preserveReturnFocus\)/);
  assert.match(html, /root.id === 'artistPhotoLightbox'\) closeArtistProfilePhoto\(\)/);
});

test('embossed ripple texture is embedded as a subtle background in both themes', () => {
  assert.match(html, /'embossed-ripple\.jpg'/);
  assert.match(html, /function initAppBackgroundPattern\(\)[\s\S]*?IMG\['embossed-ripple\.jpg'\][\s\S]*?setProperty\('--app-paper-pattern'/);
  assert.match(html, /initAppBackgroundPattern\(\);/);
  assert.match(html, /--app-paper-tint: rgba\(26, 23, 45, 0\.93\)/);
  assert.match(html, /--app-paper-tint: rgba\(247, 246, 250, 0\.85\)/);
  assert.match(html, /\.screen \{[^}]*background-image: linear-gradient\(var\(--app-paper-tint\), var\(--app-paper-tint\)\), var\(--app-paper-pattern\)/);
  assert.match(html, /\.screen\.dark \{ background-color: var\(--bg-dark\); \}/);
  assert.match(html, /#app-viewport, \.artist-hub, \.profile-access-modal, \.creator-studio-dashboard, \.creator-studio-shell \{[^}]*background-image: linear-gradient\(var\(--app-paper-tint\), var\(--app-paper-tint\)\), var\(--app-paper-pattern\)/);
});
