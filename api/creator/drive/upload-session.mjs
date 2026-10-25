import { getRuntimeConfig } from '../../../server/_lib/config.mjs';
import { methodOnly, readJsonBody, requireSameOrigin, safeErrorStatus, sendJson } from '../../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../../server/_lib/rate-limit.mjs';
import { requireVerifiedCreator } from '../../../server/_lib/creator-auth.mjs';
import { createDriveUploadSession, loadDriveConnection, refreshDriveAccessToken, STORAGE_AGREEMENT_VERSION } from '../../../server/_lib/google-drive.mjs';

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'POST')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured || !config.googleDriveConfigured) return sendJson(res, 503, { error: 'drive_not_configured', message: 'Secure Google Drive storage is not configured for this deployment.' });
  if (!requireSameOrigin(req, res, config.appUrl)) return;
  try {
    const body = await readJsonBody(req, 8 * 1024);
    const session = await requireVerifiedCreator(req, res, config, 'private Creator Drive uploads');
    if (!session) return;
    if (!(await consumeRateLimit(req, config, 'creator-drive-upload-session', 180, 60 * 60))) {
      return sendJson(res, 429, { error: 'rate_limited', message: 'Too many Drive uploads. Try again later.' });
    }
    const connection = await loadDriveConnection(config, session.user.id);
    if (!connection || connection.terms_version !== STORAGE_AGREEMENT_VERSION || !connection.terms_accepted_at) {
      return sendJson(res, 409, { error: 'drive_connection_required', message: 'Connect Google Drive and accept the current Storage Agreement before uploading originals.' });
    }
    const accessToken = await refreshDriveAccessToken(config, connection);
    const uploadUrl = await createDriveUploadSession(accessToken, connection, session.user.id, {
      kind: body.asset_kind,
      fileName: body.file_name,
      mimeType: body.mime_type,
      size: body.size
    });
    sendJson(res, 201, { ok: true, uploadUrl, assetKind: body.asset_kind });
  } catch (error) {
    console.error('Creator Drive upload session failed:', error?.message || 'unknown_error');
    sendJson(res, safeErrorStatus(error, 503), { error: error?.code || 'drive_upload_unavailable', message: error?.code === 'drive_reauthorization_required'
      ? 'Reconnect Google Drive before uploading.'
      : 'A private Google Drive upload session could not be created.' });
  }
}
