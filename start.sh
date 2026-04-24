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

# 4. تشغيل المتصفح وفتحه على رابط موقعك
# وضعنا --disable-popup-blocking لكي لا يمنع النوافذ المنبثقة التي يعتمد عليها موقعك
# أضفنا --remote-debugging-port=9222 لكي يتمكن السيرفر من التحكم بالمتصفح
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


# 5. تشغيل واجهة المتصفح (NoVNC) في الخلفية على بورت 6080
echo "Starting NoVNC on port 6080..."
/opt/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 6080 --web /opt/novnc &
sleep 2


# 6. تشغيل السيرفر الأساسي (Gateway) على البورت الذي حدده Railway
# ننتظر قليلاً لضمان أن المتصفح و NoVNC قد استقرا
echo "Waiting 5s for services to stabilize..."
sleep 5
echo "Starting Integrated Node.js Server on port $PORT..."
cd /app/server && node index.js


