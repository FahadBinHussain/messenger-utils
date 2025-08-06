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

        // Ensure folder exists by calling getAppFolderId first
        console.log('Ensuring app folder exists...');
        await driveService.getAppFolderId();

        // Force folder recreation to ensure it exists
        console.log('Forcing folder recreation to ensure it exists...');
        await driveService.forceFolderRecreation();

        // Get remote drafts
        console.log('Listing remote drafts...');
        let remoteDrafts = [];
        try {
            remoteDrafts = await driveService.listRemoteDrafts();
        } catch (error) {
            console.log('Failed to list remote drafts:', error);
            // If listing fails, just continue with empty drafts
            remoteDrafts = [];
        }
        
        // Get local drafts
        const localData = await chrome.storage.local.get(['drafts']);
        const localDrafts = localData.drafts || {};

        // Compare and sync
        await syncDrafts(remoteDrafts, localDrafts);

        console.log('Sync completed successfully');
        
        // Update last sync time
        await chrome.storage.local.set({ lastSyncTime: Date.now() });

    } catch (error) {
        console.error('Sync failed:', error);
        throw error; // Re-throw to let caller handle it
    } finally {
        syncInProgress = false;
    }
}

// Sync drafts between local and remote
async function syncDrafts(remoteDrafts, localDrafts) {
    const remoteDraftIds = new Set(remoteDrafts.map(draft => draft.id));
    const localDraftIds = new Set(Object.keys(localDrafts));

    // Download new remote drafts
    for (const remoteDraft of remoteDrafts) {
        if (!localDrafts[remoteDraft.id]) {
            try {
                const draftData = await driveService.downloadDraft(remoteDraft.id);
                
                // Download associated image if exists
                let imageBlob = null;
                if (draftData.imageId) {
                    imageBlob = await driveService.getImageBlob(draftData.imageId);
                }

                // Save to local storage
                localDrafts[remoteDraft.id] = {
                    text: draftData.text,
                    imageBlob: imageBlob,
                    imageId: draftData.imageId,
                    modifiedTime: draftData.modifiedTime,
                    timestamp: draftData.timestamp
                };

                console.log('Downloaded remote draft:', remoteDraft.id);
            } catch (error) {
                console.error('Failed to download draft:', remoteDraft.id, error);
            }
        }
    }

    // Upload new local drafts
    for (const [localId, localDraft] of Object.entries(localDrafts)) {
        if (!remoteDraftIds.has(localId)) {
            try {
                // Check if this draft has been uploaded before
                if (!localDraft.remoteFileId) {
                    const uploadResult = await driveService.uploadDraft({
                        textContent: localDraft.text,
                        imageFile: localDraft.imageBlob ? new File([localDraft.imageBlob], 'image.jpg') : null
                    });

                    // Update local draft with remote file IDs
                    localDrafts[localId].remoteFileId = uploadResult.jsonFileId;
                    localDrafts[localId].remoteImageId = uploadResult.imageFileId;

                    console.log('Uploaded local draft:', localId);
                }
            } catch (error) {
                console.error('Failed to upload draft:', localId, error);
            }
        }
    }

    // Save updated local drafts
    await chrome.storage.local.set({ drafts: localDrafts });
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

        default:
            sendResponse({ success: true });
            return true;
    }
});

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