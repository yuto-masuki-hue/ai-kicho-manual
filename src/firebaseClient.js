import {initializeApp, getApps, getApp} from 'firebase/app';
import {getAuth, GoogleAuthProvider} from 'firebase/auth';
import {getFunctions} from 'firebase/functions';

// FirebaseコンソールのHosting/プロジェクト設定 > 全般 > マイアプリ で確認できる値に置き換えてください
const firebaseConfig = {
  apiKey: "AIzaSyCiF1w8Oa3NUk9vkj__QPIHCc4AcWpaIzk",
  authDomain: "pdfxtext.firebaseapp.com",
  projectId: "pdfxtext",
  storageBucket: "pdfxtext.firebasestorage.app",
  messagingSenderId: "786634775886",
  appId: "1:786634775886:web:abafd213e13279371e521f"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const functions = getFunctions(app, 'asia-northeast1');
export const provider = new GoogleAuthProvider();
