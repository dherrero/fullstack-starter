import { db } from '@api/adapters/db/pg.connector';
import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';

export interface RefreshTokenFamilyAttributes {
  id: number;
  userId: number;
  familyId: string;
  jti: string;
  parentJti: string | null;
  used: boolean;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt?: Date | null;
}

export interface RefreshTokenFamilyModel
  extends
    RefreshTokenFamilyAttributes,
    Model<
      InferAttributes<RefreshTokenFamilyModel>,
      InferCreationAttributes<RefreshTokenFamilyModel>
    > {}

const RefreshTokenFamily = db.define<RefreshTokenFamilyModel>(
  'RefreshTokenFamily',
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'user_id',
    },
    familyId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'family_id',
    },
    jti: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    parentJti: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'parent_jti',
    },
    used: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'createdat',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'updatedat',
    },
  },
  { tableName: 'refresh_token_family' },
);

export default RefreshTokenFamily;
