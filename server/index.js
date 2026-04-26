const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ 
    noServer: true,
    maxPayload: 100 * 1024 * 1024 // 100MB
});

// ── WebSocket Heartbeat ──
function heartbeat() { this.isAlive = true; }
setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

const PORT = 7000;
const DISPLAY = ':99';

// ── Global Mediator State ──
let tasks = [];
let taskResults = {};
let lastActionStatus = "System Ready";
let lastFrameBuffer = null;

// ── Minimalist xdotool Interaction ──
function directAction(data) {
    const { action, x, y, key, text } = data;
    let cmd = "";
    if (action === 'click') cmd = `/usr/bin/xdotool mousemove ${x} ${y} click 1`;
    else if (action === 'type') cmd = `/usr/bin/xdotool type '${text.replace(/'/g, "'\\''")}'`;
    else if (action === 'key') cmd = `/usr/bin/xdotool key ${key}`;
    else if (action === 'scroll') cmd = `/usr/bin/xdotool click ${y > 0 ? '5' : '4'}`;

    if (cmd) {
        exec(cmd, { env: { ...process.env, DISPLAY } });
        lastActionStatus = `Executed: ${action}`;
    }
}

// ── FFMPEG Screen Streamer (For VNC Monitor) ──
function startGhostStreamer() {
    console.log('[Ghost] Starting FFMPEG Streamer...');
    const streamer = spawn('ffmpeg', [
        '-f', 'x11grab', '-r', '12', '-s', '1280x800', '-i', DISPLAY,
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
            // Broadcast screen to monitor clients
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

// ── WebSocket Handler ──
wss.on('connection', (ws, req) => {
    console.log('[WS] New connection');
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    
    // تمييز نوع المتصل بناءً على الـ URL أو رسالة تعريفية
    ws.clientType = 'unknown';

    // إرسال المهام المنتظرة فوراً إذا كان المتصل إضافة
    if (tasks.length > 0) {
        tasks.forEach(task => {
            ws.send(JSON.stringify(task));
        });
    }

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'IDENTIFY') {
                ws.clientType = data.client; // 'extension' or 'monitor'
                console.log(`[WS] Client identified as: ${ws.clientType}`);
            }
            if (data.type === 'REMOTE_ACTION') directAction(data);
            if (data.type === 'RESULT_READY') {
                console.log(`[Mediator] Result received for Task ${data.taskId}`);
                taskResults[data.taskId] = { ...data, status: 'COMPLETED', timestamp: Date.now() };
            }
        } catch (e) {}
    });
});

// ── API Endpoints (The Mediator Core) ──

// 1. Receive Task from External Source
app.post('/api/tasks', (req, res) => {
    const taskId = uuidv4();
    const newTask = { 
        id: taskId, 
        taskId: taskId, 
        type: 'TASK_CREATED', 
        status: 'PENDING',
        ...req.body, 
        timestamp: Date.now() 
    };
    tasks.push(newTask);
    
    // Broadcast to connected extensions
    wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(newTask));
    });

    console.log(`[Mediator] New Task Received: ${taskId}`);
    res.json({ status: 'SUCCESS', taskId });
});

// 2. Extension Polls for Tasks (Fallback)
app.get('/api/tasks/next', (req, res) => {
    const task = tasks.shift();
    if (task) {
        task.status = 'PROCESSING';
        console.log(`[Mediator] Task ${task.id} delivered via Polling`);
    }
    res.json(task || null);
});

// 3. Receive Result from Extension (HTTP)
app.post(['/api/results', '/api/tasks/:id/complete'], (req, res) => {
    const taskId = req.params.id || req.body.taskId;
    console.log(`[Mediator] Result posted for Task: ${taskId}`);
    taskResults[taskId] = { ...req.body, status: 'COMPLETED', timestamp: Date.now() };
    res.json({ status: 'OK' });
});

// 4. Get Task Result (For External Source)
app.get('/api/tasks/:id/result', (req, res) => {
    const result = taskResults[req.params.id];
    if (result) res.json(result);
    else res.status(202).json({ status: 'PROCESSING', message: 'Result not ready yet' });
});

// 5. Monitor Stats
app.get('/api/monitor/stats', (req, res) => {
    const clients = Array.from(wss.clients);
    res.json({
        uptime: process.uptime(),
        connected_extensions: clients.filter(c => c.clientType === 'extension').length,
        connected_monitors: clients.filter(c => c.clientType === 'monitor' || c.clientType === 'unknown').length,
        pending_tasks: tasks.length,
        completed_tasks: Object.keys(taskResults).length,
        last_status: lastActionStatus,
        tasks_history: Object.values(taskResults).slice(-5)
    });
});

app.get('/api/debug', (req, res) => {
    res.json({
        status: lastActionStatus,
        extensions: wss.clients.size,
        tasks: tasks.length,
        results: Object.keys(taskResults).length,
        time: new Date().toISOString()
    });
});

// ── Middleware & Static Files ──
app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));
app.use(express.static('public'));

// Route for the new Monitor UI
app.get('/monitor', (req, res) => res.sendFile(path.join(__dirname, 'public', 'monitor.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'monitor.html')));

server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    else socket.destroy();
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Mediator] Server V12 running on port ${PORT}`);
});
