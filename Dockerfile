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
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# إعداد واجهة NoVNC الأساسية
RUN cp -r /usr/share/novnc /opt/novnc && \
    cp /opt/novnc/vnc.html /opt/novnc/index.html

# نسخ ملف التشغيل
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# الرابط الافتراضي (سنقوم بتغييره من إعدادات Railway لاحقاً)
ENV SITE_URL="https://google.com"

# أمر بدء الحاوية
CMD ["/app/start.sh"]
