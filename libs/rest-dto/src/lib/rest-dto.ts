declare const CreationAttributeBrand: unique symbol;

export type CreationOptional<T> =
  // copied from sequelize's Model
  T extends null | undefined ? T : T & { [CreationAttributeBrand]?: true };

// Permission system types
export enum Permission {
  ADMIN = 'ADMIN',
  WRITE_SOME_ENTITY = 'WRITE_SOME_ENTITY',
  READ_SOME_ENTITY = 'READ_SOME_ENTITY',
}

export interface PermissionOption {
  value: Permission;
  label: string;
  description?: string;
}

export const PERMISSION_OPTIONS: PermissionOption[] = [
  {
    value: Permission.ADMIN,
    label: 'permissions.admin',
    description: 'Full system access and user management',
  },
  {
    value: Permission.WRITE_SOME_ENTITY,
    label: 'permissions.writeEntity',
    description: 'Can create, edit and delete magazines',
  },
  {
    value: Permission.READ_SOME_ENTITY,
    label: 'permissions.readEntity',
    description: 'Can only search and view magazines',
  },
];

export interface UserDTO {
  id: CreationOptional<number>;
  email: string;
  name: string;
  lastName: string;
  permissions: Permission[];
  password: string;
  deleted: boolean;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}
