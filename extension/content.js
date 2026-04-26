// content.js - AI Fashion Merger Content Script

console.log("AI Fashion Merger Content Script Loaded.");

// Identify if this is the App frame (Always TRUE to ensure registration on ANY site)
const isAppFrame = true; 
if (isAppFrame) {
    console.log("[Extension] AI App Detected! Registering as Target...");
    chrome.runtime.sendMessage({ type: 'REGISTER_APP' });
    createDebugBar();
}

// 1. Listen for messages from the Web App (window.postMessage)
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data) return;
  const source = event.data.source;
  
  if (source === 'NODEMIND_CONTROL_PAGE' && event.data.type === 'BRIDGE_PING') {
      window.postMessage({ source: 'NODEMIND_EXTENSION', type: 'BRIDGE_PONG' }, '*');
      return;
  }

  if (source !== 'NODEMIND_APP' && source !== 'NODEMIND_EXTERNAL_SERVER') return;

  const { command, type, isProcessing } = event.data;
  
  if (type === 'STATUS_UPDATE' || type === 'REQUEST_RECEIVED' || type === 'REQUEST_REJECTED') {
      chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', data: event.data });
      window.postMessage({ source: 'NODEMIND_EXTENSION', type: type, data: event.data }, '*');
      return;
  }

  if (event.data.source === 'NODEMIND_EXTERNAL_SERVER') {
      const { type, image, role, taskId } = event.data;
      if (type === 'NEW_IMAGE' && image) {
          window.postMessage({ source: 'NODEMIND_EXTENSION', type: 'ACK', message: `Image received for ${role}. Relay to App in progress...`, timestamp: Date.now() }, '*');
          chrome.runtime.sendMessage({ type: 'FASHION_REQUEST', data: { [role === 'person' ? 'personImage' : 'garmentImage']: image, prompt: event.data.prompt, isCloudTask: true, taskId: taskId } });
      }
      return;
  }

  if (command) {
      try {
          chrome.runtime.sendMessage({ type: 'EXECUTE_COMMAND', command }, (response) => {
            if (chrome.runtime.lastError) { console.error("Extension Error:", chrome.runtime.lastError); return; }
            window.postMessage({ source: 'NODEMIND_EXTENSION', commandId: command.id, status: response ? response.status : 'FAILURE', data: response ? response.data : null, error: response ? response.error : 'Unknown error' }, '*');
          });
      } catch (err) { console.error("Bridge Error:", err); }
  }
});

let isAppBusy = false;

// 2. Listen for messages from the Background Script (relay from App)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source === 'NODEMIND_EXTENSION') {
    if (message.type === 'SERVER_STATUS') {
        const bar = document.getElementById('nm-debug-bar');
        if (bar) {
            const statusDiv = bar.querySelector('div:first-child');
            if (message.status === 'ONLINE') {
                statusDiv.style.color = '#10b981';
                statusDiv.innerText = '● AI Extension Connected';
            } else {
                statusDiv.style.color = '#ef4444';
                statusDiv.innerText = '● AI Extension DISCONNECTED';
            }
        }
        return;
    }
    
    if (message.type === 'STATUS_UPDATE') {
        isAppBusy = message.data?.isProcessing || false;
        updateButtonStates();
        return;
    }

    if (message.type === 'FASHION_REQUEST') {
        console.log("[Extension] Task received from Background:", message.data.taskId);
        
        const msgText = `📥 [Mediator] تم استلام صورة جديدة!\nرقم المهمة: ${message.data.taskId}`;
        const notify = document.createElement('div');
        notify.innerHTML = msgText.replace(/\n/g, '<br>');
        notify.style = "position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 15px 25px; border-radius: 10px; z-index: 999999; font-weight: bold; box-shadow: 0 10px 30px rgba(0,0,0,0.5); font-family: sans-serif; text-align: center; border: 2px solid white;";
        document.body.appendChild(notify);
        setTimeout(() => notify.remove(), 5000);

        updateDebugBar(message.data.taskId, message.data.personImage || message.data.garmentImage);

        if (message.data && message.data.prompt) fillPrompt(message.data.prompt);
        window.postMessage(message, '*');
    } else {
        window.postMessage(message, '*');
    }
  }
});

