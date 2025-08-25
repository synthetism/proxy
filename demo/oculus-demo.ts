#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { OculusSource } from '../src/sources/oculus.source.js';

/**
 * Oculus Proxy Demo - Test real API connection
 * 
 * Tests:
 * 1. Load config from private/oculus.json
 * 2. Create OculusSource
 * 3. Request proxies from API
 * 4. Display results
 */

async function main() {
  console.log('🔌 Oculus Proxy Demo - Testing API Connection\n');

  try {
    // Load real config from private folder
    console.log('📂 Loading config from private/oculus.json...');
    const configPath = path.join('private', 'oculus.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    console.log('✅ Config loaded:');
    console.log(`   Host: ${config.host}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   Token: ${config.apiToken.substring(0, 8)}...`);
    console.log();

    // Create Oculus source
    console.log('🏗️  Creating OculusSource...');
    const oculusSource = new OculusSource({
      apiToken: config.apiToken,
      orderToken: config.orderToken, // Add orderToken from config
      country: 'sg',
      planType: 'SHARED_DC',
      whiteListIP: config.whiteListIP
    });
    console.log('✅ OculusSource created\n');

    // Test connection - request 2 proxies
    console.log('🌐 Testing API connection - requesting 2 proxies...');
    const startTime = Date.now();
    
    try {
      const proxies = await oculusSource.get(3);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Success! Got ${proxies.length} proxies in ${duration}ms\n`);
      
      // Display proxy details
      console.log('📋 Proxy Details:');
      proxies.forEach((proxy, index) => {
        console.log(`   ${index + 1}. ID: ${proxy.id}`);
        console.log(`      Source: ${proxy.source}`);
        console.log(`      TTL: ${proxy.ttl}s`);
        console.log(`      Host: ${proxy.host}`);
        console.log(`      Username: ${proxy.username}`);
        console.log(`      Created: ${proxy.createdAt.toISOString()}`);
        console.log(`      Used: ${proxy.used}`);
        console.log();
      });

      // Test stats
      /* console.log('📊 Source Stats:');
      const stats = oculusSource.getStats();
      console.log(`   Name: ${stats.name}`);
      console.log(`   Total: ${stats.total}`);
      console.log(`   Successful: ${stats.successful}`);
      console.log(`   Failed: ${stats.failed}`); 
      if (stats.lastSuccess) {
        console.log(`   Last Success: ${stats.lastSuccess.toISOString()}`);
      }
      console.log(); */

      console.log('🎉 Demo completed successfully!');
      
    } catch (apiError) {
      const duration = Date.now() - startTime;
      console.log(`❌ API Error after ${duration}ms:`);
      console.log(`   ${apiError instanceof Error ? apiError.message : apiError}`);
      console.log();
      
   
    }

  } catch (error) {
    console.error('💥 Demo failed:');
    console.error(`   ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

// Run demo
main().catch(console.error);
