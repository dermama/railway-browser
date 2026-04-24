#!/bin/bash

echo "[Startup] Initializing Ghost V10 - MINIMALIST HARDENED..."

# 0. Cleanup - Aggressive wipe
pkill -9 chrome || true
pkill -9 Xvfb || true
pkill -9 node || true
pkill -9 ffmpeg || true
rm -rf /tmp/.X99-lock /tmp/.X11-unix /tmp/chrome-user-data || true

export DISPLAY=:99
export XDG_RUNTIME_DIR=/tmp/runtime-root
mkdir -p $XDG_RUNTIME_DIR
chmod 700 $XDG_RUNTIME_DIR

# 1. Start Xvfb - CLEAN
Xvfb :99 -screen 0 1280x800x24 -ac -nolisten tcp > /tmp/xvfb.log 2>&1 &
XV_PID=$!
sleep 2

fluxbox -display :99 > /tmp/fluxbox.log 2>&1 &
FLUX_PID=$!
sleep 1

# 3. Start DBUS
eval $(dbus-launch --sh-syntax)
export DBUS_SESSION_BUS_ADDRESS

# 4. FIXED PLAYWRIGHT PATH (Validated from previous traces)
CHROMIUM_BIN="/ms-playwright/chromium-1217/chrome-linux64/chrome"
if [ ! -f "$CHROMIUM_BIN" ]; then
    echo "[Error] Binary not at fixed path. Searching..."
    CHROMIUM_BIN=$(find /ms-playwright -name chrome | grep -E "linux64|linux" | head -n 1)
fi
echo "[Startup] Final Browser Path: $CHROMIUM_BIN"
export CHROMIUM_BIN

# 5. Start Nginx & Node
service nginx start
node index.js > /tmp/node.log 2>&1 &
NODE_PID=$!

# 6. Stability Monitor
(
  while true; do
    echo "[Monitor] Fresh start: Launching Chromium V10..."
    rm -rf /tmp/chrome-user-data
    mkdir -p /tmp/chrome-user-data
    
    # LAUNCH WITH FULLSCREEN AND STABILITY FLAGS
    "$CHROMIUM_BIN" --no-sandbox \
        --display=:99 \
        --user-data-dir=/tmp/chrome-user-data \
        --window-size=1280,800 \
        --window-position=0,0 \
        --start-maximized \
        --start-fullscreen \
        --kiosk \
        --disable-dev-shm-usage \
        --disable-gpu \
        --disable-software-rasterizer \
        --remote-debugging-port=9222 \
        --remote-debugging-address=0.0.0.0 \
        --load-extension="/app/extension" \
        --disable-extensions-except="/app/extension" \
        --no-first-run \
        --no-default-browser-check \
        --disable-setuid-sandbox \
        --disable-features=IsolateOrigins,site-per-process \
        --force-color-profile=srgb \
        --touch-events=enabled \
        "chrome://extensions" "https://aistudio.google.com" >> /tmp/chromium_err.log 2>&1
    
    sleep 2
  done
) &

while true; do
  if ! ps -p $NODE_PID > /dev/null; then exit 1; fi
  if ! ps -p $XV_PID > /dev/null; then exit 1; fi
  sleep 10
done
