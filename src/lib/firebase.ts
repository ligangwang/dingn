import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// Public web configuration for the existing dingn project. Access is enforced by Firebase rules.
export function firebase() {
  const app =
    getApps().find((app) => app.name === "dingn") ||
    initializeApp(
      {
        apiKey:
          process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
          "AIzaSyDzWk1JfjsMi9o_yPBz69XSQmWBXfC8dWs",
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dingn.com",
        projectId:
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dingn-193716",
        appId:
          process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
          "1:211238433635:web:856acf8ae8932c471dd956",
        storageBucket: "dingn-193716.appspot.com",
        messagingSenderId: "211238433635",
      },
      "dingn",
    );
  return { auth: getAuth(app), db: getFirestore(app) };
}
