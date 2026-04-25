
// popup.js - AI Fashion Merger Popup

document.addEventListener('DOMContentLoaded', () => {
    const sessionIdInput = document.getElementById('sessionId');
    const apiKeyInput = document.getElementById('apiKey');
    const serverUrlInput = document.getElementById('serverUrl');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');

    // Load existing config
    chrome.storage.local.get(['nodeMindSessionId', 'nodeMindApiKey', 'nodeMindServerUrl'], (result) => {
        sessionIdInput.value = result.nodeMindSessionId || 'AUTO';
        if (result.nodeMindSessionId) {
            statusDiv.innerText = `Status: Connected to ${result.nodeMindSessionId}`;
            statusDiv.style.color = '#10b981';
        }
        if (result.nodeMindApiKey) {
            apiKeyInput.value = result.nodeMindApiKey;
        }
        serverUrlInput.value = result.nodeMindServerUrl || 'ws://127.0.0.1:7000/ws';
    });

    saveBtn.addEventListener('click', () => {
        const sessionId = sessionIdInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        const serverUrl = serverUrlInput.value.trim();

        if (!sessionId) {
            statusDiv.innerText = "Error: Session ID required";
            statusDiv.style.color = '#ef4444';
            return;
        }

        chrome.storage.local.set({
            nodeMindSessionId: sessionId,
            nodeMindApiKey: apiKey,
            nodeMindServerUrl: serverUrl
        }, () => {
            // Notify background script
            chrome.runtime.sendMessage({
                type: 'UPDATE_CONFIG',
                sessionId,
                apiKey,
                serverUrl
            });

            statusDiv.innerText = "Success: Config Updated!";
            statusDiv.style.color = '#10b981';
            
            saveBtn.innerText = "Connected!";
            saveBtn.style.background = "#059669";
            
            setTimeout(() => {
                saveBtn.innerText = "Connect to Platform";
                saveBtn.style.background = "#10b981";
            }, 2000);
        });
    });
});
