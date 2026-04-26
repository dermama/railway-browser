
// background.js - AI Fashion Merger Extension Engine

// Resolve default server URL dynamically from the extension's origin if possible
function resolveDefaultServer() {
    return 'ws://127.0.0.1:7000/ws';
}

let config = {
    sessionId: null,
    apiKey: null,
    serverUrl: null
};

let appTarget = null; // { tabId, frameId }
let socket = null;

chrome.storage.local.get(['nodeMindSessionId', 'nodeMindApiKey', 'nodeMindServerUrl'], (result) => {
    config.sessionId = result.nodeMindSessionId || 'AUTO';
    config.apiKey = result.nodeMindApiKey || '';
    config.serverUrl = result.nodeMindServerUrl || resolveDefaultServer();

    console.log("AI Fashion Merger Engine Ready. Server:", config.serverUrl);
    startHeartbeat();
    startPolling();
    if (config.serverUrl) connectToExternalServer(config.serverUrl);
});

function startPolling() {
    setInterval(async () => {
        if (!config.serverUrl) return;

        try {
            // تصحيح بناء الرابط: حذف أي مسارات إضافية والتركيز على الـ Origin فقط
            let apiUrl = config.serverUrl.replace('wss://', 'https://').replace('ws://', 'http://');
            const urlObj = new URL(apiUrl);
            apiUrl = `${urlObj.protocol}//${urlObj.host}`; // سيصبح دائماً http://127.0.0.1:7000 مثلاً

            const response = await fetch(`${apiUrl}/api/tasks/next`);

            // 204 = empty queue, not an error
            if (response.status === 204) return;

            if (response.ok) {
                const data = await response.json();
                if (data && data.id) {
                    console.log('[Background] Task received via Polling:', data.id);
                    processIncomingTask(data);
                }
            }
        } catch (e) {
            // Silently ignore polling errors to avoid log spam
        }
    }, 10000); // Poll every 10 seconds
}

function processIncomingTask(data) {
    const taskId = data.taskId || data.id;
    
    // Support either images OR prompt (or both)
    if (data.personImage || data.garmentImage || data.prompt) {
        relayToApp({ 
            personImage: data.personImage, 
            garmentImage: data.garmentImage,
            prompt: data.prompt,
            image: data.personImage || data.garmentImage, 
            role: data.personImage ? 'person' : 'garment', 
            isCloudTask: true, 
            taskId: taskId,
            source: 'EXTERNAL_SERVER'
        });
        chrome.storage.local.set({ lastCloudTaskId: taskId });
        broadcastToAllTabs({ type: 'STATUS_UPDATE', taskId: taskId, message: 'Task received and relayed to App' });
    }
}

function connectToExternalServer(url) {
    if (socket) {
        socket.close();
    }

    try {
        console.log("[Background] Connecting to External Server:", url);
        socket = new WebSocket(url);

        socket.onopen = () => {
            console.log("[Background] Connected to External Server.");
            socket.send(JSON.stringify({ type: 'IDENTIFY', client: 'extension' }));
            broadcastToAllTabs({ type: 'SERVER_STATUS', status: 'ONLINE' });
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Compatibility: Support ALL incoming task formats
                if ((data.type === 'NEW_IMAGE' || data.type === 'FASHION_REQUEST' || data.type === 'TASK_CREATED')) {
                    console.log("[Background] Received Task from Server:", data.type, "TaskID:", data.taskId);
                    processIncomingTask(data);
                }
                
                // Handle results from the App via Server
                if (data.type === 'FASHION_RESULT' && (data.data || data.resultImage)) {
                    console.log("[Background] Received Final Result from Server Broadcast");
                    // If we need to SMART_PASTE it locally
                    handleCommand({
                        action: 'SMART_PASTE',
                        payload: { base64: data.data?.resultImage || data.resultImage },
                        sessionId: config.sessionId
                    }, { url: 'EXTERNAL_SERVER' });
                }

                // Handle task completion ACK from server
                if (data.type === 'TASK_COMPLETED_ACK') {
                    console.log("[Background] Server acknowledged task completion:", data.taskId);
                    chrome.storage.local.remove('lastCloudTaskId');
                }
            } catch (e) {
                console.error("[Background] Failed to parse server message:", e);
            }
        };

        socket.onclose = () => {
            console.log("[Background] External Server Disconnected. Retrying in 5s...");
            broadcastToAllTabs({ type: 'SERVER_STATUS', status: 'OFFLINE' });
            setTimeout(() => {
                if (config.serverUrl === url) connectToExternalServer(url);
            }, 5000);
        };

        socket.onerror = (err) => {
            console.error("[Background] WebSocket Error:", err);
            socket.close();
        };
    } catch (e) {
        console.error("[Background] Failed to initialize WebSocket:", e);
    }
}

