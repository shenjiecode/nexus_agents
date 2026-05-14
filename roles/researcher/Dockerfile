# Auto-generated Dockerfile for role: researcher
# Build: podman build -t nexus-role-researcher:v1.0.0 .

# Use base image (pre-built with OpenCode CLI)
ARG BASE_IMAGE=localhost/nexus-base:latest
FROM ${BASE_IMAGE}

# Copy role configuration
COPY opencode.json /app/opencode.json
COPY prompts/ /app/prompts/
COPY .opencode/ /app/.opencode/

# Note: auth.json is mounted at runtime, not baked into image
# Set working directory
WORKDIR /workspace

# Expose OpenCode Serve port
EXPOSE 4096

# Entrypoint is inherited from base image
