FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# تثبيت الحزم: شاشة وهمية، سيرفر VNC، مدير نوافذ، NoVNC لعرضه في الويب، ومتصفح كروميوم
RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    fluxbox \
    novnc \
    websockify \
    chromium \
    curl \
    gnupg \
    ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app

# إعداد واجهة NoVNC الأساسية
RUN cp -r /usr/share/novnc /opt/novnc && \
    cp /opt/novnc/vnc.html /opt/novnc/index.html

# نسخ السيرفر وتثبيت مكتباته
COPY server /app/server
RUN cd /app/server && npm install

# نسخ ملف التشغيل والملحقات
COPY extension /app/extension
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# الرابط الافتراضي (سنقوم بتغييره من إعدادات Railway لاحقاً)
ENV SITE_URL="https://google.com"

# أمر بدء الحاوية
CMD ["/app/start.sh"]
