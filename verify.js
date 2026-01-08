#!/usr/bin/env node

/**
 * Verification Script for Test Program
 * Verifies the program via OtterSec API
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROGRAM_ID = 'GZzqLG5WuHm9fipCh5PsEyo841F7Kbz9YvNRYynQQY2Z';
const REPO_URL = process.env.REPO_URL || 'https://github.com/uniwexLab/test_program_verify';

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  ${title}`, 'blue');
  log(`${'='.repeat(60)}`, 'blue');
}

async function getCommitHash() {
  try {
    const commitHash = execSync('git rev-parse HEAD', {
      cwd: __dirname,
      encoding: 'utf8'
    }).trim();
    return commitHash;
  } catch (error) {
    log('⚠️  Not a git repository, using placeholder commit', 'yellow');
    return '0000000000000000000000000000000000000000';
  }
}

async function verifyViaOtterSec() {
  logSection('Verifying via OtterSec API');
  
  const commitHash = await getCommitHash();
  
  log(`Repository: ${REPO_URL}`);
  log(`Program ID: ${PROGRAM_ID}`);
  log(`Commit: ${commitHash}`);
  log(`Library: test_program`);
  
  log('\nSending verification request...');
  
  try {
    const response = execSync(
      `curl -X POST https://verify.osec.io/verify -H "Content-Type: application/json" -d '{"repository": "${REPO_URL}", "program_id": "${PROGRAM_ID}", "commit_hash": "${commitHash}", "lib_name": "test_program"}'`,
      { encoding: 'utf8' }
    );
    
    const result = JSON.parse(response);
    log(`\n✅ Verification request submitted!`, 'green');
    log(`Request ID: ${result.request_id}`);
    log(`Status: ${result.status}`);
    
    log('\n📋 Check status with:');
    log(`curl https://verify.osec.io/status/${PROGRAM_ID} | jq`);
    log('\n📋 Check logs with:');
    log(`curl https://verify.osec.io/logs/${PROGRAM_ID} | jq`);
    
    return result;
  } catch (error) {
    log(`❌ Verification request failed: ${error.message}`, 'red');
    throw error;
  }
}

async function checkStatus() {
  logSection('Checking Verification Status');
  
  try {
    const response = execSync(
      `curl -s https://verify.osec.io/status/${PROGRAM_ID}`,
      { encoding: 'utf8' }
    );
    
    const status = JSON.parse(response);
    
    if (status.is_verified) {
      log('✅ Program is VERIFIED!', 'green');
    } else {
      log('⏳ Program verification in progress or not verified', 'yellow');
    }
    
    console.log(JSON.stringify(status, null, 2));
    
    return status;
  } catch (error) {
    log(`❌ Failed to check status: ${error.message}`, 'red');
    throw error;
  }
}

async function main() {
  const command = process.argv[2];
  
  if (command === 'status') {
    await checkStatus();
  } else {
    await verifyViaOtterSec();
    log('\n💡 Run "node verify.js status" to check verification status');
  }
}

if (require.main === module) {
  main();
}

module.exports = { verifyViaOtterSec, checkStatus };

