FROM node:22.23.4-bookworm-slim

WORKDIR /app
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
COPY package.json /tmp/portfolio-toolchain/package.json
COPY scripts/setup-npm.sh /tmp/portfolio-toolchain/scripts/setup-npm.sh
COPY scripts/npm-security/ /tmp/portfolio-toolchain/scripts/npm-security/
RUN sh /tmp/portfolio-toolchain/scripts/setup-npm.sh \
    && rm -rf /tmp/portfolio-toolchain
