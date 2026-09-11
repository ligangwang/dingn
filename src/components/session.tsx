"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { firebase } from "@/lib/firebase";
import { defaultProfile, friendlyError, type Profile } from "@/lib/models";
import { readProfile, saveProfile } from "@/lib/repository";

type Session = {
  user: User | null;
  ready: boolean;
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
  const [profile, setProfile] = useState(defaultProfile);
  const [profileError, setProfileError] = useState("");
  useEffect(() => {
    let active = true,
      generation = 0;
    const stop = onAuthStateChanged(
      firebase().auth,
      async (next) => {
        const ticket = ++generation;
        setReady(false);
        setUser(next);
        setProfile(defaultProfile);
        setProfileError("");
        try {
          if (next) {
            const value = await readProfile(next.uid);
            if (active && ticket === generation) setProfile(value);
          }
        } catch (e) {
          if (active && ticket === generation)
            setProfileError(friendlyError(e));
        } finally {
          if (active && ticket === generation) setReady(true);
        }
      },
      (e) => {
        if (active) {
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
