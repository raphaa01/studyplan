export interface LocalAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export interface PublicAccount {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface SignUpResult {
  account: PublicAccount | null;
  confirmationRequired: boolean;
}

export interface AccountStore {
  version: 1;
  accounts: LocalAccount[];
  activeAccountId: string | null;
}
