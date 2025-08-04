// background.js

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle any future message types here if needed
    sendResponse({ success: true });
}); 