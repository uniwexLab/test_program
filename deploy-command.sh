#!/bin/bash

# Deploy verifiable build to mainnet
# Based on official Solana documentation for verified builds

NETWORK_URL="https://mainnet.helius-rpc.com/?api-key=166b1a82-622e-44cc-b3c8-b0f36a4bc100"
PROGRAM_SO="target/verifiable/test_program.so"
PROGRAM_ID="target/deploy/test_program-keypair.json"
DEPLOYER_KEYPAIR="~/.config/solana/id.json"

echo "Deploying test_program to mainnet..."
echo "Program binary: $PROGRAM_SO"
echo "Program ID: $PROGRAM_ID"
echo "Network: $NETWORK_URL"
echo ""

solana program deploy \
  -u "$NETWORK_URL" \
  "$PROGRAM_SO" \
  --program-id "$PROGRAM_ID" \
  --keypair "$DEPLOYER_KEYPAIR" \
  --with-compute-unit-price 50000 \
  --max-sign-attempts 100 \
  --use-rpc \
  --commitment confirmed
