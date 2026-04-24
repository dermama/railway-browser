---
title: AI Fashion Merger V5 Pro
emoji: 👗
colorFrom: pink
colorTo: blue
sdk: docker
pinned: false
---

# AI Fashion Merger - V5 Pro Relay Server

This is the central relay server for the AI Fashion Merger system. It manages task queues and communicates with worker extensions.

## Features
- Task management and relaying
- WebSocket support for real-time status updates
- Automated result submission
- Docker-based environment for headless browser workers

## Configuration
- Port: 7860 (Internal: 3000)
- Workers: Connect via WebSocket to `wss://[SPACE_HOST]/`
- API: `https://[SPACE_HOST]/api/tasks`
