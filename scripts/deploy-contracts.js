#!/usr/bin/env node

/**
 * Deploy Stellar LABS Contracts Script
 * 
 * This script deploys the LABS registry contracts to the Stellar network
 * and sets up the necessary configuration for the platform.
 */

const LABSContract = require('../contracts/stellar/LABSContract');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const config = {
  network: process.env.STELLAR_NETWORK || 'TESTNET',
  horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  deployerSecret: process.env.DEPLOYER_SECRET_KEY,
  configPath: path.join(__dirname, '../config/contracts.json')
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step) {
  log(`\n🔷 Step ${step}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Create config directory if it doesn't exist
function ensureConfigDir() {
  const configDir = path.dirname(config.configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// Save contract configuration
function saveContractConfig(contractInfo) {
  ensureConfigDir();
  
  const contractConfig = {
    network: config.network,
    horizonUrl: config.horizonUrl,
    contractAddress: contractInfo.contractAddress,
    contractSecret: contractInfo.contractSecret,
    deployedAt: new Date().toISOString(),
    version: '1.0.0'
  };
  
  fs.writeFileSync(config.configPath, JSON.stringify(contractConfig, null, 2));
  logSuccess(`Contract configuration saved to ${config.configPath}`);
}

// Load existing contract configuration
function loadContractConfig() {
  if (fs.existsSync(config.configPath)) {
    const configData = fs.readFileSync(config.configPath, 'utf8');
    return JSON.parse(configData);
  }
  return null;
}

// Deploy contracts
async function deployContracts() {
  log('🚀 Deploying Stellar LABS Registry Contracts', 'bright');
  log(`Network: ${config.network}`, 'blue');
  log(`Horizon URL: ${config.horizonUrl}`, 'blue');

  // Check if contracts are already deployed
  const existingConfig = loadContractConfig();
  if (existingConfig && existingConfig.network === config.network) {
    logWarning('Contracts already deployed on this network');
    log(`Contract Address: ${existingConfig.contractAddress}`, 'yellow');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('Do you want to redeploy? (y/N): ', resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() !== 'y') {
      log('Using existing contract configuration', 'green');
      return existingConfig;
    }
  }

  // Check deployer secret key
  if (!config.deployerSecret) {
    logError('DEPLOYER_SECRET_KEY environment variable is required');
    log('Set it in your .env file:', 'yellow');
    log('DEPLOYER_SECRET_KEY=your-secret-key-here', 'cyan');
    process.exit(1);
  }

  try {
    logStep('1: Initializing contract deployment');
    const contract = new LABSContract(config.horizonUrl);
    
    logStep('2: Deploying LABS Registry contract');
    const deploymentResult = await contract.deploy(config.deployerSecret);
    
    logSuccess('Contract deployed successfully!');
    log(`Contract Address: ${deploymentResult.contractAddress}`, 'blue');
    log(`Transaction Hash: ${deploymentResult.transactionHash}`, 'blue');
    
    logStep('3: Saving contract configuration');
    saveContractConfig(deploymentResult);
    
    logStep('4: Verifying contract deployment');
    const contractInfo = await contract.getContractInfo();
    
    logSuccess('Contract verification completed!');
    log(`Contract Type: ${contractInfo.type}`, 'blue');
    log(`Contract Version: ${contractInfo.version}`, 'blue');
    log(`Data Entries: ${contractInfo.dataEntries}`, 'blue');
    
    logStep('5: Setting up environment variables');
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add LABS_CONTRACT_ADDRESS
    if (envContent.includes('LABS_CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(
        /LABS_CONTRACT_ADDRESS=.*/,
        `LABS_CONTRACT_ADDRESS=${deploymentResult.contractAddress}`
      );
    } else {
      envContent += `\nLABS_CONTRACT_ADDRESS=${deploymentResult.contractAddress}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    logSuccess('Environment variables updated');
    
    log('\n🎉 Contract deployment completed successfully!', 'bright');
    log('\nNext steps:', 'cyan');
    log('1. Start the backend: npm run start:backend', 'yellow');
    log('2. Start the frontend: npm run start:frontend', 'yellow');
    log('3. Or start both: npm run start:all', 'yellow');
    
    return deploymentResult;
    
  } catch (error) {
    logError(`Contract deployment failed: ${error.message}`);
    
    if (error.message.includes('insufficient balance')) {
      log('\n💡 Tip: Make sure your deployer account has enough XLM', 'yellow');
      log('For testnet, you can fund your account at: https://friendbot.stellar.org', 'cyan');
    }
    
    process.exit(1);
  }
}

// Fund testnet account
async function fundAccount(publicKey) {
  if (config.network !== 'TESTNET') {
    logWarning('Account funding only available on testnet');
    return;
  }
  
  try {
    log(`Funding testnet account: ${publicKey}`, 'blue');
    
    const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
    const result = await response.json();
    
    if (response.ok) {
      logSuccess('Account funded successfully!');
      log(`Transaction Hash: ${result.hash}`, 'blue');
    } else {
      logError(`Failed to fund account: ${result.detail}`);
    }
  } catch (error) {
    logError(`Account funding failed: ${error.message}`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'deploy':
      await deployContracts();
      break;
      
    case 'fund':
      const publicKey = args[1];
      if (!publicKey) {
        logError('Please provide a public key to fund');
        log('Usage: npm run deploy:contracts fund <public-key>', 'yellow');
        process.exit(1);
      }
      await fundAccount(publicKey);
      break;
      
    case 'status':
      const contractConfig = loadContractConfig();
      if (contractConfig) {
        log('Contract Status:', 'bright');
        log(`Network: ${contractConfig.network}`, 'blue');
        log(`Contract Address: ${contractConfig.contractAddress}`, 'blue');
        log(`Deployed At: ${contractConfig.deployedAt}`, 'blue');
      } else {
        logWarning('No contract configuration found');
        log('Run "npm run deploy:contracts deploy" to deploy contracts', 'yellow');
      }
      break;
      
    default:
      log('Stellar LABS Contract Deployment Tool', 'bright');
      log('\nUsage:', 'cyan');
      log('  npm run deploy:contracts deploy    - Deploy contracts', 'yellow');
      log('  npm run deploy:contracts fund <pk>  - Fund testnet account', 'yellow');
      log('  npm run deploy:contracts status    - Check contract status', 'yellow');
      break;
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    logError(`Script failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  deployContracts,
  fundAccount,
  loadContractConfig,
  saveContractConfig
};
