"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { firebase } from "@/lib/firebase";
import { defaultProfile, friendlyError, type Profile } from "@/lib/models";
import { readProfile, saveProfile } from "@/lib/repository";
import { isPremiumClaim } from "@/lib/premium";

type Session = {
  user: User | null;
  ready: boolean;
  isAdmin: boolean;
  isPremium: boolean;
  refreshClaims: () => Promise<void>;
  profile: Profile;
  profileError: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: Profile) => Promise<void>;
};
const SessionContext = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const loadedUid = useRef<string | null>(null);
  const [profile, setProfile] = useState(defaultProfile);
  const [profileError, setProfileError] = useState("");
  useEffect(() => {
    let active = true,
      generation = 0;
    const stop = onIdTokenChanged(
      firebase().auth,
      async (next) => {
        const ticket = ++generation;
        // A refreshed token for the same player only updates their claims.
        if (next && next.uid === loadedUid.current) {
          try {
            const token = await next.getIdTokenResult();
            if (active && ticket === generation) {
              setIsAdmin(token.claims.admin === true);
              setIsPremium(isPremiumClaim(token.claims));
            }
          } catch {
            // Keep the claims already shown.
          }
          return;
        }
        loadedUid.current = null;
        setReady(false);
        setUser(next);
        setIsAdmin(false);
        setIsPremium(false);
        setProfile(defaultProfile);
        setProfileError("");
        try {
          if (next) {
            const token = await next.getIdTokenResult();
            if (active && ticket === generation) {
              setIsAdmin(token.claims.admin === true);
              setIsPremium(isPremiumClaim(token.claims));
            }
            const value = await readProfile(next.uid);
            if (active && ticket === generation) setProfile(value);
          }
        } catch (e) {
          if (active && ticket === generation)
            setProfileError(friendlyError(e));
        } finally {
          if (active && ticket === generation) {
            loadedUid.current = next?.uid ?? null;
            setReady(true);
          }
        }
      },
      (e) => {
        if (active) {
          setIsAdmin(false);
          setIsPremium(false);
          setProfileError(friendlyError(e));
          setReady(true);
        }
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, []);
  return (
    <SessionContext.Provider
      value={{
        user,
        ready,
        isAdmin,
        isPremium,
        refreshClaims: async () => {
          // Forces a new ID token; onIdTokenChanged applies the new claims.
          if (user) await user.getIdToken(true);
        },
        profile,
        profileError,
        login: async () => {
          await signInWithPopup(firebase().auth, new GoogleAuthProvider());
        },
        logout: async () => {
          await signOut(firebase().auth);
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
