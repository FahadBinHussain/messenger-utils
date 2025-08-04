chrome.commands?.onCommand?.addListener(async (command) => {
  if (command === "paste-gif") {
    // Example: using a hardcoded GIF URL for testing
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "pasteGif",
        gifUrl: "https://media.giphy.com/media/xT9IgDEI1iZyb2wqo8/giphy.gif"
      });
    });
  }
});
