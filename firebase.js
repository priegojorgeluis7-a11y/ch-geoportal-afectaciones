// Configuración de Firebase para pines colaborativos
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCXwtwZLkRK9lmNh0JMkPWJPmcYUaFiYLo",
  authDomain: "geoportal-afectaciones.firebaseapp.com",
  projectId: "geoportal-afectaciones",
  storageBucket: "geoportal-afectaciones.firebasestorage.app",
  messagingSenderId: "402384431919",
  appId: "1:402384431919:web:081b741776779ef4b08fda",
  measurementId: "G-DLN2G60MCS",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const PINS_COLLECTION = "gif_pins";

/**
 * Obtiene todos los pines desde Firestore.
 * @returns {Promise<Array>}
 */
export async function loadPinsFromFirestore() {
  try {
    const snapshot = await getDocs(collection(db, PINS_COLLECTION));
    return snapshot.docs.map((docSnap) => ({ _firestoreId: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.error("Error cargando pines desde Firestore:", err);
    return [];
  }
}

/**
 * Guarda un nuevo pin en Firestore y devuelve el ID asignado.
 * @param {Object} pin
 * @returns {Promise<string|null>}
 */
export async function savePinToFirestore(pin) {
  try {
    const { _firestoreId, ...data } = pin;
    const ref = await addDoc(collection(db, PINS_COLLECTION), data);
    return ref.id;
  } catch (err) {
    console.error("Error guardando pin en Firestore:", err);
    return null;
  }
}

/**
 * Actualiza un pin existente en Firestore.
 * @param {string} firestoreId
 * @param {Object} data
 */
export async function updatePinInFirestore(firestoreId, data) {
  try {
    const { _firestoreId, ...cleanData } = data;
    await updateDoc(doc(db, PINS_COLLECTION, firestoreId), cleanData);
  } catch (err) {
    console.error("Error actualizando pin en Firestore:", err);
  }
}

/**
 * Elimina un pin de Firestore.
 * @param {string} firestoreId
 */
export async function deletePinFromFirestore(firestoreId) {
  try {
    await deleteDoc(doc(db, PINS_COLLECTION, firestoreId));
  } catch (err) {
    console.error("Error eliminando pin de Firestore:", err);
  }
}

/**
 * Suscribe a cambios en tiempo real en la colección de pines.
 * @param {Function} callback - Función llamada con el array actualizado de pines.
 * @returns {Function} Unsubscribe function
 */
export function subscribeToPins(callback) {
  return onSnapshot(collection(db, PINS_COLLECTION), (snapshot) => {
    const pins = snapshot.docs.map((docSnap) => ({ _firestoreId: docSnap.id, ...docSnap.data() }));
    callback(pins);
  }, (err) => {
    console.error("Error en suscripción de pines:", err);
  });
}
