import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isBootstrappedAdminEmail,
} from '../lib/firebase';
import { isBootstrappedAdminUid } from '../lib/adminAllowlist';

export interface AuthDiagnostics {
  providerIds: string[];
  userEmailVerified: boolean;
  tokenHasEmail: boolean;
  tokenEmailVerified: boolean;
}

interface AuthContextValue {
  user: User | null;
  resolvedEmail: string;
  loading: boolean;
  isAdmin: boolean;
  isBootstrappedAdmin: boolean;
  denialReason: 'unverified' | 'not_admin' | null;
  authDiagnostics: AuthDiagnostics | null;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getProfileEmailCacheKey(uid: string): string {
  return `palm_metric_oauth_email_${uid}`;
}

function getEffectiveEmail(
  currentUser: User | null,
  tokenClaims?: Record<string, unknown>
): string {
  if (!currentUser) return '';
  const direct = currentUser.email?.trim();
  if (direct) return direct;
  const fromProvider = currentUser.providerData?.find((p) => p?.email)?.email?.trim();
  if (fromProvider) return fromProvider;
  const claimEmail = tokenClaims?.email;
  if (typeof claimEmail === 'string' && claimEmail.trim()) return claimEmail.trim();
  const firebaseClaim = tokenClaims?.firebase as
    | { identities?: { email?: string[] } }
    | undefined;
  const identityEmail = firebaseClaim?.identities?.email?.[0]?.trim();
  if (identityEmail) return identityEmail;
  try {
    const cached = sessionStorage.getItem(getProfileEmailCacheKey(currentUser.uid));
    if (cached && cached.trim()) return cached.trim();
  } catch {
    // Ignore storage access errors
  }
  return '';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBootstrappedAdmin, setIsBootstrappedAdmin] = useState(false);
  const [denialReason, setDenialReason] = useState<'unverified' | 'not_admin' | null>(null);
  const [authDiagnostics, setAuthDiagnostics] = useState<AuthDiagnostics | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const evaluateSession = async (currentUser: User | null, overrideEmail?: string) => {
    if (!currentUser) {
      setUser(null);
      setResolvedEmail('');
      setIsAdmin(false);
      setIsBootstrappedAdmin(false);
      setDenialReason(null);
      setAuthDiagnostics(null);
      setLoading(false);
      return;
    }

    if (currentUser.isAnonymous) {
      await signOut(auth).catch(() => {});
      setUser(null);
      setResolvedEmail('');
      setIsAdmin(false);
      setIsBootstrappedAdmin(false);
      setDenialReason(null);
      setAuthDiagnostics(null);
      setLoading(false);
      return;
    }

    try {
      await currentUser.reload();
    } catch {
      // Ignore transient reload errors
    }

    const tokenResult = await currentUser
      .getIdTokenResult(!currentUser.emailVerified)
      .catch(() => null);
    const tokenClaims = tokenResult?.claims as Record<string, unknown> | undefined;
    const effectiveEmail =
      (overrideEmail && overrideEmail.trim()) ||
      getEffectiveEmail(currentUser, tokenClaims);

    const providerIds = (currentUser.providerData || [])
      .map((p) => p?.providerId)
      .filter((id): id is string => Boolean(id));
    const tokenHasEmail =
      typeof tokenClaims?.email === 'string' && tokenClaims.email.trim().length > 0;
    const tokenEmailVerified = tokenClaims?.email_verified === true;

    setUser(currentUser);
    setResolvedEmail(effectiveEmail);
    setAuthDiagnostics({
      providerIds,
      userEmailVerified: Boolean(currentUser.emailVerified),
      tokenHasEmail,
      tokenEmailVerified,
    });

    const hasGoogleProvider = providerIds.includes('google.com');
    const isBootstrappedUid = isBootstrappedAdminUid(currentUser.uid);
    const matchesBootstrapped =
      isBootstrappedUid || isBootstrappedAdminEmail(effectiveEmail) || isBootstrappedAdminEmail(currentUser.email);

    const isEmailVerified = Boolean(
      currentUser.emailVerified ||
        tokenEmailVerified ||
        isBootstrappedUid ||
        (hasGoogleProvider && effectiveEmail.length > 0)
    );

    if (!isEmailVerified) {
      setIsAdmin(false);
      setIsBootstrappedAdmin(false);
      setDenialReason('unverified');
      setLoading(false);
      return;
    }

    if (matchesBootstrapped) {
      setIsAdmin(true);
      setIsBootstrappedAdmin(true);
      setDenialReason(null);
      setLoading(false);
      return;
    }

    setIsBootstrappedAdmin(false);
    const adminPath = `admins/${currentUser.uid}`;
    try {
      const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
      const allowed = adminSnap.exists();
      setIsAdmin(allowed);
      setDenialReason(allowed ? null : 'not_admin');
    } catch (error) {
      // Non-admin users may receive permission-denied if admins doc doesn't exist or rules reject
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.toLowerCase().includes('permission') ||
        message.toLowerCase().includes('offline')
      ) {
        setIsAdmin(false);
        setDenialReason('not_admin');
      } else {
        handleFirestoreError(error, OperationType.GET, adminPath);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      void evaluateSession(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const info = getAdditionalUserInfo(credential);
      const profileEmail = (info?.profile as { email?: unknown } | undefined)?.email;
      const trimmedProfileEmail =
        typeof profileEmail === 'string' && profileEmail.trim()
          ? profileEmail.trim()
          : '';
      if (trimmedProfileEmail) {
        try {
          sessionStorage.setItem(
            getProfileEmailCacheKey(credential.user.uid),
            trimmedProfileEmail
          );
        } catch {
          // Ignore storage access errors
        }
        await evaluateSession(credential.user, trimmedProfileEmail);
      }
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed before completing authentication.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Browser blocked the sign-in popup. Please allow popups for this site and try again.');
      } else if (code === 'auth/configuration-not-found') {
        setAuthError(
          'Firebase Authentication is not enabled yet in palm-metric-app. In Firebase Console → Authentication → Get started, enable Google Sign-in.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          `This domain (${window.location.hostname}) is not authorized in palm-metric-app. Add it in Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else {
        setAuthError(error instanceof Error ? error.message : 'Unable to sign in with Google.');
      }
    }
  };

  const logout = async () => {
    setAuthError(null);
    if (user?.uid) {
      try {
        sessionStorage.removeItem(getProfileEmailCacheKey(user.uid));
      } catch {
        // Ignore storage errors
      }
    }
    await signOut(auth);
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        resolvedEmail,
        loading,
        isAdmin,
        isBootstrappedAdmin,
        denialReason,
        authDiagnostics,
        authError,
        signInWithGoogle,
        logout,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
