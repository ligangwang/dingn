"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { defaultProfile, friendlyError, type Profile } from "@/lib/models";
import { readProfile, saveProfile } from "@/lib/repository";
import { fetchStats, type PlayerStats } from "@/lib/xp";
type Account = {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  // Set by the Stripe payments extension's stripeRole claim.
  isPremium?: boolean;
};
type Session = {
  user: Account | null;
  ready: boolean;
  isAdmin: boolean;
  profile: Profile;
  profileError: string;
  stats: PlayerStats | null;
  setStats: (stats: PlayerStats | null) => void;
  login: () => Promise<void>;
  loginEmail: (
    email: string,
    password: string,
    create: boolean,
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: Profile) => Promise<void>;
};
const SessionContext = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(defaultProfile);
  const [profileError, setProfileError] = useState("");
  const [stats, setStats] = useState<PlayerStats | null>(null);
  useEffect(() => {
    let active = true;
    setStats(null);
    if (user)
      fetchStats()
        .then((value) => {
          if (active) setStats(value);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.uid]);
  async function accept(account: Account | null) {
    setUser(account);
    setProfile(defaultProfile);
    setProfileError("");
    if (account) {
      try {
        setProfile(await readProfile(account.uid));
      } catch (error) {
        setProfileError(friendlyError(error));
      }
    }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const account = await api<Account | null>("/api/auth/session");
        if (!active) return;
        setUser(account);
        if (account) {
          const value = await readProfile(account.uid);
          if (active) setProfile(value);
        }
      } catch (error) {
        if (active) setProfileError(friendlyError(error));
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return (
    <SessionContext.Provider
      value={{
        user,
        ready,
        isAdmin: user?.isAdmin === true,
        profile,
        profileError,
        stats,
        setStats,
        login: async () => {
          // Loaded only after an explicit Google button click. Email sessions never initialize Firebase JS.
          const [{ firebase }, sdk] = await Promise.all([
            import("@/lib/firebase"),
            import("firebase/auth"),
          ]);
          const auth = firebase().auth;
          await sdk.setPersistence(auth, sdk.inMemoryPersistence);
          try {
            const result = await sdk.signInWithPopup(
              auth,
              new sdk.GoogleAuthProvider(),
            );
            const account = await api<Account>("/api/auth/google", {
              refreshToken: result.user.refreshToken,
            });
            await accept(account);
          } finally {
            await sdk.signOut(auth);
          }
        },
        loginEmail: async (email, password, create) => {
          await accept(
            await api<Account>(
              create ? "/api/auth/signup" : "/api/auth/login",
              { email, password },
            ),
          );
        },
        logout: async () => {
          await api("/api/auth/logout");
          await accept(null);
        },
        updateProfile: async (value) => {
          if (!user) throw new Error("Sign in required");
          await saveProfile(user.uid, value);
          setProfile(value);
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session provider missing");
  return value;
}
