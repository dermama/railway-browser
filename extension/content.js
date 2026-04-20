
// content.js - AI Fashion Merger Content Script

console.log("AI Fashion Merger Content Script Loaded.");

// Identify if this is the App frame (AI Studio or Hugging Face)
const isAppFrame = window.location.hostname.includes('.run.app') || 
                   window.location.hostname.includes('.hf.space') ||
                   window.location.hostname.includes('ai.studio'); // User's provided URL
if (isAppFrame) {
    console.log("[Extension] AI App Detected! Registering...");
    chrome.runtime.sendMessage({ type: 'REGISTER_APP' });
}

// 1. Listen for messages from the Web App (window.postMessage)
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data) return;
  const source = event.data.source;
  
  // NEW: Handle Connection Pings from Control Page
  if (source === 'NODEMIND_CONTROL_PAGE' && event.data.type === 'BRIDGE_PING') {
      window.postMessage({ source: 'NODEMIND_EXTENSION', type: 'BRIDGE_PONG' }, '*');
      return;
  }

  // ALLOW both App messages AND Server Bridge messages
  if (source !== 'NODEMIND_APP' && source !== 'NODEMIND_EXTERNAL_SERVER') return;

  const { command, type, isProcessing } = event.data;
  
  if (type === 'STATUS_UPDATE' || type === 'REQUEST_RECEIVED' || type === 'REQUEST_REJECTED') {
      // Relay to Background Script (for global state)
      chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', data: event.data });
      
      // Also relay back to the page (external server)
      window.postMessage({
          source: 'NODEMIND_EXTENSION',
          type: type,
          data: event.data
      }, '*');
      return;
  }

  // 1.5. Listen for messages from External Server Page (window.postMessage)
  if (event.data.source === 'NODEMIND_EXTERNAL_SERVER') {
      const { type, image, role, taskId } = event.data;
      if (type === 'NEW_IMAGE' && image) {
          // Send immediate ACK back to the external server page
          window.postMessage({
              source: 'NODEMIND_EXTENSION',
              type: 'ACK',
              message: `Image received for ${role}. Relay to App in progress...`,
              timestamp: Date.now()
          }, '*');

          chrome.runtime.sendMessage({
              type: 'FASHION_REQUEST',
              data: {
                  [role === 'person' ? 'personImage' : 'garmentImage']: image,
                  prompt: event.data.prompt, // Support prompt relay if provided
                  isCloudTask: true,
                  taskId: taskId
              }
          });
      }
      return;
  }

  if (command) {
      // Relay to Background Script
      try {
          chrome.runtime.sendMessage({ type: 'EXECUTE_COMMAND', command }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Extension Error:", chrome.runtime.lastError);
                return;
            }

            // Send response back to Web App
            window.postMessage({
              source: 'NODEMIND_EXTENSION',
              commandId: command.id,
              status: response ? response.status : 'FAILURE',
              data: response ? response.data : null,
              error: response ? response.error : 'Unknown error'
            }, '*');
          });
      } catch (err) {
          console.error("Bridge Error:", err);
      }
  }
});

let isAppBusy = false;

// 2. Listen for messages from the Background Script (relay from App)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source === 'NODEMIND_EXTENSION') {
    if (message.type === 'STATUS_UPDATE') {
        isAppBusy = message.data.isProcessing;
        updateButtonStates();
        return;
    }
    if (message.type === 'FASHION_REQUEST') {
        if (message.data && message.data.prompt) {
            fillPrompt(message.data.prompt);
        }
        // Relay to Web App
        window.postMessage(message, '*');
    } else {
        // Relay to Web App (other message types)
        window.postMessage(message, '*');
    }
  }
});

const updateButtonStates = () => {
    const btns = document.querySelectorAll('.nm-fashion-btn');
    btns.forEach(btn => {
        if (isAppBusy) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.title = 'System is busy processing another request...';
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.title = '';
        }
    });
};

