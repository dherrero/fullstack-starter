import { describe, expect, it } from 'vitest';
import { Permission } from '@dto';
import { mapGroupsToPermissions } from './permission-mapper';

const map = [
  {
    claim: 'admins',
    permissions: [Permission.ADMIN, Permission.WRITE_SOME_ENTITY],
  },
  { claim: 'viewers', permissions: [Permission.READ_SOME_ENTITY] },
];

describe('mapGroupsToPermissions', () => {
  it('unions permissions for every matched group claim', () => {
    expect(mapGroupsToPermissions(['admins', 'viewers'], map).sort()).toEqual(
      [
        Permission.ADMIN,
        Permission.READ_SOME_ENTITY,
        Permission.WRITE_SOME_ENTITY,
      ].sort(),
    );
  });

  it('accepts a single string claim', () => {
    expect(mapGroupsToPermissions('viewers', map)).toEqual([
      Permission.READ_SOME_ENTITY,
    ]);
  });

  it('returns empty for unmatched, missing, or non-string groups', () => {
    expect(mapGroupsToPermissions(['unknown'], map)).toEqual([]);
    expect(mapGroupsToPermissions(undefined, map)).toEqual([]);
    expect(mapGroupsToPermissions([123, null], map)).toEqual([]);
    expect(mapGroupsToPermissions(['admins'], [])).toEqual([]);
  });
});