function startHeartbeat() {
    setInterval(async () => {
        if (!appTarget) return;
        
        chrome.tabs.sendMessage(appTarget.tabId, {
            source: 'NODEMIND_EXTENSION',
            type: 'HEARTBEAT',
            sessionId: config.sessionId || 'AUTO'
        }, { frameId: appTarget.frameId }).catch(() => {
            appTarget = null;
        });
    }, 2000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'REGISTER_APP') {
        appTarget = {
            tabId: sender.tab.id,
            frameId: sender.frameId
        };
        console.log("App Registered:", appTarget);
        // If we don't have a session ID, we'll wait for the first command to set it
        return;
    }

    if (request.type === 'UPDATE_CONFIG') {
        const oldUrl = config.serverUrl;
        config.sessionId = request.sessionId;
        config.apiKey = request.apiKey;
        config.serverUrl = request.serverUrl;
        
        if (config.serverUrl !== oldUrl) {
            if (config.serverUrl) connectToExternalServer(config.serverUrl);
            else if (socket) socket.close();
        }
        
        sendResponse({ status: 'OK' });
        return;
    }

    if (request.type === 'EXECUTE_COMMAND') {
        const { command } = request;
        
        // Auto-register and learn session ID
        if (sender.tab && sender.tab.url.includes('.run.app')) {
            appTarget = {
                tabId: sender.tab.id,
                frameId: sender.frameId
            };
            if (!config.sessionId || config.sessionId === 'AUTO') {
                config.sessionId = command.sessionId;
                chrome.storage.local.set({ nodeMindSessionId: command.sessionId });
            }
        }

        handleCommand(command, sender).then(sendResponse);
        return true; 
    }

    // Handle incoming fashion request from content script
    if (request.type === 'FASHION_REQUEST') {
        const payload = {
            ...request.data,
            sourceTabId: sender.tab.id,
            sourceUrl: sender.tab.url
        };
        
        // Track Cloud Task ID if present
        if (request.data.isCloudTask && request.data.taskId) {
            console.log("[Background] Tracking Cloud Task:", request.data.taskId);
            chrome.storage.local.set({ lastCloudTaskId: request.data.taskId });
            broadcastToAllTabs({ type: 'STATUS_UPDATE', taskId: request.data.taskId, message: 'Extension started tracking task' });
        }

        relayToApp(payload);
        return;
    }

    // Handle status update from App (relayed via content script)
    if (request.type === 'STATUS_UPDATE') {
        broadcastToAllTabs(request.data);
        return;
    }
});

async function broadcastToAllTabs(data) {
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
            source: 'NODEMIND_EXTENSION',
            type: 'STATUS_UPDATE',
            data: data
        }).catch(() => {}); // Ignore errors for tabs without content scripts
    });
}

async function relayToApp(data) {
    if (!appTarget) {
        console.warn("[Background] No appTarget registered. Falling back to active tab.");
        try {
            const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            if (tabs && tabs.length > 0) {
                appTarget = { tabId: tabs[0].id, frameId: 0 };
            } else {
                console.error("[Background] FATAL: No active tab found to receive the task.");
                return;
            }
        } catch (e) {
            console.error("[Background] Error querying active tab:", e);
            return;
        }
    }

    console.log("[Background] Relaying task to App Tab:", appTarget.tabId);
    chrome.tabs.sendMessage(appTarget.tabId, {
        source: 'NODEMIND_EXTENSION',
        type: 'FASHION_REQUEST',
        data: data
    }, { frameId: appTarget.frameId }).catch((e) => {
        console.warn("[Background] Failed to send message to tab, clearing appTarget:", e);
        appTarget = null;
    });
}

