#!/bin/bash

# 1. إعداد الشاشة الوهمية (Xvfb)
export DISPLAY=:99
Xvfb :99 -screen 0 1280x720x16 &
sleep 2

# 2. تشغيل مدير النوافذ (ضروري لترتيب النوافذ المفتوحة داخل المتصفح)
fluxbox &
sleep 1

# 3. تشغيل سيرفر الـ VNC الداخلي بدون باسورد
x11vnc -display :99 -nopw -forever -shared -bg &
sleep 2

# 4. تشغيل سيرفر Node.js في الخلفية
echo "Starting Node.js Server..."
cd /app/server && node index.js &
sleep 5

# 5. تشغيل المتصفح وفتحه على رابط موقعك ولوحة التحكم
# أضفنا --remote-debugging-port=9222 ليتمكن السيرفر من التحكم بالمتصفح
chromium --no-sandbox \
         --disable-dev-shm-usage \
         --disable-popup-blocking \
         --load-extension=/app/extension \
         --remote-debugging-port=9222 \
         --window-position=0,0 \
         --window-size=1280,720 \
         --start-maximized \
         "http://localhost:3000/control" \
         "$SITE_URL" &

# 6. تشغيل واجهة الويب (NoVNC) لربطها بموقع Railway
PORT=${PORT:-8080}
echo "Starting NoVNC on port $PORT..."
websockify --web /opt/novnc $PORT localhost:5900
