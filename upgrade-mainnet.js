#!/usr/bin/env node

/**
 * Upgrade Script for Test Program
 * Updates an existing program on mainnet
 */

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const MAINNET_RPC = process.env.MAINNET_RPC || 'https://mainnet.helius-rpc.com/?api-key=166b1a82-622e-44cc-b3c8-b0f36a4bc100';
const DEPLOYER_KEYPAIR_PATH = process.env.DEPLOYER_KEYPAIR || path.join(process.env.HOME, '.config/solana/id.json');
const PROGRAM_KEYPAIR_PATH = path.join(__dirname, 'target', 'deploy', 'test_program-keypair.json');
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

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function checkPrerequisites() {
  logSection('Checking Prerequisites');
  
  // Check if deployer keypair exists
  if (!fs.existsSync(DEPLOYER_KEYPAIR_PATH)) {
    logError(`Deployer keypair not found at: ${DEPLOYER_KEYPAIR_PATH}`);
    process.exit(1);
  }
  
  const deployerKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(DEPLOYER_KEYPAIR_PATH)))
  );
  const deployerAddress = deployerKeypair.publicKey.toString();
  logSuccess(`Deployer wallet: ${deployerAddress}`);
  
  // Verify expected deployer address
  const EXPECTED_DEPLOYER = 'CrCoo582AQi2nciHM73yisYmV1Gk7SMSe5CcMM14jSW8';
  if (deployerAddress !== EXPECTED_DEPLOYER) {
    logError(`Deployer address mismatch!`);
    logError(`Expected: ${EXPECTED_DEPLOYER}`);
    logError(`Got: ${deployerAddress}`);
    logError('Please check your DEPLOYER_KEYPAIR path');
    process.exit(1);
  }
  logSuccess(`✓ Deployer address verified: ${EXPECTED_DEPLOYER}`);
  
  // Check connection
  const connection = new Connection(MAINNET_RPC, 'confirmed');
  const balance = await connection.getBalance(deployerKeypair.publicKey);
  const balanceSOL = balance / 1e9;
  
  logInfo(`Deployer balance: ${balanceSOL.toFixed(4)} SOL`);
  
  // Check if program exists
  const programInfo = await connection.getAccountInfo(PROGRAM_ID);
  if (!programInfo || !programInfo.executable) {
    logError(`Program not found or not executable at: ${PROGRAM_ID.toString()}`);
    logInfo('Make sure the program is deployed first');
    process.exit(1);
  }
  
  logSuccess(`Program found: ${PROGRAM_ID.toString()}`);
  logInfo(`Program owner: ${programInfo.owner.toString()}`);
  
  // Check if program is upgradeable
  if (programInfo.owner.toString() === 'BPFLoaderUpgradeab1e11111111111111111111111') {
    logSuccess('Program is upgradeable');
  } else {
    logWarning('Program owner is not BPFLoaderUpgradeab1e11111111111111111111111');
    logWarning('Program might be immutable (cannot be upgraded)');
  }
  
  return { connection, deployerKeypair };
}

async function buildProgram() {
  logSection('Building Updated Program');
  
  logInfo('Building with Anchor...');
  try {
    const env = {
      ...process.env,
      ANCHOR_PROVIDER_URL: MAINNET_RPC,
    };
    execSync('anchor build', {
      stdio: 'inherit',
      cwd: __dirname,
      env: env
    });
    logSuccess('Build completed successfully');
  } catch (error) {
    logError('Build failed');
    throw error;
  }
  
  // Check if .so file exists
  const soPath = path.join(__dirname, 'target', 'deploy', 'test_program.so');
  if (!fs.existsSync(soPath)) {
    logError(`Program binary not found at: ${soPath}`);
    throw new Error('Program binary not found');
  }
  
  const stats = fs.statSync(soPath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  logInfo(`Program size: ${sizeKB} KB`);
  
  return soPath;
}

async function upgradeProgram(connection, deployerKeypair) {
  logSection('Upgrading Program on Mainnet');
  
  const soPath = path.join(__dirname, 'target', 'deploy', 'test_program.so');
  
  logInfo('Upgrading program...');
  logInfo(`Using RPC: ${MAINNET_RPC}`);
  logWarning('This will cost SOL. Make sure you have enough balance.');
  logWarning('The program will be updated with new code.');
  
  try {
    // Set environment variables for RPC
    const env = {
      ...process.env,
      SOLANA_CLUSTER_URL: MAINNET_RPC,
      ANCHOR_PROVIDER_URL: MAINNET_RPC,
    };
    
    // Use solana program deploy for upgrade with explicit RPC URL
    execSync(
      `solana program deploy --program-id ${PROGRAM_KEYPAIR_PATH} --keypair ${DEPLOYER_KEYPAIR_PATH} --url "${MAINNET_RPC}" --use-rpc --commitment confirmed ${soPath}`,
      {
        stdio: 'inherit',
        cwd: __dirname,
        env: env
      }
    );
    
    logSuccess('Program upgraded successfully!');
    
    // Verify upgrade
    const programInfo = await connection.getAccountInfo(PROGRAM_ID);
    if (programInfo && programInfo.executable) {
      logSuccess(`Program is executable at: ${PROGRAM_ID.toString()}`);
      logInfo(`Program data length: ${programInfo.data.length} bytes`);
    } else {
      logError('Program upgrade verification failed');
      throw new Error('Program not found on-chain');
    }
    
    return PROGRAM_ID;
  } catch (error) {
    logError('Upgrade failed');
    throw error;
  }
}

async function main() {
  try {
    logSection('Test Program Mainnet Upgrade');
    
    const { connection, deployerKeypair } = await checkPrerequisites();
    const soPath = await buildProgram();
    const programId = await upgradeProgram(connection, deployerKeypair);
    
    logSection('Upgrade Summary');
    logSuccess(`Program ID: ${programId.toString()}`);
    logSuccess(`Deployer: ${deployerKeypair.publicKey.toString()}`);
    logInfo(`RPC: ${MAINNET_RPC}`);
    logInfo('\nNext steps:');
    logInfo('1. Verify the program on Solscan');
    logInfo('2. Run verification via OtterSec API');
    
  } catch (error) {
    logError(`Upgrade failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

