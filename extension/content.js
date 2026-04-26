// content.js - Protocol Bridge for Virtual Stylist App
console.log("[Mediator] Bridge Content Script Loaded.");

const APP_SOURCE = "NODEMIND_APP";
const EXTENSION_SOURCE = "NODEMIND_EXTENSION";

// 1. Register with Background script
chrome.runtime.sendMessage({ type: 'REGISTER_APP' });
createDebugBar();

// 2. Listen for messages from the Web App (App.tsx)
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data) return;
  
  // Handle PING from App
  if (event.data.source === APP_SOURCE && event.data.command?.action === "PING") {
      // Respond with PONG to let the App know we are here
      window.postMessage({ 
        source: EXTENSION_SOURCE, 
        command: { action: "PONG", payload: { serverOnline: true } } 
      }, "*");
      updateStatusUI('ONLINE');
      return;
  }

  // Relay other commands from App to Background
  if (event.data.source === APP_SOURCE && event.data.command) {
      chrome.runtime.sendMessage({ type: 'EXECUTE_COMMAND', command: event.data.command });
  }
});

// 3. Listen for messages from Background Script (Server tasks)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source === EXTENSION_SOURCE) {
    if (message.type === 'FASHION_REQUEST') {
        console.log("[Bridge] Task received, relaying to App as VIRTUAL_TRY_ON");
        
        // Map to App's expected protocol
        window.postMessage({
            source: EXTENSION_SOURCE,
            command: {
                id: message.data.taskId,
                action: "VIRTUAL_TRY_ON",
                payload: {
                    personImage: message.data.personImage,
                    clothingImage: message.data.garmentImage
                }
            }
        }, "*");

        updateDebugBar(message.data.taskId, message.data.personImage);
        showNotification(message.data.taskId);
    }
    
    if (message.type === 'SERVER_STATUS') {
        updateStatusUI(message.status);
    }
  }
});

// --- UI Helpers ---
function createDebugBar() {
    if (document.getElementById('nm-debug-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'nm-debug-bar';
    bar.style = "position: fixed; bottom: 0; left: 0; right: 0; background: #0f172a; color: white; padding: 4px 10px; font-size: 10px; z-index: 9999999; display: flex; gap: 15px; border-top: 1px solid #334155; font-family: sans-serif;";
    bar.innerHTML = `<div id="nm-status" style="color:#ef4444">● Extension Waiting</div><div id="nm-last-task">Ready</div>`;
    document.body.appendChild(bar);
}

function updateStatusUI(status) {
    const el = document.getElementById('nm-status');
    if (el) {
        el.style.color = (status === 'ONLINE') ? '#10b981' : '#ef4444';
        el.innerText = (status === 'ONLINE') ? '● Extension Linked' : '● Extension Waiting';
    }
}

function updateDebugBar(taskId, img) {
    const el = document.getElementById('nm-last-task');
    if (el) el.innerText = "Active Task: " + taskId.substring(0,8);
}

function showNotification(taskId) {
    const n = document.createElement('div');
    n.innerText = "📥 Image Received!";
    n.style = "position:fixed; top:10px; right:10px; background:#10b981; color:white; padding:10px; border-radius:5px; z-index:999999; font-weight:bold;";
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 4000);
}
