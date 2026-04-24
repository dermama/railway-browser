const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { chromium } = require('playwright-core');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const PORT = process.env.PORT || 3000;
const CDP_URL = 'http://127.0.0.1:9222';

// ── Global State ──
let lastFrameBuffer = null;
let pwBrowser = null;
let pwPage = null;
let lastActionStatus = "Ready";
let tasks = [];
let taskResults = {};

// ─────────────────── Minimalist Execution (xdotool) ───────────────────
function directAction(data) {
    const { action, x, y, key, text } = data;
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
        exec(cmd, { env: { ...process.env, DISPLAY: ':99' } });
    }
    lastActionStatus = `Direct: ${action}`;
}

// ─────────────────── Playwright Connection ───────────────────
async function connectPlaywright() {
    try {
        if (!pwBrowser) {
            pwBrowser = await chromium.connectOverCDP(CDP_URL);
            pwBrowser.on('disconnected', () => { pwBrowser = null; pwPage = null; });
        }
        const contexts = pwBrowser.contexts();
        let allPages = [];
        for (const ctx of contexts) allPages = allPages.concat(ctx.pages());
        pwPage = allPages.find(p => !p.url().startsWith('chrome:')) || allPages[0];
    } catch (e) { setTimeout(connectPlaywright, 5000); }
}
setTimeout(connectPlaywright, 5000);

// ─────────────────── Ghost Streamer (FFMPEG) ───────────────────
function startGhostStreamer() {
    console.log('[Ghost] Starting FFMPEG Streamer (1280x720)...');
    const streamer = spawn('ffmpeg', [
        '-f', 'x11grab', '-r', '10', '-s', '1280x720', '-i', ':99',
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
    streamer.on('close', () => {
        console.log('[Ghost] FFMPEG closed, restarting in 5s...');
        setTimeout(startGhostStreamer, 5000);
    });
}
setTimeout(startGhostStreamer, 7000);

// ─────────────────── API Endpoints ───────────────────
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

app.get('/api/debug', (req, res) => {
    res.json({ status: lastActionStatus, playwright: pwPage ? 'OK' : 'Connecting...', time: new Date() });
});

app.get('/api/screen.jpg', (req, res) => {
    if (!lastFrameBuffer) return res.status(503).send('Loading...');
    res.set('Content-Type', 'image/jpeg').send(lastFrameBuffer);
});

app.post('/api/tasks', (req, res) => {
    const taskId = uuidv4();
    const newTask = { id: taskId, ...req.body, timestamp: Date.now() };
    tasks.push(newTask);
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'NEW_TASK', ...newTask })); });
    res.json({ status: 'SUCCESS', taskId });
});

app.get('/api/tasks/next', (req, res) => {
    res.json(tasks.shift() || null);
});

app.post(['/api/tasks/:id/complete', '/api/results'], (req, res) => {
    const taskId = req.params.id || req.body.taskId;
    taskResults[taskId] = { ...req.body, timestamp: Date.now() };
    res.json({ status: 'OK' });
});

app.get('/api/tasks/:id/result', (req, res) => {
    res.json(taskResults[req.params.id] || { error: 'Not ready' });
});

// ── Routing ──
// خدمة ملفات لوحة التحكم
app.use('/server-static', express.static(path.join(__dirname, 'public')));
app.get('/control', (req, res) => res.sendFile(path.join(__dirname, 'public', 'control.html')));

// الصفحة الرئيسية تعيد التوجيه لصفحة المتصفح مع الاتصال التلقائي
app.get('/', (req, res) => res.redirect('/vnc.html?autoconnect=1&path=websockify&reconnect=1&resize=scale'));


// خدمة ملفات المتصفح (NoVNC) مباشرة من السيرفر
app.use('/', express.static('/opt/novnc'));

// البروكسي للبيانات فقط (WebSocket للـ VNC)
const { createProxyMiddleware } = require('http-proxy-middleware');
app.use('/websockify', createProxyMiddleware({ 
    target: 'http://127.0.0.1:6080', 
    ws: true, 
    changeOrigin: true, 
    logLevel: 'error' 
}));


server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
});

server.listen(PORT, '0.0.0.0', () => console.log(`[Server] Integrated Gateway Ready on port ${PORT}`));