const updateButtonStates = () => {
    const btns = document.querySelectorAll('.nm-fashion-btn');
    btns.forEach(btn => {
        if (isAppBusy) {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });
};

// 2.5 New: Debug Bar Logic
const createDebugBar = () => {
    if (document.getElementById('nm-debug-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'nm-debug-bar';
    bar.style = "position: fixed; bottom: 0; left: 0; right: 0; background: rgba(15, 23, 42, 0.9); color: white; padding: 5px 15px; font-size: 11px; z-index: 9999999; display: flex; gap: 20px; align-items: center; border-top: 1px solid #334155; font-family: sans-serif; backdrop-filter: blur(5px);";
    bar.innerHTML = `
        <div style="color: #10b981; font-weight: bold;">● AI Extension Connected</div>
        <div id="nm-last-task">Last Task: None</div>
        <div id="nm-img-preview" style="display:none; align-items: center; gap: 5px;">
            <span>Preview:</span>
            <img id="nm-preview-thumb" style="height: 20px; border-radius: 3px; border: 1px solid white;">
        </div>
    `;
    document.body.appendChild(bar);
};

const updateDebugBar = (taskId, base64) => {
    createDebugBar();
    document.getElementById('nm-last-task').innerText = `Last Task: ${taskId.substring(0,8)}...`;
    if (base64) {
        document.getElementById('nm-img-preview').style.display = 'flex';
        document.getElementById('nm-preview-thumb').src = base64;
    }
};

const fillPrompt = (text) => {
    if (!text) return;
    let selectors = ['textarea[placeholder*="Prompt"]', 'textarea[placeholder*="describe"]', 'textarea[placeholder*="Instruction"]', 'input[placeholder*="Prompt"]', '.prompt-input textarea', '#prompt-input', 'textarea'];
    let el = null;
    for (const s of selectors) { el = document.querySelector(s); if (el) break; }
    if (el) {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }
    return false;
};

const addTryOnButtons = () => {
  const images = document.querySelectorAll('img:not(.nm-processed)');
  images.forEach(img => {
    if (img.width < 100 || img.height < 100) return;
    img.classList.add('nm-processed');
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.display = 'inline-block';
    img.parentNode.insertBefore(container, img);
    container.appendChild(img);
    const btnContainer = document.createElement('div');
    btnContainer.style.position = 'absolute'; btnContainer.style.top = '5px'; btnContainer.style.right = '5px'; btnContainer.style.zIndex = '9999'; btnContainer.style.display = 'flex'; btnContainer.style.gap = '4px';
    container.appendChild(btnContainer);
    const createBtn = (text, type, color) => {
      const btn = document.createElement('button');
      btn.className = 'nm-fashion-btn'; btn.innerText = text; btn.style.background = color; btn.style.color = 'white'; btn.style.border = 'none'; btn.style.borderRadius = '6px'; btn.style.padding = '4px 8px'; btn.style.fontSize = '10px'; btn.style.fontWeight = 'bold'; btn.style.cursor = 'pointer'; btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'; btn.style.transition = 'all 0.2s ease';
      btn.onclick = async (e) => {
        if (isAppBusy) return; e.preventDefault(); e.stopPropagation();
        try {
          const res = await fetch(img.src); const blob = await res.blob(); const reader = new FileReader();
          reader.onloadend = () => { chrome.runtime.sendMessage({ type: 'FASHION_REQUEST', data: { [type]: reader.result } }); const originalText = btn.innerText; btn.innerText = '✅ Sent'; btn.style.background = '#059669'; setTimeout(() => { btn.innerText = originalText; btn.style.background = color; }, 2000); };
          reader.readAsDataURL(blob);
        } catch (err) { console.error("Failed to capture image:", err); }
      };
      return btn;
    };
    btnContainer.appendChild(createBtn('👤 Model', 'personImage', '#10b981'));
    btnContainer.appendChild(createBtn('👗 Garment', 'garmentImage', '#3b82f6'));
  });
};

const scrapeResults = async () => {
    if (!window.location.hostname.includes('aistudio.google.com')) return;
    const outputContainers = document.querySelectorAll('.output-image, .image-container');
    for (const container of outputContainers) {
        const img = container.querySelector('img');
        if (img && img.width > 300 && img.height > 300) {
            const isProbablyResult = container.classList.contains('output-image') || img.src.includes('output') || img.src.includes('generated');
            if (isProbablyResult) {
                try {
                    const res = await fetch(img.src); const blob = await res.blob(); const reader = new FileReader();
                    reader.onloadend = async () => { if (reader.result === lastCapturedBase64) return; lastCapturedBase64 = reader.result; chrome.runtime.sendMessage({ type: 'EXECUTE_COMMAND', command: { action: 'SMART_PASTE', payload: { base64: reader.result, mimeType: 'image/png' } } }); };
                    reader.readAsDataURL(blob); break;
                } catch (e) {}
            }
        }
    }
};

let lastCapturedBase64 = null;
setInterval(scrapeResults, 5000);
setInterval(addTryOnButtons, 2000);
