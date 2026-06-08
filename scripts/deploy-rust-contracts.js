#!/usr/bin/env node

/**
 * Deploy Rust Soroban LABS Contracts Script
 * 
 * This script deploys the Rust-based Soroban smart contracts to the Stellar network
 * and provides a comprehensive deployment workflow.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const config = {
  network: process.env.STELLAR_NETWORK || 'TESTNET',
  contractPath: path.join(__dirname, '../contracts/rust'),
  deployerSecret: process.env.DEPLOYER_SECRET_KEY,
  configPath: path.join(__dirname, '../config/rust-contracts.json')
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
    contractId: contractInfo.contractId,
    contractWasm: contractInfo.contractWasm,
    deployedAt: new Date().toISOString(),
    version: '1.0.0',
    type: 'soroban-rust',
    features: [
      'LABS-registry',
      'verifiable-credentials',
      'access-control',
      'optimized-wasm'
    ]
  };
  
  fs.writeFileSync(config.configPath, JSON.stringify(contractConfig, null, 2));
  logSuccess(`Rust contract configuration saved to ${config.configPath}`);
}

// Load existing contract configuration
function loadContractConfig() {
  if (fs.existsSync(config.configPath)) {
    const configData = fs.readFileSync(config.configPath, 'utf8');
    return JSON.parse(configData);
  }
  return null;
}

// Check if Soroban CLI is installed
function checkSorobanCLI() {
  try {
    execSync('soroban --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

// Install Soroban CLI
function installSorobanCLI() {
  logStep('Installing Soroban CLI...');
  
  try {
    const platform = process.platform;
    let installCommand = '';
    
    if (platform === 'linux') {
      installCommand = 'curl -L https://github.com/stellar/soroban/releases/latest/download/soroban-cli-linux-x86_64.tar.gz | tar xz && sudo mv soroban /usr/local/bin/';
    } else if (platform === 'darwin') {
      installCommand = 'curl -L https://github.com/stellar/soroban/releases/latest/download/soroban-cli-macos-x86_64.tar.gz | tar xz && sudo mv soroban /usr/local/bin/';
    } else {
      throw new Error('Unsupported platform for automatic Soroban CLI installation');
    }
    
    execSync(installCommand, { stdio: 'inherit' });
    logSuccess('Soroban CLI installed successfully!');
  } catch (error) {
    logError(`Failed to install Soroban CLI: ${error.message}`);
    log('Please install Soroban CLI manually:', 'yellow');
    log('https://github.com/stellar/soroban/blob/main/docs/installing.md', 'cyan');
    throw error;
  }
}

// Build the Rust contract
function buildContract() {
  logStep('Building Rust contract...');
  
  try {
    process.chdir(config.contractPath);
    
    // Check if Rust is installed
    execSync('rustc --version', { stdio: 'pipe' });
    
    // Install wasm target if not present
    try {
      execSync('rustup target list --installed | grep wasm32-unknown-unknown', { stdio: 'pipe' });
    } catch (error) {
      log('Installing wasm32-unknown-unknown target...', 'yellow');
      execSync('rustup target add wasm32-unknown-unknown', { stdio: 'inherit' });
    }
    
    // Build the contract
    execSync('cargo build --target wasm32-unknown-unknown --release', { stdio: 'inherit' });
    
    logSuccess('Contract built successfully!');
    
    // Check if WASM file exists
    const wasmPath = path.join(config.contractPath, 'target/wasm32-unknown-unknown/release/stellar_LABS_contract.wasm');
    if (!fs.existsSync(wasmPath)) {
      throw new Error('WASM file not found after build');
    }
    
    return wasmPath;
  } catch (error) {
    logError(`Build failed: ${error.message}`);
    throw error;
  }
}

// Optimize WASM file
function optimizeWasm(wasmPath) {
  logStep('Optimizing WASM...');
  
  try {
    const optimizedPath = wasmPath.replace('.wasm', '_opt.wasm');
    
    // Check if wasm-opt is available
    try {
      execSync('wasm-opt --version', { stdio: 'pipe' });
    } catch (error) {
      logWarning('wasm-opt not found. Skipping optimization.');
      return wasmPath;
    }
    
    execSync(`wasm-opt ${wasmPath} -Oz -o ${optimizedPath}`, { stdio: 'inherit' });
    
    // Show size reduction
    const originalSize = fs.statSync(wasmPath).size;
    const optimizedSize = fs.statSync(optimizedPath).size;
    const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
    
    logSuccess(`WASM optimized! Size reduced by ${reduction}%`);
    log(`Original: ${(originalSize / 1024).toFixed(1)} KB`, 'blue');
    log(`Optimized: ${(optimizedSize / 1024).toFixed(1)} KB`, 'blue');
    
    return optimizedPath;
  } catch (error) {
    logWarning(`WASM optimization failed: ${error.message}`);
    return wasmPath;
  }
}

// Deploy contract to network
function deployContract(wasmPath) {
  logStep('Deploying contract to Stellar network...');
  
  try {
    if (!config.deployerSecret) {
      throw new Error('DEPLOYER_SECRET_KEY environment variable is required');
    }
    
    const networkFlag = config.network === 'TESTNET' ? '--network testnet' : '--network futurenet';
    const deployCommand = `soroban contract deploy --wasm ${wasmPath} --source ${config.deployerSecret} ${networkFlag}`;
    
    const output = execSync(deployCommand, { stdio: 'pipe', encoding: 'utf8' });
    
    // Extract contract ID from output
    const contractIdMatch = output.match(/Contract ID: ([A-Z0-9]+)/);
    if (!contractIdMatch) {
      throw new Error('Failed to extract contract ID from deployment output');
    }
    
    const contractId = contractIdMatch[1];
    logSuccess(`Contract deployed successfully!`);
    log(`Contract ID: ${contractId}`, 'blue');
    
    return { contractId, wasmPath };
  } catch (error) {
    logError(`Contract deployment failed: ${error.message}`);
    throw error;
  }
}

// Initialize contract
function initializeContract(contractId) {
  logStep('Initializing contract...');
  
  try {
    const networkFlag = config.network === 'TESTNET' ? '--network testnet' : '--network futurenet';
    const ownerAddress = extractPublicKeyFromSecret(config.deployerSecret);
    
    const initCommand = `soroban contract invoke --id ${contractId} --source ${config.deployerSecret} ${networkFlag} -- __init --version "1.0.0" --network "${config.network}" --owner ${ownerAddress}`;
    
    execSync(initCommand, { stdio: 'inherit' });
    
    logSuccess('Contract initialized successfully!');
  } catch (error) {
    logError(`Contract initialization failed: ${error.message}`);
    throw error;
  }
}

// Extract public key from secret
function extractPublicKeyFromSecret(secretKey) {
  try {
    // This is a simplified extraction - in production, use Stellar SDK
    const stellar = require('stellar-sdk');
    const keypair = stellar.Keypair.fromSecret(secretKey);
    return keypair.publicKey();
  } catch (error) {
    throw new Error('Invalid secret key format');
  }
}

// Run contract tests
function runTests() {
  logStep('Running contract tests...');
  
  try {
    process.chdir(config.contractPath);
    execSync('cargo test', { stdio: 'inherit' });
    logSuccess('All tests passed!');
  } catch (error) {
    logError(`Tests failed: ${error.message}`);
    throw error;
  }
}

// Main deployment function
async function deployRustContracts() {
  log('🦀 Deploying Rust Soroban LABS Contracts', 'bright');
  log(`Network: ${config.network}`, 'blue');
  log(`Contract Path: ${config.contractPath}`, 'blue');

  // Check if contracts are already deployed
  const existingConfig = loadContractConfig();
  if (existingConfig && existingConfig.network === config.network && existingConfig.type === 'soroban-rust') {
    logWarning('Rust contracts already deployed on this network');
    log(`Contract ID: ${existingConfig.contractId}`, 'yellow');
    
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

  try {
    // Check prerequisites
    if (!checkSorobanCLI()) {
      logWarning('Soroban CLI not found');
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Install Soroban CLI? (y/N): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() === 'y') {
        installSorobanCLI();
      } else {
        logError('Soroban CLI is required for deployment');
        process.exit(1);
      }
    }

    // Run tests first
    await runTests();
    
    // Build contract
    const wasmPath = await buildContract();
    
    // Optimize WASM
    const optimizedWasmPath = await optimizeWasm(wasmPath);
    
    // Deploy contract
    const deploymentResult = await deployContract(optimizedWasmPath);
    
    // Initialize contract
    await initializeContract(deploymentResult.contractId);
    
    // Save configuration
    const contractInfo = {
      ...deploymentResult,
      contractWasm: optimizedWasmPath
    };
    saveContractConfig(contractInfo);
    
    // Verify deployment
    logStep('Verifying deployment');
    const networkFlag = config.network === 'TESTNET' ? '--network testnet' : '--network futurenet';
    const verifyCommand = `soroban contract invoke --id ${deploymentResult.contractId} --source ${config.deployerSecret} ${networkFlag} -- get_contract_info`;
    
    const verifyOutput = execSync(verifyCommand, { stdio: 'pipe', encoding: 'utf8' });
    logSuccess('Contract verification completed!');
    
    log('\n🎉 Rust contract deployment completed successfully!', 'bright');
    log('\nContract Information:', 'cyan');
    log(`Contract ID: ${deploymentResult.contractId}`, 'yellow');
    log(`WASM File: ${optimizedWasmPath}`, 'yellow');
    log(`Network: ${config.network}`, 'yellow');
    
    log('\nNext steps:', 'cyan');
    log('1. Update backend to use Rust contract', 'yellow');
    log('2. Update frontend contract integration', 'yellow');
    log('3. Test LABS operations', 'yellow');
    
    return contractInfo;
    
  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    
    if (error.message.includes('insufficient balance')) {
      log('\n💡 Tip: Make sure your deployer account has enough XLM', 'yellow');
      log('For testnet, you can fund your account at: https://friendbot.stellar.org', 'cyan');
    }
    
    process.exit(1);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'deploy':
      await deployRustContracts();
      break;
      
    case 'test':
      await runTests();
      break;
      
    case 'build':
      await buildContract();
      break;
      
    case 'status':
      const contractConfig = loadContractConfig();
      if (contractConfig && contractConfig.type === 'soroban-rust') {
        log('Rust Contract Status:', 'bright');
        log(`Network: ${contractConfig.network}`, 'blue');
        log(`Contract ID: ${contractConfig.contractId}`, 'blue');
        log(`Deployed At: ${contractConfig.deployedAt}`, 'blue');
        log(`Version: ${contractConfig.version}`, 'blue');
        log(`Features: ${contractConfig.features.join(', ')}`, 'blue');
      } else {
        logWarning('No Rust contract configuration found');
        log('Run "npm run deploy:rust-contracts deploy" to deploy contracts', 'yellow');
      }
      break;
      
    default:
      log('Stellar Rust Soroban Contract Deployment Tool', 'bright');
      log('\nUsage:', 'cyan');
      log('  npm run deploy:rust-contracts deploy  - Deploy Rust contracts', 'yellow');
      log('  npm run deploy:rust-contracts test    - Run contract tests', 'yellow');
      log('  npm run deploy:rust-contracts build   - Build contract only', 'yellow');
      log('  npm run deploy:rust-contracts status  - Check contract status', 'yellow');
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
  deployRustContracts,
  runTests,
  buildContract,
  loadContractConfig,
  saveContractConfig
};
