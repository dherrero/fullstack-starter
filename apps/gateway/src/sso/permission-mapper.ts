import { ClaimPermissionMapping, Permission } from '@dto';

/**
 * Maps the IdP group/role claim to local permissions using the provider's
 * configured `permissionMap`. Only claims VALIDATED inside the ID token must
 * be passed here. The result is a SUGGESTION — the api floors it (and always
 * strips ADMIN on provisioning), so a manipulated claim cannot escalate.
 */
export const mapGroupsToPermissions = (
  groupsClaim: unknown,
  permissionMap: ClaimPermissionMapping[],
): Permission[] => {
  const groups: string[] = Array.isArray(groupsClaim)
    ? groupsClaim.filter((g): g is string => typeof g === 'string')
    : typeof groupsClaim === 'string'
      ? [groupsClaim]
      : [];

  const permissions = new Set<Permission>();
  for (const mapping of permissionMap) {
    if (groups.includes(mapping.claim)) {
      mapping.permissions.forEach((p) => permissions.add(p));
    }
  }
  return Array.from(permissions);
};
