import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBCP8AKvVUSkk-ikIuPYD69ve1tBi5KGHk",
  authDomain: "event-and-outreach-planner.firebaseapp.com",
  projectId: "event-and-outreach-planner",
  storageBucket: "event-and-outreach-planner.firebasestorage.app",
  messagingSenderId: "312330670583",
  appId: "1:312330670583:web:c7e705feec7c05090e9ef2"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
