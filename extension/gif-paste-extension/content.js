// Simulate drag and drop of a File (GIF)
function simulateFileDrop(file, targetElement) {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  ['dragenter', 'dragover', 'drop'].forEach(eventType => {
    const event = new DragEvent(eventType, {
      bubbles: true,
      cancelable: true,
      dataTransfer
    });
    targetElement.dispatchEvent(event);
  });
}

// Listen for messages from background to paste GIF
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'pasteGif' && msg.gifUrl) {
    const blob = await fetch(msg.gifUrl).then(r => r.blob());
    const file = new File([blob], "pasted.gif", { type: "image/gif" });

    // Messenger input area
    const inputBox = document.querySelector('[contenteditable="true"]');
    if (inputBox) {
      simulateFileDrop(file, inputBox);
    }
  }
});