// 2.5 New: Prompt Injection Logic
const fillPrompt = (text) => {
    if (!text) return;
    console.log("[Extension] Attempting to fill prompt:", text);
    
    // 1. Try to find common prompt selectors
    let selectors = [
        'textarea[placeholder*="Prompt"]', 
        'textarea[placeholder*="describe"]',
        'textarea[placeholder*="Instruction"]',
        'input[placeholder*="Prompt"]',
        '.prompt-input textarea',
        '#prompt-input',
        'textarea' // Fallback to first textarea
    ];
    
    let el = null;
    for (const selector of selectors) {
        el = document.querySelector(selector);
        if (el) break;
    }
    
    if (el) {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        console.log("[Extension] Prompt filled successfully.");
        return true;
    }
    
    console.warn("[Extension] Could not find prompt input field.");
    return false;
};

// 3. Add "Try On" button to images on external websites
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
    btnContainer.style.position = 'absolute';
    btnContainer.style.top = '5px';
    btnContainer.style.right = '5px';
    btnContainer.style.zIndex = '9999';
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '4px';
    container.appendChild(btnContainer);

    const createBtn = (text, type, color) => {
      const btn = document.createElement('button');
      btn.className = 'nm-fashion-btn';
      btn.innerText = text;
      btn.style.background = color;
      btn.style.color = 'white';
      btn.style.border = 'none';
      btn.style.borderRadius = '6px';
      btn.style.padding = '4px 8px';
      btn.style.fontSize = '10px';
      btn.style.fontWeight = 'bold';
      btn.style.cursor = 'pointer';
      btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      btn.style.transition = 'all 0.2s ease';
      
      btn.onmouseover = () => { if (!isAppBusy) btn.style.transform = 'scale(1.05)'; };
      btn.onmouseout = () => btn.style.transform = 'scale(1)';

      btn.onclick = async (e) => {
        if (isAppBusy) return;
        e.preventDefault();
        e.stopPropagation();
        
        try {
          const response = await fetch(img.src);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result;
            
            chrome.runtime.sendMessage({
              type: 'FASHION_REQUEST',
              data: {
                [type]: base64
              }
            });
            
            const originalText = btn.innerText;
            btn.innerText = '✅ Sent';
            btn.style.background = '#059669';
            setTimeout(() => {
              btn.innerText = originalText;
              btn.style.background = color;
            }, 2000);
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          console.error("Failed to capture image:", err);
        }
      };
      return btn;
    };

    btnContainer.appendChild(createBtn('👤 Model', 'personImage', '#10b981'));
    btnContainer.appendChild(createBtn('👗 Garment', 'garmentImage', '#3b82f6'));
  });
  updateButtonStates();
};

// 4. Automated Result Scraper (Headless Bridge)
let lastCapturedBase64 = null;

const scrapeResults = async () => {
    if (!window.location.hostname.includes('ai.studio')) return;

    // AI Studio uses 'image-container' or specific Gradio output classes
    // We target the image that appears in the "Result" area
    const outputContainers = document.querySelectorAll('.output-image, .image-container');
    
    for (const container of outputContainers) {
        const img = container.querySelector('img');
        if (img && img.width > 300 && img.height > 300) {
            // Check if it's likely a result (Gradio results often have "output" or specific keywords)
            const isProbablyResult = container.classList.contains('output-image') || 
                                     img.src.includes('output') || 
                                     img.src.includes('generated');
                                     
            if (isProbablyResult) {
                try {
                    const response = await fetch(img.src);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                        const base64 = reader.result;
                        if (base64 === lastCapturedBase64) return;
                        
                        lastCapturedBase64 = base64;
                        console.log("[Extension] Result recognized and captured. Submitting...");
                        
                        chrome.runtime.sendMessage({
                            type: 'EXECUTE_COMMAND',
                            command: {
                                action: 'SMART_PASTE',
                                payload: { base64: base64, mimeType: 'image/png' }
                            }
                        });
                    };
                    reader.readAsDataURL(blob);
                    break;
                } catch (e) {}
            }
        }
    }
};

// Run scraper periodically
setInterval(scrapeResults, 5000);

// Run periodically to handle dynamic content
setInterval(addTryOnButtons, 2000);
