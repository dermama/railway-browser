const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// ── Playwright (connects in background, no longer blocks primary control) ──
const { chromium } = require('playwright-core');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const PORT = process.env.PORT || 3000;
const CDP_URL = 'http://localhost:9222';

// ── Global State ──
let lastFrameBuffer = null;
let pwBrowser = null;
let pwPage = null;
let lastActionStatus = "Ready";

// ── Task Management System ──
let tasks = [];
let taskResults = {};

// ─────────────────── Minimalist Execution (xdotool) ───────────────────
// This function triggers interactions INSTANTLY without awaiting browser engine callbacks
function directAction(data) {
    const { action, x, y, key, text } = data;
    console.log(`[Direct] Executing: ${action} at (${x},${y})`);
    
    let cmd = "";
    if (action === 'click' || action === 'click_mouse') {
        cmd = `/usr/bin/xdotool mousemove ${x} ${y} click 1`;
    } else if (action === 'type') {
        cmd = `/usr/bin/xdotool type '${text.replace(/'/g, "'\\''")}'`;
    } else if (action === 'key') {
        cmd = `/usr/bin/xdotool key ${key === 'Return' ? 'Return' : key}`;
    } else if (action === 'scroll') {
        cmd = `/usr/bin/xdotool click ${y > 0 ? '5' : '4'}`;
    }

    if (cmd) {
        // Direct execution with explicit env for stability
        exec(cmd, { env: { ...process.env, DISPLAY: ':99' } }, (err, stdout, stderr) => {
            if (err || stderr) fs.appendFileSync('/tmp/x11_errors.log', `[${new Date().toISOString()}] ${action} ERR: ${stderr || err.message}\n`);
        });
    }

    lastActionStatus = `Direct: ${action} (${x},${y})`;
    // Background: If in "Touch" mode, ALSO trigger a playwright tap
    if (action === 'click' && pwPage) pwPage.touchscreen.tap(x, y).catch(() => {});
}

// ─────────────────── Playwright (Background Only) ───────────────────
async function findActivePage(browser) {
    try {
        const contexts = browser.contexts();
        let allPages = [];
        for (const ctx of contexts) allPages = allPages.concat(ctx.pages());
        return allPages.find(p => !p.url().startsWith('chrome:')) || allPages[0];
    } catch (e) { return null; }
}

async function connectPlaywright() {
    try {
        if (!pwBrowser) {
            pwBrowser = await chromium.connectOverCDP(CDP_URL);
            pwBrowser.on('disconnected', () => { pwBrowser = null; pwPage = null; });
        }
        pwPage = await findActivePage(pwBrowser);
    } catch (e) { setTimeout(connectPlaywright, 5000); }
}

setInterval(connectPlaywright, 15000);
setTimeout(connectPlaywright, 5000);

// ─────────────────── Ghost Streamer (FFMPEG) ───────────────────
function startGhostStreamer() {
    console.log('[Ghost] Starting FFMPEG Streamer...');
    const streamer = spawn('ffmpeg', [
        '-f', 'x11grab', '-r', '12', '-s', '1280x800', '-i', ':99',
        '-f', 'image2pipe', '-vcodec', 'mjpeg', '-'
    ]);

    let buffer = Buffer.alloc(0);
    streamer.stdout.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        let eoiIndex = buffer.indexOf(Buffer.from([0xFF, 0xD9]));
        while (eoiIndex !== -1) {
            const frame = buffer.slice(0, eoiIndex + 2);
            buffer = buffer.slice(eoiIndex + 2);
            lastFrameBuffer = frame;
            if (wss.clients.size > 0) {
                const msg = JSON.stringify({ type: 'SCREENSHOT_STREAM', image: `data:image/jpeg;base64,${frame.toString('base64')}` });
                wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
            }
            eoiIndex = buffer.indexOf(Buffer.from([0xFF, 0xD9]));
        }
    });
    streamer.on('close', () => setTimeout(startGhostStreamer, 2000));
}
startGhostStreamer();

// ─────────────────── WebSocket & API ───────────────────
wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'REMOTE_ACTION') directAction(data);
        } catch (e) {}
    });
});

app.get('/api/debug', async (req, res) => {
    const x11Logs = fs.existsSync('/tmp/x11_errors.log') ? fs.readFileSync('/tmp/x11_errors.log', 'utf8').slice(-2000) : "No errors.";
    exec('ps aux | grep -v grep | grep -E "chrome|Xvfb|ffmpeg|node"', (err, stdout) => {
        res.json({
            status: lastActionStatus,
            playwright: pwPage ? `OK: ${pwPage.url()}` : 'Connecting...',
            x11_errors: x11Logs,
            processes: stdout || err?.message,
            time: new Date().toISOString()
        });
    });
});

app.get('/api/playwright/screenshot', async (req, res) => {
    if (!pwPage) return res.status(503).send('Not ready');
    try {
        const pic = await pwPage.screenshot({ type: 'jpeg', quality: 70 });
        res.set('Content-Type', 'image/jpeg').send(pic);
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/playwright/refresh', async (req, res) => {
    await connectPlaywright();
    res.json({ url: pwPage ? pwPage.url() : 'None' });
});

app.get('/api/screen.jpg', (req, res) => {
    if (!lastFrameBuffer) return res.status(503).send('Loading...');
    res.set('Content-Type', 'image/jpeg').send(lastFrameBuffer);
});

app.get('/api/kill', (req, res) => {
    res.send('Restarting Container...');
    setTimeout(() => process.exit(1), 500);
});

// ── Task Queue Endpoints ──

// Create a new task (e.g., send image/text from outside)
app.post('/api/tasks', (req, res) => {
    const { personImage, garmentImage, prompt } = req.body;
    const taskId = uuidv4();
    const newTask = {
        id: taskId,
        taskId: taskId,
        type: 'NEW_TASK',
        personImage,
        garmentImage,
        prompt,
        timestamp: Date.now()
    };
    
    tasks.push(newTask);
    console.log(`[Server] New Task Created: ${taskId}`);
    
    // Notify all connected extensions via WebSocket
    const msg = JSON.stringify({ type: 'NEW_IMAGE', ...newTask });
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
    
    res.json({ status: 'SUCCESS', taskId });
});

// Extension polls for next task
app.get('/api/tasks/next', (req, res) => {
    if (tasks.length === 0) return res.status(204).end();
    const task = tasks.shift();
    res.json(task);
});

// Extension submits result
app.post(['/api/tasks/:id/complete', '/api/results'], (req, res) => {
    const taskId = req.params.id || req.body.taskId;
    const { resultImage } = req.body;
    
    console.log(`[Server] Task Completed: ${taskId}`);
    taskResults[taskId] = { resultImage, timestamp: Date.now() };
    
    // Notify anyone interested that the result is ready
    const msg = JSON.stringify({ type: 'FASHION_RESULT', taskId, resultImage });
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
    
    res.json({ status: 'OK' });
});

// Get result for a task
app.get('/api/tasks/:id/result', (req, res) => {
    const result = taskResults[req.params.id];
    if (!result) return res.status(404).json({ error: 'Not found or not ready' });
    res.json(result);
});

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'control.html')));

server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    else socket.destroy();
});

server.listen(PORT, '0.0.0.0', () => console.log(`[Server] Ghost V10.Stable running on ${PORT}`));
