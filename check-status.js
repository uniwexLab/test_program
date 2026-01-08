#!/usr/bin/env node

/**
 * Check Program Status Script
 * Checks program status and deployer balance using Helius RPC
 */

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Configuration
const MAINNET_RPC = process.env.MAINNET_RPC || 'https://mainnet.helius-rpc.com/?api-key=166b1a82-622e-44cc-b3c8-b0f36a4bc100';
const DEPLOYER_KEYPAIR_PATH = process.env.DEPLOYER_KEYPAIR || path.join(process.env.HOME, '.config/solana/id.json');
const PROGRAM_ID = new PublicKey('GZzqLG5WuHm9fipCh5PsEyo841F7Kbz9YvNRYynQQY2Z');

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  ${title}`, 'blue');
  log(`${'='.repeat(60)}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function checkStatus() {
  logSection('Program Status Check');
  
  logInfo(`RPC: ${MAINNET_RPC}`);
  
  // Check deployer
  if (!fs.existsSync(DEPLOYER_KEYPAIR_PATH)) {
    logError(`Deployer keypair not found at: ${DEPLOYER_KEYPAIR_PATH}`);
    process.exit(1);
  }
  
  const deployerKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(DEPLOYER_KEYPAIR_PATH)))
  );
  const deployerAddress = deployerKeypair.publicKey.toString();
  logInfo(`Deployer: ${deployerAddress}`);
  
  // Check connection
  const connection = new Connection(MAINNET_RPC, 'confirmed');
  logInfo('Connecting to mainnet...');
  
  try {
    // Check deployer balance
    const balance = await connection.getBalance(deployerKeypair.publicKey);
    const balanceSOL = balance / 1e9;
    logSuccess(`Deployer balance: ${balanceSOL.toFixed(4)} SOL`);
    
    // Check program status
    logInfo(`Checking program: ${PROGRAM_ID.toString()}`);
    const programInfo = await connection.getAccountInfo(PROGRAM_ID);
    
    if (!programInfo) {
      logError('Program not found on-chain');
      logInfo('Program has not been deployed yet');
    } else if (programInfo.executable) {
      logSuccess('Program is deployed and executable');
      logInfo(`Program owner: ${programInfo.owner.toString()}`);
      logInfo(`Program data length: ${programInfo.data.length} bytes`);
      logInfo(`Program lamports: ${programInfo.lamports / 1e9} SOL`);
      
      if (programInfo.owner.toString() === 'BPFLoaderUpgradeab1e11111111111111111111111') {
        logSuccess('Program is upgradeable');
      } else {
        logInfo('Program owner: ' + programInfo.owner.toString());
      }
    } else {
      logError('Program account exists but is not executable');
    }
    
    // Get slot
    const slot = await connection.getSlot();
    logInfo(`Current slot: ${slot}`);
    
  } catch (error) {
    logError(`Failed to check status: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  checkStatus();
}

module.exports = { checkStatus };

