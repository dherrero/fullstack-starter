import { Permission } from '@dto';

export interface AuthConfig {
  idpServer: string;
  pingUrl?: string;
}

export interface Login {
  email: string;
  password: string;
  remember: boolean;
}

export interface UserTokenData {
  id: number;
  email: string;
  permissions: Permission[];
  remember: boolean;
}
