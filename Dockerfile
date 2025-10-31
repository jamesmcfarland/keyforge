FROM node:20-alpine

RUN apk add --no-cache \
    curl \
    bash

# Detect architecture and install kubectl
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then ARCH="amd64"; \
    elif [ "$ARCH" = "aarch64" ]; then ARCH="arm64"; fi && \
    echo "Installing kubectl for architecture: $ARCH" && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/${ARCH}/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

# Detect architecture and install helm
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then ARCH="amd64"; \
    elif [ "$ARCH" = "aarch64" ]; then ARCH="arm64"; fi && \
    echo "Installing helm for architecture: $ARCH" && \
    curl -fsSL https://get.helm.sh/helm-v3.16.4-linux-${ARCH}.tar.gz | tar xz && \
    mv linux-${ARCH}/helm /usr/local/bin/helm && \
    rm -rf linux-${ARCH}

RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["pnpm", "run", "dev"]
