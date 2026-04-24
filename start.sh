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
         "$SITE_URL" &

# 5. تشغيل سيرفر Node.js (الخلفية)
echo "Starting Node.js Server..."
cd /app/server && node index.js &

# 6. تشغيل واجهة الويب (NoVNC) كاحتياط على بورت مختلف
# ملاحظة: Railway سيوجه الحركة للسيرفر (البورت الأساسي)
echo "Starting NoVNC (Secondary) on port 6080..."
websockify --web /opt/novnc 6080 localhost:5900
