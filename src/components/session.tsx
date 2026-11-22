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
/** What an account may do on dingn (scripts/roles.mjs). */
export type Role = "admin" | "developer" | "tester";
type Account = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  /** Every role the account holds; isAdmin, isDeveloper and isTester are shortcuts. */
  roles?: Role[];
  isAdmin: boolean;
  /** Has the developer role: uploads games and makes upload keys. */
  isDeveloper?: boolean;
  /** A test account an admin made on the Users page. */
  isTester?: boolean;
};
type Session = {
  user: Account | null;
  ready: boolean;
  /** The signed-in account's roles (none when signed out). */
  roles: Role[];
  isAdmin: boolean;
  isDeveloper: boolean;
  /** Signed in with a test account: kept out of statistics, marked TEST. */
  isTester: boolean;
  profile: Profile;
  profileError: string;
  stats: PlayerStats | null;
  setStats: (stats: PlayerStats | null) => void;
  login: () => Promise<void>;
  /**
   * Signs in with email, or makes a new account (`create`, with the password
   * typed again as `confirm`). A new account isn't signed in: it resolves
   * with `activate` once its activation link is emailed.
   */
  loginEmail: (
    email: string,
    password: string,
    create: boolean,
    confirm?: string,
  ) => Promise<{ activate: boolean }>;
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
          if (!active) return;
          setStats(value);
          // A new player's default nickname is given by the server on this
          // first call, after their profile was read without one.
          if (value.name)
            setProfile((p) =>
              p.userName ? p : { ...p, userName: value.name! },
            );
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
        roles: user?.roles ?? [],
        isAdmin: user?.isAdmin === true,
        isDeveloper: user?.isDeveloper === true,
        isTester: user?.isTester === true,
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
        loginEmail: async (email, password, create, confirm) => {
          if (create) {
            await api("/api/auth/signup", { email, password, confirm });
            return { activate: true };
          }
          await accept(
            await api<Account>("/api/auth/login", { email, password }),
          );
          return { activate: false };
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
/** The session when one is provided, or null (for pages that also work signed out). */
export function useOptionalSession() {
  return useContext(SessionContext);
}
