import { getRuntimeConfig } from '../../../server/_lib/config.mjs';
import { methodOnly, readJsonBody, requireSameOrigin, safeErrorStatus, sendJson } from '../../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../../server/_lib/rate-limit.mjs';
import { requireVerifiedCreator } from '../../../server/_lib/creator-auth.mjs';
import { driveFileIdFromPrivateUrl, getDriveFileMetadata, isDriveFileId, loadDriveConnection, privateDriveFileUrl, refreshDriveAccessToken, STORAGE_AGREEMENT_VERSION, validateDriveAssetMetadata } from '../../../server/_lib/google-drive.mjs';

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'POST')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured || !config.googleDriveConfigured) return sendJson(res, 503, { error: 'drive_not_configured' });
  if (!requireSameOrigin(req, res, config.appUrl)) return;
  try {
    const body = await readJsonBody(req, 8 * 1024);
    const fileId = String(body.file_id || '');
    const assetKind = String(body.asset_kind || '');
    if (!isDriveFileId(fileId) || !['master', 'preview'].includes(assetKind)) return sendJson(res, 400, { error: 'invalid_drive_file' });
    const session = await requireVerifiedCreator(req, res, config, 'private Creator Drive uploads');
    if (!session) return;
    if (!(await consumeRateLimit(req, config, 'creator-drive-upload-complete', 240, 60 * 60))) {
      return sendJson(res, 429, { error: 'rate_limited' });
    }
    const connection = await loadDriveConnection(config, session.user.id);
    if (!connection || connection.terms_version !== STORAGE_AGREEMENT_VERSION || !connection.terms_accepted_at) {
      return sendJson(res, 409, { error: 'drive_connection_required' });
    }
    const accessToken = await refreshDriveAccessToken(config, connection);
    const metadata = await getDriveFileMetadata(accessToken, fileId);
    if (!metadata.response.ok) {
      const status = metadata.response.status === 404 ? 404 : metadata.response.status === 403 ? 403 : 503;
      return sendJson(res, status, { error: 'drive_file_not_available', message: 'The uploaded file could not be verified in your private ArtNexus_Vault.' });
    }
    if (!validateDriveAssetMetadata(metadata.payload, connection, session.user.id, assetKind)) {
      return sendJson(res, 403, { error: 'drive_file_not_owned', message: 'Only files uploaded through this private Art Nexus Drive connection can be attached to a work.' });
    }
    const privateUrl = privateDriveFileUrl(fileId);
    if (!driveFileIdFromPrivateUrl(privateUrl)) return sendJson(res, 400, { error: 'invalid_drive_file' });
    sendJson(res, 200, { ok: true, fileId, assetKind, privateUrl, mimeType: metadata.payload.mimeType, size: Number(metadata.payload.size) });
  } catch (error) {
    console.error('Creator Drive upload verification failed:', error?.message || 'unknown_error');
    sendJson(res, safeErrorStatus(error, 503), { error: error?.code || 'drive_file_unavailable', message: 'The Drive upload could not be verified. Reconnect Drive or upload the file again.' });
  }
}
