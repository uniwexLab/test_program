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
  
  logInfo('Building program with Anchor...');
  logInfo('Note: OtterSec will rebuild in their Docker container for verification');
  
  try {
    const env = {
      ...process.env,
      ANCHOR_PROVIDER_URL: MAINNET_RPC,
    };
    // Use --locked flag for reproducible builds (as per Solana docs)
    execSync('anchor build --locked', {
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

async function deployProgram(connection, deployerKeypair, programKeypair) {
  logSection('Deploying Program to Mainnet');
  
  const soPath = path.join(__dirname, 'target', 'deploy', 'test_program.so');
  
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
    execSync(
      `solana program deploy --program-id ${PROGRAM_KEYPAIR_PATH} --keypair ${DEPLOYER_KEYPAIR_PATH} --url "${MAINNET_RPC}" --use-rpc --commitment confirmed ${soPath}`,
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

