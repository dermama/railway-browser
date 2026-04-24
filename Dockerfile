FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# تثبيت الحزم: شاشة وهمية، سيرفر VNC، مدير نوافذ، NoVNC لعرضه في الويب، ومتصفح كروميوم
# تثبيت الحزم الأساسية: شاشة وهمية، سيرفر VNC، مدير نوافذ، NoVNC، متصفح كروميوم، Node.js، ffmpeg، xdotool، و Nginx
RUN apt-get update && apt-get install -y \
    curl \
    xvfb \
    x11vnc \
    fluxbox \
    novnc \
    websockify \
    chromium \
    ffmpeg \
    xdotool \
    nginx \
    gettext-base \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# إعداد واجهة NoVNC الأساسية
RUN cp -r /usr/share/novnc /opt/novnc && \
    cp /opt/novnc/vnc.html /opt/novnc/index.html

# نسخ ملف التشغيل والملحقات والسيرفر
COPY extension /app/extension
COPY server /app/server
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# تثبيت اعتماديات السيرفر
RUN cd /app/server && npm install

# الرابط الافتراضي (سنقوم بتغييره من إعدادات Railway لاحقاً)
ENV SITE_URL="https://google.com"

# أمر بدء الحاوية
CMD ["/app/start.sh"]
