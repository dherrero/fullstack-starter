/**
 * Returns `url` only if it is a safe same-origin relative path, otherwise ''.
 *
 * Blocks open-redirect payloads: absolute URLs (`https://evil.com`), scheme
 * tricks (`javascript:...`), protocol-relative (`//evil.com`) and backslash
 * variants (`/\evil.com`, `/\/evil.com`). Only a single leading '/' followed by
 * non-backslash characters is accepted (paths, query and fragment included).
 */
export const sanitizeRedirect = (url: string | null | undefined): string => {
  if (!url) return '';
  const isSameOriginPath = /^\/(?!\/)[^\\]*$/.test(url);
  return isSameOriginPath ? url : '';
};
