// firebase/auth.js
// Firebase Authentication logic for Google Sign-In (Popup & Redirect Fallback) and Session Management

import { auth, firebaseConfig } from './firebase-config.js';
import { 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithRedirect,
    getRedirectResult,
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { saveUserProfile } from './firestore.js';

// Configure Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

/**
 * Checks if the user has replaced placeholder credentials in firebase-config.js
 */
export function isFirebaseConfigured() {
    const isConfigured = Boolean(
        firebaseConfig && 
        firebaseConfig.apiKey && 
        firebaseConfig.apiKey !== "YOUR_API_KEY" && 
        !firebaseConfig.apiKey.includes("YOUR_API")
    );
    console.log("[Auth] isFirebaseConfigured check:", isConfigured, firebaseConfig);
    return isConfigured;
}

/**
 * Trigger Google Sign-In with automatic fallback to Redirect if Popup is blocked.
 * On success, saves user profile to Firestore and returns user data.
 */
export async function signInWithGoogle() {
    // Prevent launching popups to invalid dummy domains (e.g. your_project_id.firebaseapp.com)
    if (!isFirebaseConfigured()) {
        console.warn("[Auth] Firebase credentials not configured in firebase/firebase-config.js");
        return { 
            success: false, 
            isUnconfigured: true,
            error: "Firebase project credentials not set yet in firebase/firebase-config.js." 
        };
    }

    if (window.location.protocol === 'file:') {
        console.warn("[Auth] Firebase Auth does not work on file:// URLs.");
        return {
            success: false,
            error: "Firebase Auth requires a local server. Please use Live Server or python -m http.server to test login."
        };
    }

    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Persist/update user profile in Firestore
        await saveUserProfile(user);

        return { success: true, user };
    } catch (error) {
        console.error("[Auth] Popup sign-in error:", error.code, error.message);
        
        // If popup is blocked by browser, fall back to Redirect mode
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
            console.log("[Auth] Popup was blocked by browser. Falling back to Google Redirect Sign-In...");
            try {
                await signInWithRedirect(auth, googleProvider);
                return { success: false, redirecting: true, error: "Redirecting to Google Sign-In..." };
            } catch (redirectErr) {
                console.error("[Auth] Redirect sign-in error:", redirectErr);
                const redirectMsg = redirectErr.message ? redirectErr.message.replace('Firebase: ', '') : "Could not redirect to Google Sign-In.";
                return { success: false, error: redirectMsg, rawError: redirectErr };
            }
        }

        let userMessage = error.message ? error.message.replace('Firebase: ', '') : "Failed to sign in with Google. Please try again.";
        if (error.code === 'auth/popup-closed-by-user') {
            userMessage = "Sign-in popup was closed before completing.";
        } else if (error.code === 'auth/network-request-failed') {
            userMessage = "Network error. Please check your internet connection.";
        } else if (error.code === 'auth/invalid-api-key' || (error.message && error.message.includes('API key'))) {
            userMessage = "Invalid Firebase API key in firebase/firebase-config.js.";
        } else if (error.code === 'auth/operation-not-allowed') {
            userMessage = "Google Sign-In is not enabled in your Firebase Console. Go to Auth -> Sign-in method to enable it.";
        } else if (error.code === 'auth/unauthorized-domain') {
            userMessage = "Domain unauthorized! Go to Firebase Console -> Authentication -> Settings -> Authorized domains and add 'localhost' and '127.0.0.1'.";
        }

        return { success: false, error: userMessage, rawError: error };
    }
}

/**
 * Check for redirect sign-in results when returning from Google Auth page.
 */
export async function checkRedirectResult() {
    if (!isFirebaseConfigured()) return null;
    try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
            await saveUserProfile(result.user);
            return result.user;
        }
    } catch (error) {
        console.error("[Auth] Redirect result error:", error);
    }
    return null;
}

/**
 * Sign out current authenticated user.
 */
export async function logoutUser() {
    if (!isFirebaseConfigured()) return { success: true };
    try {
        await signOut(auth);
        console.log("[Auth] User signed out successfully.");
        return { success: true };
    } catch (error) {
        console.error("[Auth] Logout Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Initialize Auth State Listener for session persistence & auto-redirects.
 * 
 * @param {Function} callback - Called whenever auth state updates (user object or null)
 */
export function listenToAuthState(callback) {
    if (!isFirebaseConfigured()) {
        if (typeof callback === 'function') callback(null);
        return () => {};
    }

    // Automatically resolve pending redirect sign-in if returning from Google redirect
    checkRedirectResult().catch(err => {
        console.warn("[Auth] checkRedirectResult error during auth init:", err);
    });

    return onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                await saveUserProfile(user);
            } catch (err) {
                console.warn("[Auth] Failed to update user profile in Firestore:", err);
            }
        }
        if (typeof callback === 'function') {
            callback(user);
        }
    });
}
