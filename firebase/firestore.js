// firebase/firestore.js
// Firestore Database helper functions for User Profile management

import { db } from './firebase-config.js';
import { 
    doc, 
    getDoc, 
    setDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Saves basic user profile information to Firestore if the user doesn't exist yet.
 * Structure in Firestore: users/{uid}
 * 
 * @param {Object} user - Firebase Auth User Object
 */
export async function saveUserProfile(user) {
    if (!user || !user.uid) return;

    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // First time login: Create new user document
            await setDoc(userRef, {
                uid: user.uid,
                name: (user.displayName || user.email || 'Anonymous User').trim(),
                email: user.email || '',
                photoURL: user.photoURL || '',
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp()
            });
        } else {
            // Returning user: Update last login timestamp
            const existingData = userSnap.data() || {};
            await setDoc(userRef, {
                lastLoginAt: serverTimestamp(),
                name: user.displayName || existingData.name || 'Anonymous User',
                photoURL: user.photoURL || existingData.photoURL || ''
            }, { merge: true });
        }
    } catch (error) {
        console.error("[Firestore] Error saving user profile:", error?.message || error);
        throw error;
    }
}

/**
 * Saves full user notes library (books, chapters, pages, contents) to Firestore.
 * Firestore Document Path: users/{uid}/notes/data
 * 
 * @param {string} uid - User ID
 * @param {Object} notesData - Notes state object
 */
export async function saveUserNotes(uid, notesData) {
    if (!uid || !notesData) return { success: false, error: "Missing UID or notes data" };

    try {
        // Sanitize data to strip any undefined values that cause Firestore setDoc to fail
        const cleanData = JSON.parse(JSON.stringify(notesData));
        const notesRef = doc(db, "users", uid, "notes", "data");
        await setDoc(notesRef, {
            ...cleanData,
            updatedAt: serverTimestamp()
        }, { merge: true });
        console.log("[Firestore] Notes saved successfully for UID:", uid);
        return { success: true };
    } catch (error) {
        console.error("[Firestore] Error saving user notes:", error);
        const errMsg = error.code ? `[${error.code}] ${error.message}` : (error.message || "Failed to save notes to Firestore");
        return { success: false, error: errMsg, code: error.code };
    }
}

/**
 * Loads user notes library from Firestore.
 * 
 * @param {string} uid - User ID
 * @returns {Object|null} Notes state object or null if not found
 */
export async function loadUserNotes(uid) {
    if (!uid) return null;

    try {
        const notesRef = doc(db, "users", uid, "notes", "data");
        const notesSnap = await getDoc(notesRef);

        if (notesSnap.exists()) {
            console.log("[Firestore] Notes loaded for UID:", uid);
            return notesSnap.data();
        } else {
            console.log("[Firestore] No existing notes found for UID:", uid);
            return null;
        }
    } catch (error) {
        console.error("[Firestore] Error loading user notes:", error);
        return null;
    }
}
