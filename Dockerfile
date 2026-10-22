FROM node:22.23.4-bookworm-slim

WORKDIR /app
COPY package.json /tmp/portfolio-package.json
RUN npm install --global "$(node -p 'require("/tmp/portfolio-package.json").packageManager')" \
    && rm /tmp/portfolio-package.json
