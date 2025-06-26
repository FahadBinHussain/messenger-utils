# Messenger Saved Messages Userscript

A userscript that allows you to save draft messages for specific Facebook Messenger chat threads and send them later. This works like a personal note system that's contextual to each chat conversation.

## Features

- Save different messages for different chat threads (based on URL)
- Messages are saved per chat thread (identified by URL)
- Easily access and use saved messages with a single click
- Draggable interface that stays out of the way
- Works with end-to-end encrypted chats
- Keyboard shortcuts for faster workflow
- Timestamps to track when messages were saved
- Messages sorted with newest first
- Import/export functionality for backup and transfer between browsers

## Installation

1. Install a userscript manager extension for your browser:
   - [Tampermonkey](https://www.tampermonkey.net/) (recommended)
   - [Violentmonkey](https://violentmonkey.github.io/)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox only)

2. Install the userscript:
   - Click on the userscript manager icon in your browser
   - Select "Create a new script" or "Add new script"
   - Copy and paste the entire content of the `messenger-saved-messages.user.js` file
   - Save the script

## How to Use

1. Navigate to any Messenger conversation on messenger.com
2. Click the 📝 (notepad) button that appears in the bottom right corner of the page (or press `Alt+M`)
3. Type your message in the text box and click the "+" button (or press `Alt+S`) to save it
4. Your message will be saved specifically for this chat thread
5. When you want to use a saved message:
   - Click the 📝 button to open the saved messages panel
   - Click "Use" next to the message you want to use
   - The message will be inserted into the chat input field and the panel will close
6. To delete a saved message, click "Delete" next to the message

## Keyboard Shortcuts

- `Alt+M`: Toggle the saved messages panel
- `Alt+S`: Save the current message (when textarea is focused)

## Import/Export Functionality

You can back up and transfer your saved messages between different browsers or computers:

- **Export**: Click the "Export All" button in the saved messages panel to download a JSON file containing all your saved messages
- **Import**: Click the "Import" button and select a previously exported JSON file to restore your saved messages

Note: The import function will merge the imported messages with any existing messages. It will not overwrite your current messages.

## How It Works

- The script uses the chat thread ID from the URL (e.g., `7990669924323622` in `https://www.messenger.com/e2ee/t/7990669924323622`) to store and retrieve messages specific to each conversation
- Messages are stored locally in your browser using the userscript storage API
- Messages are sorted by timestamp with newest first
- Each message displays when it was saved (today, yesterday, or specific date)
- No data is sent to any external server
- Messages persist between browser sessions

## Customization

You can modify the userscript to customize:
- The position and appearance of the UI
- The keyboard shortcuts
- Additional features as needed

## Privacy and Security

- All saved messages are stored locally in your browser
- No data is sent to any external server
- The script only runs on messenger.com domains
- Import/export files are processed entirely client-side