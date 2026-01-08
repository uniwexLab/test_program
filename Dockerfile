# Dockerfile for verifiable Solana program build with Anchor
# Based on official Solana documentation: https://solana.com/ru/docs/programs/verified-builds
# This ensures reproducible builds for verification

FROM rust:1.75.0

# Install system dependencies
RUN apt-get update && \
    apt-get install -y \
    pkg-config \
    libudev-dev \
    build-essential \
    libssl-dev \
    ca-certificates \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Solana CLI (version compatible with Anchor 0.31.1)
# Anchor 0.31.1 works with Solana 1.18.x
ENV SOLANA_VERSION=1.18.0
RUN sh -c "$(curl -sSfL https://release.solana.com/v${SOLANA_VERSION}/install)" && \
    export PATH="/root/.local/share/solana/install/active_release/bin:$PATH" && \
    solana --version

# Install Anchor CLI 0.31.1
ENV ANCHOR_VERSION=0.31.1
RUN cargo install --git https://github.com/coral-xyz/anchor avm --locked --force && \
    /root/.cargo/bin/avm install ${ANCHOR_VERSION} && \
    /root/.cargo/bin/avm use ${ANCHOR_VERSION}

# Install solana-verify CLI for verified builds
# According to official docs: https://solana.com/ru/docs/programs/verified-builds
RUN cargo install --git https://github.com/anza-xyz/verified-builds solana-verify --locked

# Set working directory
WORKDIR /project

# Copy project files
COPY Anchor.toml Cargo.toml Cargo.lock ./
COPY programs/test_program/Cargo.toml ./programs/test_program/
COPY programs/test_program/src ./programs/test_program/src

# Set environment variables
ENV PATH="/root/.local/share/solana/install/active_release/bin:/root/.cargo/bin:$PATH"
ENV ANCHOR_VERSION=${ANCHOR_VERSION}

# Build the program with Anchor
# Using --locked flag for reproducible builds (as per official docs)
RUN anchor build --locked

# The output will be in target/deploy/test_program.so