async function handleCommand(command, sender) {
    const { action, payload, sessionId } = command;

    // Auto-register app if it's from a .run.app domain
    const senderUrl = sender.url || (sender.tab ? sender.tab.url : '');
    if (senderUrl.includes('.run.app')) {
        appTarget = {
            tabId: sender.tab?.id,
            frameId: sender.frameId
        };
        console.log("[Background] App Auto-Registered:", appTarget, "URL:", senderUrl);
        
        // If we just registered, send an immediate heartbeat to confirm
        chrome.tabs.sendMessage(appTarget.tabId, {
            source: 'NODEMIND_EXTENSION',
            type: 'HEARTBEAT',
            sessionId: config.sessionId || 'AUTO'
        }, { frameId: appTarget.frameId }).catch(e => console.error("[Background] Initial Heartbeat Failed:", e));
    }

    if (action === 'PING') {
        return { status: 'SUCCESS', data: 'Fashion Engine V1.0' };
    }

    if (!config.sessionId || sessionId !== config.sessionId) return { status: 'FAILURE', error: 'Invalid Session' };

    let targetTabId = payload?.tabId;
    if (!targetTabId && action !== 'OPEN_TAB') {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab) targetTabId = tab.id;
    }
    
    try {
        if (action === 'SMART_PASTE') {
             // 0. Get the Cloud Task ID from storage
             const { lastCloudTaskId: cloudTaskId } = await chrome.storage.local.get(['lastCloudTaskId']);
             console.log("[Background] Action: SMART_PASTE, TaskID:", cloudTaskId);

             if (cloudTaskId && config.serverUrl) {
                 submitResultWithRetry(cloudTaskId, payload.base64);
             } else {
                 console.warn("[Background] Missing cloudTaskId or serverUrl for result submission", {cloudTaskId, serverUrl: config.serverUrl});
             }

             // 2. Local SMART_PASTE logic
             const finalTabId = payload.sourceTabId || targetTabId;
             if (finalTabId) {
                 await chrome.scripting.executeScript({
                    target: { tabId: finalTabId },
                    args: [payload.base64, payload.mimeType || 'image/png'],
                    func: async (base64Data, mime) => {
                        try {
                            const res = await fetch(base64Data);
                            const blob = await res.blob();
                            const file = new File([blob], "fashion_result.png", { type: mime });
                            
                            // Try to find a place to paste it
                            let el = document.querySelector('textarea, [contenteditable="true"]');
                            if (!el) el = document.querySelector('input[type="file"]');
                            
                            if (el) {
                                el.focus();
                                const dt = new DataTransfer(); 
                                dt.items.add(file);
                                
                                if (el.tagName === 'INPUT') {
                                    el.files = dt.files;
                                    el.dispatchEvent(new Event('change', { bubbles: true }));
                                } else {
                                    el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
                                }
                                return { success: true };
                            }
                            return { success: false, error: 'Could not find target input.' };
                        } catch (e) { return { success: false, error: e.toString() }; }
                    }
                 });
             }
             return { status: 'SUCCESS' };
        }

        if (action === 'OPEN_TAB') {
            const newTab = await chrome.tabs.create({ url: payload.url, active: true });
            return { status: 'SUCCESS', data: { tabId: newTab.id } };
        }

    } catch (e) {
        return { status: 'FAILURE', error: e.message };
    }
}

async function submitResultWithRetry(taskId, resultImage, attempt = 1) {
    if (attempt > 10) {
        console.error("[Background] Max retries reached for task:", taskId);
        return;
    }

    console.log(`[Background] Submitting Result (Attempt ${attempt}) for Task:`, taskId);
    
    try {
        const apiUrl = config.serverUrl.replace('wss://', 'https://').replace('ws://', 'http://');
        let response = await fetch(`${apiUrl}/api/tasks/${taskId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resultImage })
        });

        // FALLBACK: Try /api/results if the first one fails or as requested by user
        if (!response.ok) {
            console.log("[Background] Primary endpoint failed, trying fallback /api/results...");
            response = await fetch(`${apiUrl}/api/results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, resultImage, source: 'extension-fallback' })
            });
        }

        if (response.ok) {
            console.log("[Background] Result submitted successfully via HTTP.");
            chrome.storage.local.remove('lastCloudTaskId');
            broadcastToAllTabs({ type: 'STATUS_UPDATE', taskId: taskId, message: 'Result successfully uploaded to server' });
        } else {
            throw new Error(`Server returned ${response.status}`);
        }
    } catch (e) {
        console.warn(`[Background] Submit failed (Attempt ${attempt}):`, e.message);
        setTimeout(() => submitResultWithRetry(taskId, resultImage, attempt + 1), 3000 * attempt);
    }
}
