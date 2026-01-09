#!/usr/bin/env node

/**
 * Mainnet Deployment Script for Test Program
 * Simple script to deploy and verify a test program
 */

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const MAINNET_RPC = process.env.MAINNET_RPC || 'https://mainnet.helius-rpc.com/?api-key=166b1a82-622e-44cc-b3c8-b0f36a4bc100';
const DEPLOYER_KEYPAIR_PATH = process.env.DEPLOYER_KEYPAIR || path.join(process.env.HOME, '.config/solana/id.json');
const PROGRAM_KEYPAIR_PATH = path.join(__dirname, 'target', 'deploy', 'test_program-keypair.json');

// Colors for console output
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
  
  // Check if program keypair exists
  if (!fs.existsSync(PROGRAM_KEYPAIR_PATH)) {
    logError(`Program keypair not found at: ${PROGRAM_KEYPAIR_PATH}`);
    process.exit(1);
  }
  
  const programKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(PROGRAM_KEYPAIR_PATH)))
  );
  logSuccess(`Program ID: ${programKeypair.publicKey.toString()}`);
  
  // Check connection
  const connection = new Connection(MAINNET_RPC, 'confirmed');
  const balance = await connection.getBalance(deployerKeypair.publicKey);
  const balanceSOL = balance / 1e9;
  
  logInfo(`Deployer balance: ${balanceSOL.toFixed(4)} SOL`);
  
  if (balanceSOL < 2) {
    logWarning('Low balance! You need at least 2 SOL for deployment.');
  }
  
  return { connection, deployerKeypair, programKeypair };
}

async function buildProgram() {
  logSection('Building Program');
  
  logInfo('Building program with Anchor --verifiable flag...');
  logInfo('This uses Docker to ensure reproducible builds matching OtterSec environment');
  logInfo('Using Cargo.lock for reproducible builds (automatically used by anchor build --verifiable)');
  logInfo('Important: Cargo.lock must be committed to repo for OtterSec verification');
  logWarning('Make sure Docker is running and DNS is configured (check ~/.docker/daemon.json)');
  
  try {
    const env = {
      ...process.env,
      ANCHOR_PROVIDER_URL: MAINNET_RPC,
    };
    // anchor build --verifiable uses Docker to build in the same environment as OtterSec
    // This ensures the deployed binary matches what OtterSec will build from the repo
    // The hash must match for verification to succeed
    execSync('anchor build --verifiable', {
      stdio: 'inherit',
      cwd: __dirname,
      env: env
    });
    logSuccess('Verifiable build completed successfully');
  } catch (error) {
    logError('Verifiable build failed');
    logError('This might be due to:');
    logError('1. Docker not running');
    logError('2. Network/DNS issues in Docker (check ~/.docker/daemon.json)');
    logError('3. Docker daemon needs restart after DNS config changes');
    throw error;
  }
  
  // Check if .so file exists (verifiable build creates it in target/verifiable/)
  const soPath = path.join(__dirname, 'target', 'verifiable', 'test_program.so');
  if (!fs.existsSync(soPath)) {
    logError(`Verifiable program binary not found at: ${soPath}`);
    throw new Error('Verifiable program binary not found');
  }
  
  const stats = fs.statSync(soPath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  logInfo(`Program size: ${sizeKB} KB`);
  
  // Calculate SHA256 hash for verification
  const crypto = require('crypto');
  const fileBuffer = fs.readFileSync(soPath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const hex = hashSum.digest('hex');
  logInfo(`SHA256 hash: ${hex}`);
  logInfo('This hash must match OtterSec build for verification to succeed');
  
  return soPath;
}

async function deployProgram(connection, deployerKeypair, programKeypair) {
  logSection('Deploying Program to Mainnet');
  
  const soPath = path.join(__dirname, 'target', 'verifiable', 'test_program.so');
  
  logInfo('Deploying program...');
  logInfo(`Using RPC: ${MAINNET_RPC}`);
  logWarning('This will cost SOL. Make sure you have enough balance.');
  
  try {
    // Set environment variables for RPC
    const env = {
      ...process.env,
      SOLANA_CLUSTER_URL: MAINNET_RPC,
      ANCHOR_PROVIDER_URL: MAINNET_RPC,
    };
    
    // Use solana program deploy with explicit RPC URL
    // Based on official Solana documentation for verified builds
    // --with-compute-unit-price 50000: recommended low-priority fee
    // --max-sign-attempts 100: retry attempts for signing
    // --use-rpc: use RPC for transaction submission
    execSync(
      `solana program deploy -u "${MAINNET_RPC}" ${soPath} --program-id ${PROGRAM_KEYPAIR_PATH} --keypair ${DEPLOYER_KEYPAIR_PATH} --with-compute-unit-price 50000 --max-sign-attempts 100 --use-rpc --commitment confirmed`,
      {
        stdio: 'inherit',
        cwd: __dirname,
        env: env
      }
    );
    
    logSuccess('Program deployed successfully!');
    
    // Verify deployment
    const programInfo = await connection.getAccountInfo(programKeypair.publicKey);
    if (programInfo && programInfo.executable) {
      logSuccess(`Program is executable at: ${programKeypair.publicKey.toString()}`);
      logInfo(`Program owner: ${programInfo.owner.toString()}`);
    } else {
      logError('Program deployment verification failed');
      throw new Error('Program not found on-chain');
    }
    
    return programKeypair.publicKey;
  } catch (error) {
    logError('Deployment failed');
    throw error;
  }
}

async function main() {
  try {
    logSection('Test Program Mainnet Deployment');
    
    const { connection, deployerKeypair, programKeypair } = await checkPrerequisites();
    const soPath = await buildProgram();
    const programId = await deployProgram(connection, deployerKeypair, programKeypair);
    
    logSection('Deployment Summary');
    logSuccess(`Program ID: ${programId.toString()}`);
    logSuccess(`Deployer: ${deployerKeypair.publicKey.toString()}`);
    logInfo(`RPC: ${MAINNET_RPC}`);
    logInfo('\nNext steps:');
    logInfo('1. Verify the program on Solscan');
    logInfo('2. Run verification via OtterSec API');
    
  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

