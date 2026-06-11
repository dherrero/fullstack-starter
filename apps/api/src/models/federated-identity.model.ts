import { db } from '@api/adapters/db/pg.connector';
import { FederatedIdentityDTO } from '@dto';
import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';

export interface FederatedIdentityModel
  extends
    FederatedIdentityDTO,
    Model<
      InferAttributes<FederatedIdentityModel>,
      InferCreationAttributes<FederatedIdentityModel>
    > {}

const FederatedIdentity = db.define<FederatedIdentityModel>(
  'FederatedIdentity',
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
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    emailAtLink: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: 'email_at_link',
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deletedat',
    },
  },
  { tableName: 'federated_identity', timestamps: false },
);

export default FederatedIdentity;
