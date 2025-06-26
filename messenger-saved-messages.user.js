// ==UserScript==
// @name         Messenger Saved Messages
// @namespace    https://messenger.com/
// @version      1.0
// @description  Save draft messages for specific messenger.com chat threads to send later
// @author       Fahad
// @match        https://www.messenger.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_listValues
// ==/UserScript==

(function() {
    'use strict';

    // Add custom styles
    GM_addStyle(`
        .saved-messages-container {
            position: fixed;
            right: 20px;
            bottom: 100px;
            width: 300px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            z-index: 9999;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            max-height: 400px;
            border: 1px solid #e4e6eb;
        }
        
        .saved-messages-header {
            padding: 12px;
            background-color: #0084ff;
            color: white;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        }
        
        .saved-messages-close {
            cursor: pointer;
            font-size: 18px;
        }
        
        .saved-messages-body {
            padding: 12px;
            overflow-y: auto;
            flex-grow: 1;
        }
        
        .saved-messages-item {
            margin-bottom: 10px;
            padding: 8px;
            background-color: #f0f2f5;
            border-radius: 8px;
            position: relative;
        }
        
        .saved-messages-timestamp {
            font-size: 10px;
            color: #65676B;
            margin-top: 4px;
        }
        
        .saved-messages-actions {
            display: flex;
            gap: 8px;
            margin-top: 5px;
        }
        
        .saved-messages-actions button {
            padding: 4px 8px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .saved-message-use {
            background-color: #0084ff;
            color: white;
        }
        
        .saved-message-delete {
            background-color: #f44336;
            color: white;
        }
        
        .saved-messages-input {
            padding: 12px;
            display: flex;
            gap: 8px;
            border-top: 1px solid #e4e6eb;
        }
        
        .saved-messages-input textarea {
            flex-grow: 1;
            border: 1px solid #e4e6eb;
            border-radius: 20px;
            padding: 8px 12px;
            resize: none;
        }
        
        .saved-messages-input button {
            background-color: #0084ff;
            color: white;
            border: none;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        }
        
        .saved-messages-toggle {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            background-color: #0084ff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            z-index: 9999;
        }
        
        .saved-messages-category {
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e4e6eb;
        }
        
        .saved-messages-category-title {
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        .hidden {
            display: none;
        }
        
        .keyboard-shortcut {
            display: inline-block;
            margin-left: 8px;
            padding: 2px 5px;
            background-color: #f0f2f5;
            border-radius: 4px;
            font-size: 10px;
            color: #65676B;
        }
        
        .saved-messages-menu {
            display: flex;
            justify-content: space-between;
            padding: 8px 12px;
            background-color: #f0f2f5;
            border-bottom: 1px solid #e4e6eb;
        }
        
        .saved-messages-menu button {
            border: none;
            background-color: transparent;
            color: #0084ff;
            cursor: pointer;
            font-size: 12px;
            padding: 4px 8px;
        }
        
        .saved-messages-menu button:hover {
            text-decoration: underline;
        }
        
        .file-input-hidden {
            display: none;
        }
    `);

    let isContainerVisible = false;
    let currentChatUrl = '';
    let dragOffset = { x: 0, y: 0 };
    let isDragging = false;
    let fileInput = null;

    // Function to get the current chat URL/ID
    function getCurrentChatId() {
        const url = window.location.href;
        const match = url.match(/\/t\/(\d+)/);
        return match ? match[1] : null;
    }

    // Function to create UI elements
    function createUI() {
        // Create toggle button
        const toggleButton = document.createElement('div');
        toggleButton.className = 'saved-messages-toggle';
        toggleButton.textContent = '📝';
        toggleButton.title = 'Saved Messages (Alt+M)';
        document.body.appendChild(toggleButton);

        // Create container
        const container = document.createElement('div');
        container.className = 'saved-messages-container hidden';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'saved-messages-header';
        header.textContent = 'Saved Messages';
        header.innerHTML += '<span class="keyboard-shortcut">Alt+M</span>';
        
        // Create close button
        const closeButton = document.createElement('span');
        closeButton.className = 'saved-messages-close';
        closeButton.textContent = '×';
        header.appendChild(closeButton);
        
        // Create menu
        const menu = document.createElement('div');
        menu.className = 'saved-messages-menu';
        
        const exportButton = document.createElement('button');
        exportButton.textContent = 'Export All';
        exportButton.onclick = exportSavedMessages;
        
        const importButton = document.createElement('button');
        importButton.textContent = 'Import';
        importButton.onclick = triggerImportDialog;
        
        menu.appendChild(exportButton);
        menu.appendChild(importButton);
        
        // Hidden file input for import
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.className = 'file-input-hidden';
        fileInput.onchange = importSavedMessages;
        document.body.appendChild(fileInput);
        
        // Create body
        const body = document.createElement('div');
        body.className = 'saved-messages-body';
        
        // Create input area
        const inputArea = document.createElement('div');
        inputArea.className = 'saved-messages-input';
        
        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Type a message to save... (Alt+S to save)';
        textarea.rows = 2;
        
        const saveButton = document.createElement('button');
        saveButton.textContent = '+';
        saveButton.title = 'Save Message (Alt+S)';
        
        inputArea.appendChild(textarea);
        inputArea.appendChild(saveButton);
        
        // Append all elements
        container.appendChild(header);
        container.appendChild(menu);
        container.appendChild(body);
        container.appendChild(inputArea);
        document.body.appendChild(container);
        
        // Add event listeners
        toggleButton.addEventListener('click', toggleContainer);
        closeButton.addEventListener('click', toggleContainer);
        saveButton.addEventListener('click', saveMessage);
        
        // Add keyboard shortcut for saving message
        textarea.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                saveMessage();
            }
        });
        
        // Add drag functionality
        header.addEventListener('mousedown', startDragging);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDragging);
        
        return {
            container,
            body,
            textarea,
            toggleButton
        };
    }

    // Create UI elements
    const ui = createUI();

    // Register global keyboard shortcut (Alt+M)
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'm') {
            e.preventDefault();
            toggleContainer();
        }
    });
    
    // Register in Tampermonkey menu
    GM_registerMenuCommand("Toggle Saved Messages", toggleContainer);
    GM_registerMenuCommand("Export All Saved Messages", exportSavedMessages);

    // Load saved messages when URL changes
    function checkUrlChange() {
        const chatId = getCurrentChatId();
        if (chatId && chatId !== currentChatUrl) {
            currentChatUrl = chatId;
            loadSavedMessages();
        }
    }

    // Function to toggle container visibility
    function toggleContainer() {
        isContainerVisible = !isContainerVisible;
        if (isContainerVisible) {
            ui.container.classList.remove('hidden');
            loadSavedMessages();
            // Focus the textarea when panel is opened
            setTimeout(() => ui.textarea.focus(), 100);
        } else {
            ui.container.classList.add('hidden');
        }
    }

    // Format timestamp
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        
        // If today, show time only
        if (date.toDateString() === now.toDateString()) {
            return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // If yesterday
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Otherwise show full date
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Functions for drag functionality
    function startDragging(e) {
        isDragging = true;
        const containerRect = ui.container.getBoundingClientRect();
        dragOffset.x = e.clientX - containerRect.left;
        dragOffset.y = e.clientY - containerRect.top;
        ui.container.style.cursor = 'grabbing';
    }

    function drag(e) {
        if (isDragging) {
            ui.container.style.left = (e.clientX - dragOffset.x) + 'px';
            ui.container.style.top = (e.clientY - dragOffset.y) + 'px';
            ui.container.style.right = 'auto';
            ui.container.style.bottom = 'auto';
        }
    }

    function stopDragging() {
        isDragging = false;
        ui.container.style.cursor = 'default';
    }

    // Function to save a message
    function saveMessage() {
        const messageText = ui.textarea.value.trim();
        if (!messageText) return;
        
        const chatId = getCurrentChatId();
        if (!chatId) {
            alert('Cannot save message: No chat detected');
            return;
        }
        
        const savedMessages = GM_getValue(chatId, []);
        savedMessages.push({
            text: messageText,
            timestamp: Date.now(),
            category: 'default' // Default category for organization
        });
        
        GM_setValue(chatId, savedMessages);
        ui.textarea.value = '';
        loadSavedMessages();
    }

    // Function to load saved messages for current chat
    function loadSavedMessages() {
        const chatId = getCurrentChatId();
        if (!chatId) {
            ui.body.innerHTML = '<p>Open a chat to see saved messages</p>';
            return;
        }
        
        const savedMessages = GM_getValue(chatId, []);
        
        if (savedMessages.length === 0) {
            ui.body.innerHTML = '<p>No saved messages for this chat</p>';
            return;
        }
        
        ui.body.innerHTML = '';
        
        // Group messages by category (for future enhancement)
        const messagesByCategory = {};
        savedMessages.forEach((message) => {
            const category = message.category || 'default';
            if (!messagesByCategory[category]) {
                messagesByCategory[category] = [];
            }
            messagesByCategory[category].push(message);
        });
        
        // Render each category
        Object.keys(messagesByCategory).forEach((category) => {
            const categoryMessages = messagesByCategory[category];
            
            // Sort messages by timestamp (newest first)
            categoryMessages.sort((a, b) => b.timestamp - a.timestamp);
            
            categoryMessages.forEach((message, index) => {
                const messageElement = document.createElement('div');
                messageElement.className = 'saved-messages-item';
                
                const messageText = document.createElement('div');
                messageText.textContent = message.text;
                
                const timestampDiv = document.createElement('div');
                timestampDiv.className = 'saved-messages-timestamp';
                timestampDiv.textContent = formatTimestamp(message.timestamp);
                
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'saved-messages-actions';
                
                const useButton = document.createElement('button');
                useButton.className = 'saved-message-use';
                useButton.textContent = 'Use';
                useButton.onclick = () => useMessage(message.text);
                
                const deleteButton = document.createElement('button');
                deleteButton.className = 'saved-message-delete';
                deleteButton.textContent = 'Delete';
                deleteButton.onclick = () => deleteMessage(savedMessages.indexOf(message));
                
                actionsDiv.appendChild(useButton);
                actionsDiv.appendChild(deleteButton);
                
                messageElement.appendChild(messageText);
                messageElement.appendChild(timestampDiv);
                messageElement.appendChild(actionsDiv);
                
                ui.body.appendChild(messageElement);
            });
        });
    }

    // Function to use a saved message
    function useMessage(text) {
        // Find the message input field
        const inputField = document.querySelector('[contenteditable="true"][role="textbox"]');
        
        if (inputField) {
            // Set text and dispatch input event to trigger messenger's update
            inputField.textContent = text;
            const event = new Event('input', { bubbles: true });
            inputField.dispatchEvent(event);
            
            // Focus the input field
            inputField.focus();
            
            // Hide the saved messages panel
            toggleContainer();
        }
    }

    // Function to delete a saved message
    function deleteMessage(index) {
        const chatId = getCurrentChatId();
        if (!chatId) return;
        
        const savedMessages = GM_getValue(chatId, []);
        savedMessages.splice(index, 1);
        GM_setValue(chatId, savedMessages);
        loadSavedMessages();
    }
    
    // Function to trigger the import dialog
    function triggerImportDialog() {
        fileInput.click();
    }
    
    // Function to import saved messages from a file
    function importSavedMessages(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validate the data structure
                if (typeof data !== 'object') {
                    throw new Error('Invalid data format');
                }
                
                // Import each chat's messages
                let importCount = 0;
                for (const chatId in data) {
                    if (Array.isArray(data[chatId])) {
                        GM_setValue(chatId, data[chatId]);
                        importCount += data[chatId].length;
                    }
                }
                
                alert(`Successfully imported ${importCount} saved messages for ${Object.keys(data).length} chats.`);
                
                // Refresh current view if needed
                const currentChatId = getCurrentChatId();
                if (currentChatId && data[currentChatId]) {
                    loadSavedMessages();
                }
            } catch (error) {
                alert('Error importing messages: ' + error.message);
            }
        };
        reader.readAsText(file);
        
        // Reset the file input
        event.target.value = '';
    }

    // Function to export all saved messages
    function exportSavedMessages() {
        const allData = {};
        
        // Use GM_listValues if available, otherwise provide warning
        if (typeof GM_listValues === 'function') {
            const savedKeys = GM_listValues();
            
            if (savedKeys.length === 0) {
                alert('No saved messages found');
                return;
            }
            
            // Collect all data
            savedKeys.forEach(key => {
                const messages = GM_getValue(key, []);
                if (messages.length > 0) {
                    allData[key] = messages;
                }
            });
            
            // Create download
            downloadJSON(allData, 'messenger_saved_messages.json');
        } else {
            // Current chat only if GM_listValues not available
            const chatId = getCurrentChatId();
            if (!chatId) {
                alert('Cannot export: No chat detected and GM_listValues not available');
                return;
            }
            
            const messages = GM_getValue(chatId, []);
            if (messages.length === 0) {
                alert('No saved messages found for current chat');
                return;
            }
            
            allData[chatId] = messages;
            
            // Create download with warning
            alert('Note: Your userscript manager does not support GM_listValues. Only the current chat messages will be exported.');
            downloadJSON(allData, 'messenger_saved_messages_partial.json');
        }
    }
    
    // Helper function to trigger download
    function downloadJSON(data, filename) {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute('href', dataStr);
        downloadAnchorNode.setAttribute('download', filename);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    // Initialize
    function init() {
        // Check for URL changes every second
        setInterval(checkUrlChange, 1000);
        
        // Initial URL check
        checkUrlChange();
    }

    // Start after page load
    window.addEventListener('load', init);
})(); 