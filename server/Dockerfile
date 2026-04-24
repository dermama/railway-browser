FROM mcr.microsoft.com/playwright:v1.40.0-jammy

USER root

# V10 STABILITY - LIGHTWEIGHT BUILD
# 1. Install ONLY necessary GUI dependencies efficiently
RUN apt-get update && apt-get install -y \
    nginx xvfb fluxbox dbus-x11 ffmpeg xdotool procps x11-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Configure Nginx
COPY nginx.conf /etc/nginx/sites-available/default

# 3. Setup Node.js app
COPY package.json .
RUN npm install

# 4. Copy and set permissions
COPY . .
RUN chmod -R 777 /app
RUN chmod +x start.sh

ENV GHOST_VERSION=V10_STABLE

EXPOSE 7860
CMD ["./start.sh"]









# BUILD_TRIGGER_PLAYWRIGHT: 1776630538.0011294
