import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

type FirebaseRuntime = {
  app: FirebaseApp;
  db: Firestore;
};

function readFirebaseConfig(): FirebaseOptions | null {
  const config: FirebaseOptions = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  if (!config.apiKey || !config.projectId || !config.appId) return null;
  return config;
}

export function getFirebaseRuntime(): FirebaseRuntime | null {
  const config = readFirebaseConfig();
  if (!config) return null;

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  return {
    app,
    db: getFirestore(app),
  };
}
