#!/usr/bin/env node

/**
 * Cloudflare Setup Script for Remesitas
 *
 * This script helps set up Cloudflare resources:
 * - D1 Database
 * - R2 Storage Bucket
 * - KV Namespace
 * - Environment secrets
 *
 * Prerequisites:
 * 1. Install Wrangler: npm install -g wrangler
 * 2. Login to Cloudflare: wrangler login
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: options.silent ? 'pipe' : 'inherit', ...options });
  } catch (error) {
    if (options.ignoreError) return null;
    throw error;
  }
}

function extractId(output, pattern) {
  const match = output?.match(pattern);
  return match ? match[1] : null;
}

async function main() {
  log('\n🚀 Remesitas Cloudflare Setup\n', COLORS.bright);

  // Check if wrangler is installed
  log('📦 Checking Wrangler installation...', COLORS.blue);
  try {
    const version = exec('wrangler --version', { silent: true });
    log(`   Wrangler version: ${version.trim()}`, COLORS.green);
  } catch {
    log('   Wrangler not found. Installing...', COLORS.yellow);
    exec('npm install -g wrangler');
    log('   Wrangler installed!', COLORS.green);
  }

  // Check if logged in
  log('\n🔐 Checking Cloudflare authentication...', COLORS.blue);
  try {
    exec('wrangler whoami', { silent: true });
    log('   Already logged in!', COLORS.green);
  } catch {
    log('   Please login to Cloudflare:', COLORS.yellow);
    exec('wrangler login');
  }

  // Create D1 Database
  log('\n📊 Setting up D1 Database...', COLORS.blue);
  let dbId = null;
  try {
    const output = exec('wrangler d1 create remesitas-db', { silent: true, ignoreError: true });
    dbId = extractId(output, /database_id\s*=\s*"([^"]+)"/);
    if (dbId) {
      log(`   Database created! ID: ${dbId}`, COLORS.green);
    } else {
      // Database might already exist
      const listOutput = exec('wrangler d1 list', { silent: true });
      const existingMatch = listOutput.match(/remesitas-db\s+([a-f0-9-]+)/i);
      if (existingMatch) {
        dbId = existingMatch[1];
        log(`   Database already exists! ID: ${dbId}`, COLORS.green);
      }
    }
  } catch (error) {
    log('   Database may already exist or error occurred', COLORS.yellow);
  }

  // Create R2 Bucket
  log('\n📁 Setting up R2 Storage Bucket...', COLORS.blue);
  try {
    exec('wrangler r2 bucket create remesitas-storage', { silent: true, ignoreError: true });
    log('   R2 bucket created/exists!', COLORS.green);
  } catch {
    log('   R2 bucket may already exist', COLORS.yellow);
  }

  // Create KV Namespace
  log('\n💾 Setting up KV Namespace...', COLORS.blue);
  let kvId = null;
  try {
    const output = exec('wrangler kv namespace create CACHE', { silent: true, ignoreError: true });
    kvId = extractId(output, /id\s*=\s*"([^"]+)"/);
    if (kvId) {
      log(`   KV namespace created! ID: ${kvId}`, COLORS.green);
    }
  } catch {
    log('   KV namespace may already exist', COLORS.yellow);
  }

  // Update wrangler.toml with IDs
  if (dbId || kvId) {
    log('\n📝 Updating wrangler.toml...', COLORS.blue);
    const wranglerPath = resolve('packages/api/wrangler.toml');
    let wranglerContent = readFileSync(wranglerPath, 'utf-8');

    if (dbId) {
      wranglerContent = wranglerContent.replace(
        /database_id\s*=\s*"YOUR_DATABASE_ID"/,
        `database_id = "${dbId}"`
      );
    }

    if (kvId) {
      wranglerContent = wranglerContent.replace(
        /id\s*=\s*"YOUR_KV_ID"/,
        `id = "${kvId}"`
      );
    }

    writeFileSync(wranglerPath, wranglerContent);
    log('   wrangler.toml updated!', COLORS.green);
  }

  // Display next steps
  log('\n✅ Setup Complete!\n', COLORS.bright + COLORS.green);

  log('📋 Next Steps:', COLORS.bright);
  log(`
1. Set up secrets (run in packages/api directory):
   wrangler secret put JWT_SECRET
   wrangler secret put VAPID_PUBLIC_KEY
   wrangler secret put VAPID_PRIVATE_KEY
   wrangler secret put VAPID_EMAIL
   wrangler secret put ELTOQUE_JWT
   wrangler secret put TWILIO_ACCOUNT_SID
   wrangler secret put TWILIO_AUTH_TOKEN
   wrangler secret put TWILIO_SMS_FROM
   wrangler secret put TWILIO_WHATSAPP_FROM

2. Run database migrations:
   pnpm db:migrate:prod

3. Deploy the API:
   pnpm deploy:api

4. Deploy the Web app (SvelteKit on Cloudflare Pages):
   pnpm deploy:web

For local development:
   pnpm dev
`);
}

main().catch(console.error);
