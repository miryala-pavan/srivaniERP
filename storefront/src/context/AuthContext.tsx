'use client';

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from 'react';
import {
  SessionProvider,
  useSession,
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut,
} from 'next-auth/react';
import { clearVerifiedPhone } from '@/lib/phone-auth';

export interface UserProfile {
  name: string;
  email: string;
  image?: string | null;
}

interface AuthCtx {
  user: UserProfile | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  signIn: (callbackUrl?: string) => void;
  signOut: (callbackUrl?: string) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

function AuthProviderInner({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  const user: UserProfile | null =
    status === 'authenticated' && session?.user
      ? {
          name: session.user.name ?? 'Customer',
          email: session.user.email ?? '',
          image: session.user.image ?? null,
        }
      : null;

  const handleSignIn = useCallback((callbackUrl?: string) => {
    nextAuthSignIn('google', { callbackUrl: callbackUrl ?? '/' });
  }, []);

  const handleSignOut = useCallback((callbackUrl?: string) => {
    clearVerifiedPhone();
    nextAuthSignOut({ callbackUrl: callbackUrl ?? '/' });
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        isLoggedIn: status === 'authenticated',
        isLoading: status === 'loading',
        signIn: handleSignIn,
        signOut: handleSignOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthProviderInner>{children}</AuthProviderInner>
    </SessionProvider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
