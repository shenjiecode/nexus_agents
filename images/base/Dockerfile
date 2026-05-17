# Nexus Base Image
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Aliyun apt mirror
RUN echo 'Types: deb\n\
URIs: http://mirrors.aliyun.com/ubuntu\n\
Suites: noble noble-updates noble-backports\n\
Components: main restricted universe multiverse\n\
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n\
\n\
Types: deb\n\
URIs: http://mirrors.aliyun.com/ubuntu\n\
Suites: noble-security\n\
Components: main restricted universe multiverse\n\
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg' > /etc/apt/sources.list.d/ubuntu.sources && \
    rm -f /etc/apt/sources.list

# Install Node.js 24
RUN apt-get update && apt-get install -y \
    curl ca-certificates gnupg git \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Configure npm to use npmmirror
RUN npm config set registry https://registry.npmmirror.com

# Install global tools
RUN npm install -g opencode-ai tsx

# Create directories
RUN mkdir -p /workspace /data/matrix /workspace/.opencode/skills

# Copy entrypoint
COPY images-base/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Copy agent package.json and install dependencies
COPY agent/package.json /app/package.json
RUN cd /app && npm install --omit=dev --registry=https://registry.npmmirror.com

# Copy agent source
COPY agent/src/ /app/

EXPOSE 4096
WORKDIR /workspace
ENTRYPOINT ["/entrypoint.sh"]
