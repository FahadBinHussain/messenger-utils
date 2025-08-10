document.addEventListener('DOMContentLoaded', () => {
    const authButton = document.getElementById('authButton');
    const syncButton = document.getElementById('syncButton');
    const statusDiv = document.getElementById('status');
    const syncInfoDiv = document.getElementById('syncInfo');
    const authSection = document.getElementById('authSection');
    const syncSection = document.getElementById('syncSection');

    // Check initial sync status
    checkSyncStatus();

    // Handle authentication
    authButton.addEventListener('click', async () => {
        authButton.disabled = true;
        authButton.textContent = 'Signing in...';
        statusDiv.textContent = 'Opening Google authentication...';
        statusDiv.className = 'status';

        try {
            // Check current status first
            const statusResponse = await sendMessage({ action: 'getSyncStatus' });

            if (statusResponse && statusResponse.success && statusResponse.authenticated) {
                statusDiv.textContent = 'Already authenticated!';
                statusDiv.className = 'status success';
                checkSyncStatus();
                return;
            }

            // Trigger authentication by requesting a sync
            const response = await sendMessage({ action: 'sync' });

            if (response && response.success) {
                statusDiv.textContent = 'Authentication successful!';
                statusDiv.className = 'status success';
                checkSyncStatus();
            } else {
                statusDiv.textContent = response ? response.message : 'Authentication failed. Please try again.';
                statusDiv.className = 'status error';
            }
        } catch (error) {
            statusDiv.textContent = 'Authentication failed: ' + error.message;
            statusDiv.className = 'status error';
        } finally {
            authButton.disabled = false;
            authButton.textContent = 'Sign in with Google';
        }
    });

    // Handle manual sync
    syncButton.addEventListener('click', async () => {
        syncButton.disabled = true;
        syncButton.textContent = 'Syncing...';
        statusDiv.textContent = 'Starting sync process...';
        statusDiv.className = 'status';

        try {
            const response = await sendMessage({ action: 'sync' });

            if (response && response.success) {
                statusDiv.textContent = response.message || 'Synced successfully!';
                statusDiv.className = 'status success';
                updateSyncInfo();
            } else {
                statusDiv.textContent = response ? response.message : 'Sync failed. Please try again.';
                statusDiv.className = 'status error';
            }
        } catch (error) {
            statusDiv.textContent = 'Sync failed: ' + error.message;
            statusDiv.className = 'status error';
        } finally {
            syncButton.disabled = false;
            syncButton.textContent = 'Sync Now';
        }
    });

    // Check sync status and update UI
    async function checkSyncStatus() {
        try {
            const response = await sendMessage({ action: 'getSyncStatus' });

            if (response && response.success) {
                if (response.authenticated) {
                    authSection.style.display = 'none';
                    syncSection.style.display = 'block';
                    updateSyncInfo(response);
                } else {
                    authSection.style.display = 'block';
                    syncSection.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Failed to check sync status:', error);
        }
    }

    // Update sync information display
    function updateSyncInfo(statusData = null) {
        if (!statusData) {
            // Get status from background
            sendMessage({ action: 'getSyncStatus' }).then(response => {
                if (response && response.success) {
                    updateSyncInfo(response);
                }
            });
            return;
        }

        let infoText = '';

        if (statusData.lastSyncTime) {
            const lastSync = new Date(statusData.lastSyncTime);
            const timeAgo = getTimeAgo(lastSync);
            infoText = `Last sync: ${timeAgo}`;
        } else {
            infoText = 'No sync history';
        }

        if (statusData.syncInProgress) {
            infoText += ' (Sync in progress...)';
        }

        // Add debug information
        infoText += '\n\n--- DEBUG INFO ---';
        infoText += `\nLocal sync time: ${statusData.localLastSyncTime || 'null'}`;
        infoText += `\nRemote sync time: ${statusData.remoteLastSyncTime || 'null'}`;

        if (statusData.localLastSyncTime && statusData.remoteLastSyncTime) {
            const match = statusData.localLastSyncTime === statusData.remoteLastSyncTime;
            infoText += `\nTimes match: ${match}`;
        }

        syncInfoDiv.textContent = infoText;
        syncInfoDiv.style.whiteSpace = 'pre-line'; // Allow line breaks
    }

    // Helper function to get time ago
    function getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    }

    // Helper function to send messages to background script
    function sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }
});
