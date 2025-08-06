// driveService.js - Google Drive API Service for GlitchDraft Extension

class DriveService {
    constructor() {
        this.appFolderName = "GlitchDraft";
        this.appFolderId = null;
        this.authToken = null;
    }

    // Authentication Function
    async getAuthToken(interactive = false) {
        try {
            console.log("Getting auth token, interactive:", interactive);
            
            // Use OAuth2 flow for Microsoft Edge compatibility
            const manifest = chrome.runtime.getManifest();
            const clientId = manifest.oauth2.client_id;
            const scopes = manifest.oauth2.scopes.join(' ');
            
            // This is a special URL that the browser knows how to intercept.
            const redirectUri = chrome.identity.getRedirectURL("oauth2");
            console.log("Using redirect URI:", redirectUri);

            let authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

            authUrl.searchParams.append('client_id', clientId);
            authUrl.searchParams.append('redirect_uri', redirectUri);
            authUrl.searchParams.append('response_type', 'token'); // 'token' for client-side flow
            authUrl.searchParams.append('scope', scopes);
            authUrl.searchParams.append('prompt', interactive ? 'consent' : 'none');

            const token = await new Promise((resolve, reject) => {
                const options = {
                    url: authUrl.href,
                    interactive: interactive
                };
                
                // Add Edge-specific options
                if (!interactive) {
                    options.abortOnLoadForNonInteractive = true;
                    options.timeoutMsForNonInteractive = 30000;
                }

                chrome.identity.launchWebAuthFlow(options, (responseUrl) => {
                    if (chrome.runtime.lastError) {
                        console.error("launchWebAuthFlow failed:", chrome.runtime.lastError.message);
                        reject(new Error(`Authentication failed: ${chrome.runtime.lastError.message}`));
                        return;
                    }
                    
                    if (!responseUrl) {
                        reject(new Error("Could not get token. User may have cancelled the login flow."));
                        return;
                    }
                    
                    // The token is in the URL fragment.
                    const url = new URL(responseUrl);
                    const params = new URLSearchParams(url.hash.substring(1)); // remove the '#'
                    const accessToken = params.get('access_token');

                    if (accessToken) {
                        console.log("Auth token received successfully.");
                        resolve(accessToken);
                    } else {
                        console.error("Could not extract token from response URL.");
                        reject(new Error("Could not extract token from response."));
                    }
                });
            });
            
            if (token) {
                this.authToken = token;
                console.log("Auth token obtained successfully");
                return token;
            } else {
                throw new Error("Failed to get auth token");
            }
        } catch (error) {
            console.error("Authentication error:", error);
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    // App Folder Management
    async getAppFolderId() {
        console.log("Getting app folder ID...");
        
        // Ensure we have auth token first
        if (!this.authToken) {
            console.log("No auth token, getting one...");
            await this.getAuthToken(true);
        }

        // Check if we have cached folder ID
        const cached = await chrome.storage.local.get(['appFolderId']);
        if (cached.appFolderId) {
            console.log("Found cached folder ID:", cached.appFolderId);
            this.appFolderId = cached.appFolderId;
            
            // Verify the folder still exists
            try {
                console.log("Verifying cached folder exists...");
                const response = await fetch(`https://www.googleapis.com/drive/v3/files/${this.appFolderId}`, {
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`
                    }
                });
                
                if (response.ok) {
                    console.log("Found existing app folder:", this.appFolderId);
                    return this.appFolderId;
                } else {
                    // Folder doesn't exist, clear cache and create new one
                    console.log("Cached folder not found (status:", response.status, "), creating new one...");
                    await chrome.storage.local.remove(['appFolderId']);
                    this.appFolderId = null;
                }
            } catch (error) {
                console.error("Error verifying folder:", error);
                // Clear cache and create new folder
                await chrome.storage.local.remove(['appFolderId']);
                this.appFolderId = null;
            }
        } else {
            console.log("No cached folder ID found");
        }

        try {
            console.log("Searching for existing folder...");
            // Search for existing folder
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${this.appFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            
            const response = await fetch(searchUrl, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();
            console.log("Search results:", data.files ? data.files.length : 0, "folders found");
            
            if (data.files && data.files.length > 0) {
                this.appFolderId = data.files[0].id;
                console.log("Found existing app folder:", this.appFolderId);
            } else {
                // Create new folder
                console.log("No existing folder found, creating new one...");
                this.appFolderId = await this.createAppFolder();
            }

            // Cache the folder ID
            console.log("Caching folder ID:", this.appFolderId);
            await chrome.storage.local.set({ appFolderId: this.appFolderId });
            return this.appFolderId;

        } catch (error) {
            console.error("Error getting app folder:", error);
            throw error;
        }
    }

    async createAppFolder() {
        try {
            const folderMetadata = {
                name: this.appFolderName,
                mimeType: 'application/vnd.google-apps.folder'
            };

            const response = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(folderMetadata)
            });

            if (!response.ok) {
                throw new Error(`Folder creation failed: ${response.status}`);
            }

            const folder = await response.json();
            console.log("Created new app folder:", folder.id);
            return folder.id;

        } catch (error) {
            console.error("Error creating app folder:", error);
            throw error;
        }
    }

    // Draft Upload Function
    async uploadDraft({ textContent, imageFile }) {
        try {
            const folderId = await this.getAppFolderId();
            const timestamp = Date.now();
            const imageFileId = imageFile ? await this.uploadImageFile(imageFile, folderId) : null;

            // Create metadata JSON
            const metadata = {
                text: textContent,
                imageId: imageFileId,
                modifiedTime: new Date().toISOString(),
                timestamp: timestamp
            };

            // Upload metadata as JSON file
            const jsonFileName = `draft-${timestamp}.json`;
            const jsonFileId = await this.uploadJsonFile(metadata, jsonFileName, folderId);

            console.log("Draft uploaded successfully:", { jsonFileId, imageFileId });
            return { jsonFileId, imageFileId };

        } catch (error) {
            console.error("Error uploading draft:", error);
            throw error;
        }
    }

    async uploadImageFile(imageFile, folderId) {
        try {
            const fileName = `image-${Date.now()}.${imageFile.name.split('.').pop()}`;
            
            const metadata = {
                name: fileName,
                parents: [folderId]
            };

            const multipartBody = this.createMultipartBody(metadata, imageFile);

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'multipart/related; boundary=boundary'
                },
                body: multipartBody
            });

            if (!response.ok) {
                throw new Error(`Image upload failed: ${response.status}`);
            }

            const file = await response.json();
            console.log("Image uploaded:", file.id);
            return file.id;

        } catch (error) {
            console.error("Error uploading image:", error);
            throw error;
        }
    }

    async uploadJsonFile(metadata, fileName, folderId) {
        try {
            const fileContent = JSON.stringify(metadata, null, 2);
            const blob = new Blob([fileContent], { type: 'application/json' });

            const metadataObj = {
                name: fileName,
                parents: [folderId],
                mimeType: 'application/json'
            };

            const multipartBody = this.createMultipartBody(metadataObj, blob);

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'multipart/related; boundary=boundary'
                },
                body: multipartBody
            });

            if (!response.ok) {
                throw new Error(`JSON upload failed: ${response.status}`);
            }

            const file = await response.json();
            console.log("JSON file uploaded:", file.id);
            return file.id;

        } catch (error) {
            console.error("Error uploading JSON:", error);
            throw error;
        }
    }

    createMultipartBody(metadata, file) {
        const boundary = 'boundary';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelim = `\r\n--${boundary}--`;

        const metadataPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
        const filePart = `Content-Type: ${file.type}\r\n\r\n`;

        return delimiter + metadataPart + delimiter + filePart + file + closeDelim;
    }

    // Draft Fetching Functions
    async listRemoteDrafts() {
        try {
            const folderId = await this.getAppFolderId();
            
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and name contains 'draft-' and mimeType='application/json' and trashed=false&orderBy=modifiedTime desc`;
            
            const response = await fetch(searchUrl, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                // If we get a 404, the folder might not exist
                if (response.status === 404) {
                    console.log('Folder not found (404), forcing recreation...');
                    throw new Error('Folder not found');
                }
                throw new Error(`List failed: ${response.status}`);
            }

            const data = await response.json();
            console.log("Remote drafts listed:", data.files.length);
            return data.files;

        } catch (error) {
            console.error("Error listing remote drafts:", error);
            throw error;
        }
    }

    async downloadDraft(fileId) {
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status}`);
            }

            const text = await response.text();
            const metadata = JSON.parse(text);
            console.log("Draft downloaded:", fileId);
            return metadata;

        } catch (error) {
            console.error("Error downloading draft:", error);
            throw error;
        }
    }

    async getImageBlob(fileId) {
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Image download failed: ${response.status}`);
            }

            const blob = await response.blob();
            console.log("Image blob downloaded:", fileId);
            return blob;

        } catch (error) {
            console.error("Error downloading image:", error);
            throw error;
        }
    }

    // Delete Draft Function
    async deleteDraft(jsonFileId, imageFileId = null) {
        try {
            // Delete JSON file
            await this.deleteFile(jsonFileId);
            
            // Delete associated image if exists
            if (imageFileId) {
                await this.deleteFile(imageFileId);
            }

            console.log("Draft deleted successfully");
        } catch (error) {
            console.error("Error deleting draft:", error);
            throw error;
        }
    }

    async deleteFile(fileId) {
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Delete failed: ${response.status}`);
            }

            console.log("File deleted:", fileId);
        } catch (error) {
            console.error("Error deleting file:", error);
            throw error;
        }
    }

    // Check if user is authenticated
    async isAuthenticated() {
        try {
            // For Microsoft Edge, we need to use interactive authentication
            // Non-interactive auth doesn't work reliably in Edge
            if (this.authToken) {
                return true;
            }
            
            // Don't trigger authentication here, just return false
            // Authentication should be triggered explicitly when needed
            return false;
        } catch (error) {
            // If authentication fails, user needs to authenticate
            return false;
        }
    }

    // Force authentication (for when user explicitly requests it)
    async forceAuthentication() {
        try {
            await this.getAuthToken(true);
            return true;
        } catch (error) {
            console.error('Force authentication failed:', error);
            return false;
        }
    }

    // Clear cached folder ID and force recreation
    async clearCachedFolder() {
        try {
            await chrome.storage.local.remove(['appFolderId']);
            this.appFolderId = null;
            console.log('Cleared cached folder ID');
        } catch (error) {
            console.error('Error clearing cached folder:', error);
        }
    }

    // Force folder recreation (for testing)
    async forceFolderRecreation() {
        try {
            console.log('Forcing folder recreation...');
            await this.clearCachedFolder();
            const newFolderId = await this.getAppFolderId();
            console.log('New folder created with ID:', newFolderId);
            return newFolderId;
        } catch (error) {
            console.error('Error forcing folder recreation:', error);
            throw error;
        }
    }
}

// Export the service instance
export const driveService = new DriveService(); 