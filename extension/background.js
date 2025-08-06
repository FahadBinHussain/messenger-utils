// background.js

let authToken = null;
const FILE_NAME = "glitchdraft_sync.txt";
let fileId = null;

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'sync') {
        console.log("Sync message received. Starting process.");
        getAuthToken()
            .then(findOrCreateFile)
            .then(updateFileContent)
            .then(() => {
                console.log("Sync process completed successfully.");
                sendResponse({ success: true, message: "Synced to Google Drive successfully!" });
            })
            .catch(error => {
                console.error("An error occurred during the sync process:", error);
                sendResponse({ success: false, message: "Sync failed: " + error.message });
            });
        return true; // Indicate async response
    }
    
    // Handle any future message types here if needed
    sendResponse({ success: true });
    return true;
});

function getAuthToken() {
    console.log("Step 1: Getting auth token using launchWebAuthFlow...");
    return new Promise((resolve, reject) => {
        const manifest = chrome.runtime.getManifest();
        const clientId = manifest.oauth2.client_id;
        const scopes = manifest.oauth2.scopes.join(' ');
        
        // This is a special URL that the browser knows how to intercept.
        const redirectUri = chrome.identity.getRedirectURL("oauth2");
        console.log("Using redirect URI:", redirectUri); // Important for debugging!

        let authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

        authUrl.searchParams.append('client_id', clientId);
        authUrl.searchParams.append('redirect_uri', redirectUri);
        authUrl.searchParams.append('response_type', 'token'); // 'token' for client-side flow
        authUrl.searchParams.append('scope', scopes);

        chrome.identity.launchWebAuthFlow({
            url: authUrl.href,
            interactive: true
        }, (responseUrl) => {
            if (chrome.runtime.lastError || !responseUrl) {
                console.error("launchWebAuthFlow failed:", chrome.runtime.lastError.message);
                reject(new Error("Could not get token. User may have cancelled the login flow."));
                return;
            }
            
            // The token is in the URL fragment.
            const url = new URL(responseUrl);
            const params = new URLSearchParams(url.hash.substring(1)); // remove the '#'
            const accessToken = params.get('access_token');

            if (accessToken) {
                console.log("Auth token received successfully.");
                authToken = accessToken;
                resolve(accessToken);
            } else {
                console.error("Could not extract token from response URL.");
                reject(new Error("Could not extract token from response."));
            }
        });
    });
}

function findOrCreateFile(token) {
    // This function remains the same as before
    console.log("Step 2: Finding or creating the file in Google Drive...");
    return new Promise((resolve, reject) => {
        fetch(`https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}'&spaces=drive`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(data => {
            if (data.files && data.files.length > 0) {
                fileId = data.files[0].id;
                console.log(`File found with ID: ${fileId}`);
                resolve(token);
            } else {
                console.log("File not found. Creating a new one...");
                const metadata = { name: FILE_NAME, mimeType: 'text/plain' };
                fetch('https://www.googleapis.com/drive/v3/files', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(metadata)
                })
                .then(response => response.json())
                .then(newFile => {
                    fileId = newFile.id;
                    console.log(`New file created with ID: ${fileId}`);
                    resolve(token);
                });
            }
        }).catch(reject);
    });
}

function updateFileContent(token) {
    // This function also remains the same
    console.log("Step 3: Updating file content...");
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['drafts'], (result) => {
            const drafts = result.drafts || {};
            const text = JSON.stringify(drafts, null, 2);
            const multipartRequestBody = `--boundary\nContent-Type: application/json; charset=UTF-8\n\n{\n  "mimeType": "text/plain"\n}\n\n--boundary\nContent-Type: text/plain\n\n${text}\n--boundary--`;
            fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/related; boundary=boundary'
                },
                body: multipartRequestBody
            })
            .then(response => response.json())
            .then(data => {
                console.log('File synced successfully:', data);
                resolve(data);
            }).catch(reject);
        });
    });
} 