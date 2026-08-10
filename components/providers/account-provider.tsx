"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SupabaseAccountRepository } from "@/lib/storage/supabase-account-repository";
import type { PublicAccount, SignUpResult } from "@/types/account";

interface AccountContextValue {
  account: PublicAccount | null;
  hydrated: boolean;
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<PublicAccount | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const repositoryRef = useRef<SupabaseAccountRepository | null>(null);
  const repository = useCallback(() => repositoryRef.current ??= new SupabaseAccountRepository(), []);

  useEffect(() => {
    let active = true;
    const accountRepository = repository();
    const unsubscribe = accountRepository.onAuthStateChange((nextAccount) => {
      if (active) setAccount(nextAccount);
    });
    accountRepository.getCurrent().then((nextAccount) => {
      if (!active) return;
      setAccount(nextAccount);
      setHydrated(true);
    }).catch(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; unsubscribe(); };
  }, [repository]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const result = await repository().signUp(name, email, password);
    if (result.account) setAccount(result.account);
    return result;
  }, [repository]);

  const signIn = useCallback(async (email: string, password: string) => {
    setAccount(await repository().signIn(email, password));
  }, [repository]);

  const signOut = useCallback(async () => {
    await repository().signOut();
    setAccount(null);
  }, [repository]);

  const updateName = useCallback(async (name: string) => {
    setAccount(await repository().updateName(name));
  }, [repository]);

  const value = useMemo(() => ({ account, hydrated, signUp, signIn, signOut, updateName }), [account, hydrated, signIn, signOut, signUp, updateName]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used inside AccountProvider");
  return context;
}
