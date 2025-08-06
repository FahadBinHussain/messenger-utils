document.addEventListener('DOMContentLoaded', () => {
    const syncButton = document.getElementById('syncButton');
    const statusDiv = document.getElementById('status');

    // Send a message to the background script to start the sync
    syncButton.addEventListener('click', () => {
        syncButton.disabled = true;
        syncButton.textContent = 'Syncing...';
        statusDiv.textContent = 'Starting sync process...';
        statusDiv.className = 'status';

        chrome.runtime.sendMessage({ action: 'sync' }, (response) => {
            syncButton.disabled = false;
            syncButton.textContent = 'Sync to Google Drive';
            
            if (response && response.success) {
                statusDiv.textContent = response.message || 'Synced successfully!';
                statusDiv.className = 'status success';
            } else {
                statusDiv.textContent = response ? response.message : 'Sync failed. Please try again.';
                statusDiv.className = 'status error';
            }
            
            // Clear status after 5 seconds
            setTimeout(() => {
                statusDiv.textContent = '';
                statusDiv.className = 'status';
            }, 5000);
        });
    });
}); 