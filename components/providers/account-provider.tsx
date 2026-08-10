"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LocalAccountRepository } from "@/lib/storage/account-repository";
import { LocalStorageRepository } from "@/lib/storage/local-storage-repository";
import { createDemoData } from "@/lib/demo-data";
import type { PublicAccount } from "@/types/account";

interface AccountContextValue {
  account: PublicAccount | null;
  accounts: PublicAccount[];
  hydrated: boolean;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  updateName: (name: string) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);
const accountRepository = new LocalAccountRepository();

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<PublicAccount | null>(null);
  const [accounts, setAccounts] = useState<PublicAccount[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setAccount(accountRepository.getActive());
      setAccounts(accountRepository.list());
      setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const isFirstAccount = accountRepository.list().length === 0;
    const next = await accountRepository.signUp(name, email, password);
    if (isFirstAccount) LocalStorageRepository.migrateLegacyTo(next.id);
    const studyRepository = new LocalStorageRepository(next.id);
    const studyData = studyRepository.getAll() ?? createDemoData();
    studyRepository.saveAll({ ...studyData, preferences: { ...studyData.preferences, name: next.name, onboardingCompleted: false } });
    setAccount(next);
    setAccounts(accountRepository.list());
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAccount(await accountRepository.signIn(email, password));
  }, []);

  const signOut = useCallback(() => {
    accountRepository.signOut();
    setAccount(null);
  }, []);

  const updateName = useCallback((name: string) => {
    setAccount((current) => current ? accountRepository.updateName(current.id, name) : null);
    setAccounts(accountRepository.list());
  }, []);

  const value = useMemo(() => ({ account, accounts, hydrated, signUp, signIn, signOut, updateName }), [account, accounts, hydrated, signIn, signOut, signUp, updateName]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used inside AccountProvider");
  return context;
}
