const URL_ORIGIN = value => {
  try {
    const parsed = new URL(String(value || '').trim());
    if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) return '';
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(parsed.hostname))) return '';
    return parsed.origin;
  } catch {
    return '';
  }
};

const validSupabaseUrl = value => {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co')
      ? parsed.origin
      : '';
  } catch {
    return '';
  }
};

export function getRuntimeConfig(env = process.env) {
  // Local-preview is the default; when Supabase auth env is fully present,
  // localCommunityMode turns off and the app syncs through the backend.
  // Payments remain disabled unless PayMongo test secrets are configured.
  const providerTestOverride = String(env.NODE_ENV || '').toLowerCase() === 'test'
    && String(env.ART_NEXUS_TEST_ALLOW_PROVIDERS || '').toLowerCase() === 'true';
  const supabaseUrl = validSupabaseUrl(env.SUPABASE_URL);
  const anonKey = String(env.SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const appUrl = URL_ORIGIN(env.PUBLIC_APP_URL);
  const rateLimitSecret = String(env.RATE_LIMIT_HMAC_SECRET || '').trim();
  const authEnvPresent = !!(supabaseUrl && anonKey && serviceRoleKey && appUrl && rateLimitSecret);
  const localCommunityMode = !providerTestOverride && !authEnvPresent;
  const authConfigured = !localCommunityMode && !!(supabaseUrl && anonKey && serviceRoleKey && appUrl && rateLimitSecret);
  const googleDriveClientId = String(env.GOOGLE_DRIVE_CLIENT_ID || '').trim();
  const googleDriveClientSecret = String(env.GOOGLE_DRIVE_CLIENT_SECRET || '').trim();
  const googleDriveRedirectUri = String(env.GOOGLE_DRIVE_REDIRECT_URI || '').trim() || (appUrl ? `${appUrl}/api/creator/drive/callback` : '');
  const googleDriveEncryptionKey = String(env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY || '').trim();
  const driveRedirectMatchesApp = (() => {
    try {
      const redirect = new URL(googleDriveRedirectUri);
      return redirect.origin === appUrl && redirect.pathname === '/api/creator/drive/callback' && !redirect.search && !redirect.hash;
    } catch { return false; }
  })();
  const googleDriveConfigured = !localCommunityMode && authConfigured
    && /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleDriveClientId)
    && googleDriveClientSecret.length >= 8
    && /^[a-f0-9]{64}$/i.test(googleDriveEncryptionKey)
    && driveRedirectMatchesApp;

  const paymongoMode = String(env.PAYMONGO_MODE || 'test').trim().toLowerCase();
  const paymongoSecretKey = String(env.PAYMONGO_SECRET_KEY || '').trim();
  const paymongoWebhookSecret = String(env.PAYMONGO_WEBHOOK_SECRET || env.PAYMONGO_WEBHOOK_SIGNING_SECRET || '').trim();
  const paymentMethods = String(env.PAYMONGO_PAYMENT_METHOD_TYPES || 'card,gcash,paymaya,qrph')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter((value, index, values) => ['card', 'gcash', 'paymaya', 'qrph'].includes(value) && values.indexOf(value) === index);
  const paymongoConfigured = !localCommunityMode && paymongoMode === 'test'
    && /^sk_test_[A-Za-z0-9_-]{8,}$/.test(paymongoSecretKey)
    && /^whsk_[A-Za-z0-9_-]{8,}$/.test(paymongoWebhookSecret)
    && paymentMethods.length > 0;
  const checkoutConfigured = authConfigured && paymongoConfigured;

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    appUrl,
    rateLimitSecret,
    localCommunityMode,
    authConfigured,
    googleDriveClientId,
    googleDriveClientSecret,
    googleDriveRedirectUri,
    googleDriveEncryptionKey,
    googleDriveConfigured,
    paymongoMode,
    paymongoSecretKey,
    paymongoWebhookSecret,
    paymentMethods,
    paymongoConfigured,
    checkoutConfigured,
    cronSecret: String(env.CRON_SECRET || '').trim(),
    isProduction: String(env.NODE_ENV || '').toLowerCase() === 'production'
  };
}

export function publicRuntimeConfig(config = getRuntimeConfig()) {
  return {
    mode: config.localCommunityMode ? 'local-preview' : (config.authConfigured ? 'supabase' : 'local-preview'),
    localCommunityMode: config.localCommunityMode === true,
    authConfigured: config.authConfigured,
    checkoutConfigured: config.checkoutConfigured,
    paymentMode: config.checkoutConfigured ? 'paymongo-test' : 'demo-only',
    assetOrigin: !config.localCommunityMode && config.authConfigured ? config.supabaseUrl : '',
    // This describes environment presence only; it is not a live provider connectivity check.
    configured: config.authConfigured || config.checkoutConfigured
  };
}
