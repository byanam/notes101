// app.js - Notes App Auth Integration, Firestore Sync & Session Management

import { logoutUser, listenToAuthState } from './firebase/auth.js';
import { saveUserNotes, loadUserNotes } from './firebase/firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    const userAvatar = document.getElementById('user-profile-avatar');
    const userName = document.getElementById('user-profile-name');
    const userEmail = document.getElementById('user-profile-email');
    const logoutBtn = document.getElementById('logoutBtn');
    const syncStatus = document.getElementById('cloud-sync-status');

    const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true' || sessionStorage.getItem('demoMode') === 'true';

    let currentUser = null;
    let saveDebounceTimer = null;
    let isInitialCloudLoad = true;

    function updateSyncStatus(text, type = 'success') {
        if (!syncStatus) return;
        if (isDemoMode) {
            syncStatus.style.color = '#ded7ce';
            syncStatus.innerHTML = `<i class="fa-solid fa-flask"></i> Demo (Not Saved)`;
            return;
        }
        if (type === 'loading') {
            syncStatus.style.color = '#e6a23c';
            syncStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${text}`;
        } else if (type === 'error') {
            syncStatus.style.color = '#ff4d4f';
            syncStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${text}`;
        } else {
            syncStatus.style.color = '#4caf50';
            syncStatus.innerHTML = `<i class="fa-solid fa-cloud-check"></i> ${text}`;
        }
    }

    if (isDemoMode) {
        console.log("[App] Running in Demo Mode (Guest, No Account, No Saving)");
        if (userName) userName.textContent = 'Demo Mode';
        if (userEmail) userEmail.textContent = 'No Account (Unsaved)';
        updateSyncStatus('Demo (Not Saved)', 'demo');
        if (logoutBtn) {
            logoutBtn.innerHTML = `<i class="fa-solid fa-arrow-left"></i> Exit Demo`;
            logoutBtn.title = 'Exit Demo Mode';
        }
    }

    // Listen to Firebase Auth state for active session & per-user cloud sync
    listenToAuthState(async (user) => {
        if (isDemoMode) {
            // In demo mode, do not connect or load real account
            return;
        }

        if (!user) {
            console.log("[App] No active session found. Redirecting to landing page...");
            if (typeof window.clearNotesData === 'function') {
                window.clearNotesData();
            }
            const path = window.location.pathname;
            if (path !== '/' && path !== '' && !path.endsWith('/index.html') && !path.endsWith('/')) {
                window.location.href = 'index.html';
            }
            return;
        }

        currentUser = user;
        console.log("[App] User authenticated:", user.displayName || user.email, "| UID:", user.uid);

        // Update User Profile UI elements
        if (userName) {
            userName.textContent = user.displayName || 'Notes User';
        }
        if (userEmail) {
            userEmail.textContent = user.email || 'Google Account';
        }
        const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23888888'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
        if (userAvatar) {
            if (user.photoURL) {
                userAvatar.src = user.photoURL;
            } else {
                userAvatar.src = DEFAULT_AVATAR;
            }
            userAvatar.onerror = () => {
                userAvatar.src = DEFAULT_AVATAR;
            };
        }

        // --- Clear workspace from any previous session before loading target user ---
        if (typeof window.clearNotesData === 'function') {
            window.clearNotesData();
        }

        // --- Load User-Specific Notes from Firestore ---
        isInitialCloudLoad = true;
        updateSyncStatus('Syncing Cloud...', 'loading');

        try {
            const cloudNotes = await loadUserNotes(user.uid);
            if (cloudNotes && cloudNotes.books && cloudNotes.books.length > 0) {
                console.log("[App] Loading cloud notes for user UID:", user.uid, cloudNotes);
                if (typeof window.deserializeNotesData === 'function') {
                    window.deserializeNotesData(cloudNotes, user.uid);
                }
                updateSyncStatus('Saved to Cloud ✓', 'success');
            } else {
                console.log("[App] No existing cloud notes found. Initializing new notes for user UID:", user.uid);
                if (typeof window.initializeFreshUserNotes === 'function') {
                    const freshData = window.initializeFreshUserNotes();
                    await saveUserNotes(user.uid, freshData);
                }
                updateSyncStatus('Saved to Cloud ✓', 'success');
            }
        } catch (err) {
            console.error("[App] Failed to sync cloud notes on load:", err);
            updateSyncStatus('Cloud Sync Warning', 'error');
        } finally {
            isInitialCloudLoad = false;
        }
    });

    // --- Debounced Auto-Save Listener to Firestore ---
    window.onNotesStateChanged = (data) => {
        if (!currentUser || isInitialCloudLoad) return;

        updateSyncStatus('Saving...', 'loading');

        if (saveDebounceTimer) clearTimeout(saveDebounceTimer);

        saveDebounceTimer = setTimeout(async () => {
            console.log("[App] Syncing updated notes to Firestore for UID:", currentUser.uid);
            const res = await saveUserNotes(currentUser.uid, data);
            if (res && res.success) {
                updateSyncStatus('Saved to Cloud ✓', 'success');
                if (typeof window.deserializeNotesData === 'function') {
                    // Update user-scoped local storage cache defensively
                    try {
                        localStorage.setItem('aiNoteData_' + currentUser.uid, JSON.stringify(data));
                    } catch (cacheErr) {
                        console.warn('[App] Local cache quota exceeded for user notes:', cacheErr);
                    }
                }
            } else {
                const errMsg = typeof res?.error === 'string' ? res.error : 'Permission Denied';
                updateSyncStatus('Save failed (' + errMsg + ')', 'error');
            }
        }, 500);
    };

    // --- Handle Logout Action ---
    async function handleLogout(e) {
        if (e) e.preventDefault();
        
        if (isDemoMode) {
            sessionStorage.removeItem('demoMode');
            if (typeof window.clearNotesData === 'function') {
                window.clearNotesData();
            }
            window.location.href = 'index.html';
            return;
        }

        if (logoutBtn) {
            logoutBtn.disabled = true;
            logoutBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving & Logging out...`;
        }

        updateSyncStatus('Saving before logout...', 'loading');

        // Force immediate synchronous cloud save for CURRENT user before clearing state and logging out!
        if (currentUser && typeof window.serializeNotesData === 'function') {
            try {
                const finalData = window.serializeNotesData(currentUser.uid);
                if (finalData) {
                    await saveUserNotes(currentUser.uid, finalData);
                    console.log("[App] Final save completed before logout for UID:", currentUser.uid);
                }
            } catch (saveErr) {
                console.error("[App] Final save error before logout:", saveErr);
            }
        }

        // Clear local workspace before signing out so next user gets clean isolation
        if (typeof window.clearNotesData === 'function') {
            window.clearNotesData();
        }

        const result = await logoutUser();
        if (result.success) {
            console.log("[App] Logged out. Redirecting to clean homepage...");
            sessionStorage.setItem('justLoggedOut', 'true');
            window.location.href = 'index.html?logout=true';
        } else {
            alert("Logout failed: " + result.error);
            if (logoutBtn) {
                logoutBtn.disabled = false;
                logoutBtn.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Logout`;
            }
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});
