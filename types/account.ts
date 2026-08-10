export interface LocalAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export type PublicAccount = Omit<LocalAccount, "passwordHash" | "salt">;

export interface AccountStore {
  version: 1;
  accounts: LocalAccount[];
  activeAccountId: string | null;
}
