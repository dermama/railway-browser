#!/bin/bash

# 1. إعداد الشاشة الوهمية (Xvfb)
export DISPLAY=:99
Xvfb :99 -screen 0 1280x800x24 &
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
         --disable-gpu \
         --load-extension=/app/extension \
         --remote-debugging-port=9222 \
         --window-position=0,0 \
         --window-size=1280,800 \
         --start-maximized \
         "http://localhost:7000" \
         "$SITE_URL" &

# 6. تشغيل جسر NoVNC على بورت داخلي (6080)
echo "Starting NoVNC bridge on port 6080..."
websockify --web /opt/novnc 6080 localhost:5900 &
sleep 2

# 7. إعداد وتشغيل Nginx ليكون هو الواجهة الأساسية (على بورت Railway)
echo "Configuring Nginx on port $PORT..."
envsubst '${PORT}' < /app/server/nginx.conf > /etc/nginx/sites-available/default
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# تشغيل Nginx في الواجهة الأمامية لإبقاء الحاوية تعمل
nginx -g 'daemon off;'
