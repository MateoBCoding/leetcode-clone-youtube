import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
	apiKey: "AIzaSyCE_n_a6CALzFQCNkmLLMkvAY5sr9KrcJ8",
	authDomain: "onlinejudget-1.firebaseapp.com",
	projectId: "onlinejudget-1",
	storageBucket: "onlinejudget-1.firebasestorage.app",
	messagingSenderId: "903019704720",
	appId: "1:903019704720:web:623ddf38a1a8dc49468315",
	measurementId: "G-DNJJTBX6JX"
  };

const app = !getApps.length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const firestore = getFirestore(app);

export { auth, firestore, app };
