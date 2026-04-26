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
let executionLogs = [];
let lastActionStatus = "System Ready";

function addLog(msg) {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log(entry);
    executionLogs.push(entry);
    if (executionLogs.length > 50) executionLogs.shift();
}

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
        addLog(`Input: ${action}`);
    }
}

// ── FFMPEG Screen Streamer ──
function startGhostStreamer() {
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
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    ws.clientType = 'unknown';

    if (tasks.length > 0) {
        addLog(`Pushing ${tasks.length} pending tasks to new connection`);
        tasks.forEach(task => ws.send(JSON.stringify(task)));
    }

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'IDENTIFY') {
                ws.clientType = data.client;
                addLog(`Client Identified: ${ws.clientType}`);
            }
            if (data.type === 'REMOTE_ACTION') directAction(data);
            if (data.type === 'RESULT_READY') {
                addLog(`Result Received for Task: ${data.taskId}`);
                taskResults[data.taskId] = { ...data, status: 'COMPLETED', timestamp: Date.now() };
            }
        } catch (e) {}
    });
});

// ── API Endpoints ──
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
    addLog(`Task Created: ${taskId}`);
    
    wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(newTask));
    });
    res.json({ status: 'SUCCESS', taskId });
});

app.get('/api/tasks/next', (req, res) => {
    const task = tasks.shift();
    if (task) {
        addLog(`Task ${task.id} taken via Polling`);
    }
    res.json(task || null);
});

app.post(['/api/results', '/api/tasks/:id/complete'], (req, res) => {
    const taskId = req.params.id || req.body.taskId;
    addLog(`Result Uploaded for Task: ${taskId}`);
    taskResults[taskId] = { ...req.body, status: 'COMPLETED', timestamp: Date.now() };
    res.json({ status: 'OK' });
});

app.get('/api/monitor/stats', (req, res) => {
    const clients = Array.from(wss.clients);
    res.json({
        uptime: process.uptime(),
        connected_extensions: clients.filter(c => c.clientType === 'extension').length,
        connected_monitors: clients.filter(c => c.clientType === 'monitor' || c.clientType === 'unknown').length,
        pending_tasks: tasks.length,
        completed_tasks: Object.keys(taskResults).length,
        logs: executionLogs
    });
});

app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));
app.use(express.static('public'));
app.get('/monitor', (req, res) => res.sendFile(path.join(__dirname, 'public', 'monitor.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'monitor.html')));

server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    else socket.destroy();
});

server.listen(PORT, '0.0.0.0', () => console.log(`[Mediator] Running on ${PORT}`));
