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

# 5. تشغيل سيرفر Node.js (الخلفية) على بورت داخلي 3000
echo "Starting Node.js Server on internal port 3000..."
# نحفظ البورت الأصلي الذي أعطاه Railway
export REAL_PORT=$PORT
export PORT=3000
cd /app/server && node index.js &

# 6. تشغيل NoVNC على بورت داخلي 6080
echo "Starting NoVNC on port 6080..."
/opt/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 6080 &
sleep 2

# 7. تشغيل Nginx ليكون هو الواجهة الأساسية (يوجه الحركة للمتصفح وللسيرفر)
echo "Configuring Nginx to use port $REAL_PORT..."
export PORT=$REAL_PORT
envsubst '$PORT' < /app/server/nginx.conf > /etc/nginx/sites-available/default
service nginx start

# البقاء قيد التشغيل لمراقبة اللوجات
tail -f /dev/null
