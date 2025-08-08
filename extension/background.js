// background.js - GlitchDraft Extension Background Service Worker

// Import driveService
import { driveService } from './driveService.js';

let syncInProgress = false;

// Initialize sync alarm on extension startup
chrome.runtime.onStartup.addListener(() => {
    setupSyncAlarm();
});

chrome.runtime.onInstalled.addListener(() => {
    setupSyncAlarm();
});

// Setup sync alarm
function setupSyncAlarm() {
    chrome.alarms.create('driveSync', {
        delayInMinutes: 1, // First sync after 1 minute
        periodInMinutes: 15 // Then every 15 minutes
    });
    console.log('Sync alarm created');
}

// Listen for alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'driveSync') {
        console.log('Sync alarm triggered');
        syncNow();
    }
});

// Core sync function
async function syncNow() {
    if (syncInProgress) {
        console.log('Sync already in progress, skipping');
        return;
    }

    syncInProgress = true;
    console.log('Starting sync process...');

    try {
        // Check if user is authenticated
        const isAuth = await driveService.isAuthenticated();
        if (!isAuth) {
            console.log('User not authenticated, skipping sync');
            return;
        }

        // Ensure folder exists
        console.log('Ensuring app folder exists...');
        await driveService.getAppFolderId();

        // Get local data
        const localData = await chrome.storage.local.get(null);
        
        // Get remote data
        const remoteData = await driveService.downloadLatestSync();

        if (remoteData) {
            // Compare timestamps and use the newer version
            const localTime = localData.lastSyncTime || 0;
            const remoteTime = remoteData.lastSyncTime || 0;

            if (remoteTime > localTime) {
                // Remote is newer, update local
                await chrome.storage.local.set(remoteData);
                console.log('Updated local data from remote');
            } else {
                // Local is newer or same, update remote
                await driveService.uploadSync(localData);
                console.log('Updated remote data from local');
            }
        } else {
            // No remote data exists, upload local
            await driveService.uploadSync(localData);
            console.log('Uploaded initial sync data');
        }

        // Update last sync time
        await chrome.storage.local.set({ lastSyncTime: Date.now() });
        console.log('Sync completed successfully');

    } catch (error) {
        console.error('Sync failed:', error);
        throw error;
    } finally {
        syncInProgress = false;
    }
}

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request.action);

    switch (request.action) {
        case 'sync':
            handleManualSync(sendResponse);
            return true; // Indicate async response

        case 'uploadDraft':
            handleUploadDraft(request.data, sendResponse);
            return true;

        case 'deleteDraft':
            handleDeleteDraft(request.draftId, sendResponse);
            return true;

        case 'getSyncStatus':
            handleGetSyncStatus(sendResponse);
            return true;

        case 'toggleUI':
            handleToggleUI(sender.tab.id, sendResponse);
            return true;

        default:
            sendResponse({ success: true });
            return true;
    }
});

// Handle browser action click
chrome.action.onClicked.addListener((tab) => {
    // Only toggle UI on messenger.com or facebook.com/messages
    if (tab.url.includes('messenger.com') || 
        (tab.url.includes('facebook.com') && tab.url.includes('/messages/'))) {
        handleToggleUI(tab.id);
    }
});

// Function to toggle UI visibility
async function handleToggleUI(tabId, sendResponse = null) {
    try {
        await chrome.tabs.sendMessage(tabId, { action: 'toggleUI' });
        if (sendResponse) sendResponse({ success: true });
    } catch (error) {
        console.error('Error toggling UI:', error);
        if (sendResponse) sendResponse({ success: false, message: error.message });
    }
}

// Handle manual sync request
async function handleManualSync(sendResponse) {
    try {
        console.log('Starting manual sync...');
        
        // Check if user is authenticated first
        const isAuth = await driveService.isAuthenticated();
        if (!isAuth) {
            console.log('User not authenticated, starting authentication...');
            // This will trigger the interactive authentication flow
            const authSuccess = await driveService.forceAuthentication();
            if (!authSuccess) {
                sendResponse({ success: false, message: 'Authentication failed. Please try again.' });
                return;
            }
        }
        
        await syncNow();
        sendResponse({ success: true, message: 'Sync completed successfully' });
    } catch (error) {
        console.error('Manual sync failed:', error);
        sendResponse({ success: false, message: error.message });
    }
}

// Handle draft upload request
async function handleUploadDraft(draftData, sendResponse) {
    try {
        const result = await driveService.uploadDraft(draftData);
        sendResponse({ success: true, fileIds: result });
    } catch (error) {
        console.error('Upload failed:', error);
        sendResponse({ success: false, message: error.message });
    }
}

// Handle draft deletion request
async function handleDeleteDraft(draftId, sendResponse) {
    try {
        const localData = await chrome.storage.local.get(['drafts']);
        const localDrafts = localData.drafts || {};
        const draft = localDrafts[draftId];

        if (draft && draft.remoteFileId) {
            await driveService.deleteDraft(draft.remoteFileId, draft.remoteImageId);
        }

        // Remove from local storage
        delete localDrafts[draftId];
        await chrome.storage.local.set({ drafts: localDrafts });

        sendResponse({ success: true });
    } catch (error) {
        console.error('Delete failed:', error);
        sendResponse({ success: false, message: error.message });
    }
}

// Handle sync status request
async function handleGetSyncStatus(sendResponse) {
    try {
        const isAuth = await driveService.isAuthenticated();
        const lastSync = await chrome.storage.local.get(['lastSyncTime']);
        
        sendResponse({
            success: true,
            authenticated: isAuth,
            lastSyncTime: lastSync.lastSyncTime || null,
            syncInProgress: syncInProgress
        });
    } catch (error) {
        console.error('Status check failed:', error);
        sendResponse({ success: false, message: error.message });
    }
}