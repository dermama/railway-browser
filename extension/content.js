// content.js - Minimalist & Stable Version
console.log("[Mediator] Stable Content Script Loaded.");

const isAppFrame = true; 
if (isAppFrame) {
    chrome.runtime.sendMessage({ type: 'REGISTER_APP' });
    createDebugBar();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source === 'NODEMIND_EXTENSION') {
    if (message.type === 'SERVER_STATUS') {
        updateStatusUI(message.status);
        return;
    }
    
    if (message.type === 'FASHION_REQUEST') {
        showNotification(message.data.taskId);
        updateDebugBar(message.data.taskId, message.data.personImage || message.data.garmentImage);
        if (message.data.prompt) fillPromptSafe(message.data.prompt);
        window.postMessage(message, '*');
    }
  }
});

function fillPromptSafe(text) {
    // محاولة الكتابة بطريقة لا تكسر الموقع
    const el = document.querySelector('textarea, [contenteditable="true"]');
    if (el) {
        el.focus();
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
            el.value = text;
        } else {
            el.innerText = text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function createDebugBar() {
    if (document.getElementById('nm-debug-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'nm-debug-bar';
    bar.style = "position: fixed; bottom: 0; left: 0; right: 0; background: #0f172a; color: white; padding: 4px 10px; font-size: 10px; z-index: 9999999; display: flex; gap: 15px; border-top: 1px solid #334155;";
    bar.innerHTML = `<div id="nm-status" style="color:#10b981">● Connected</div><div id="nm-last-task">Ready</div>`;
    document.body.appendChild(bar);
}

function updateStatusUI(status) {
    const el = document.getElementById('nm-status');
    if (el) {
        el.style.color = (status === 'ONLINE') ? '#10b981' : '#ef4444';
        el.innerText = (status === 'ONLINE') ? '● Connected' : '● Disconnected';
    }
}

function showNotification(taskId) {
    const n = document.createElement('div');
    n.innerText = "📥 New Task Received!";
    n.style = "position:fixed; top:10px; right:10px; background:#10b981; color:white; padding:10px; border-radius:5px; z-index:999999;";
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

function updateDebugBar(taskId, img) {
    const el = document.getElementById('nm-last-task');
    if (el) el.innerText = "Task: " + taskId.substring(0,8);
}
