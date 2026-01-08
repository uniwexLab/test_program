#!/bin/bash

# Script to build verifiable Solana program using Docker
# Based on official Solana documentation: https://solana.com/ru/docs/programs/verified-builds
# This creates a reproducible build for verification

set -e

echo "=========================================="
echo "Building verifiable Solana program"
echo "Based on official Solana docs"
echo "=========================================="
echo ""

# Ensure target directory exists
mkdir -p target/deploy

echo "Step 1: Building Docker image..."
echo "This ensures deterministic build environment"
docker build -t test_program-verifiable-build -f Dockerfile .

echo ""
echo "Step 2: Extracting built binary..."
# Create container and copy the built .so file
docker create --name test_program-container test_program-verifiable-build
docker cp test_program-container:/project/target/deploy/test_program.so ./target/deploy/test_program.so
docker rm test_program-container

echo ""
echo "✅ Verifiable build complete!"
echo "Binary location: ./target/deploy/test_program.so"
echo ""

# Show file info
if [ -f "./target/deploy/test_program.so" ]; then
    SIZE=$(ls -lh ./target/deploy/test_program.so | awk '{print $5}')
    echo "Binary size: $SIZE"
    
    # Calculate SHA256 hash
    if command -v shasum &> /dev/null; then
        HASH=$(shasum -a 256 ./target/deploy/test_program.so | awk '{print $1}')
        echo "SHA256 hash: $HASH"
    elif command -v sha256sum &> /dev/null; then
        HASH=$(sha256sum ./target/deploy/test_program.so | awk '{print $1}')
        echo "SHA256 hash: $HASH"
    fi
fi

echo ""
echo "📋 Next steps:"
echo "1. Deploy this binary to mainnet"
echo "2. Verify via OtterSec API or solana-verify CLI"
echo ""
echo "For verification, you can use:"
echo "  - OtterSec API: node verify.js"
echo "  - solana-verify CLI: solana-verify verify-from-repo <repo-url>"
echo ""
echo "Reference: https://solana.com/ru/docs/programs/verified-builds"
