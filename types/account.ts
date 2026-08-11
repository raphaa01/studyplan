export interface LocalAccount {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export interface PublicAccount {
  id: string;
  name: string;
  username: string;
  createdAt: string;
}

export interface AccountStore {
  version: 2;
  accounts: LocalAccount[];
  activeAccountId: string | null;
}
