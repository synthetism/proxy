#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ProxyMeshSource } from '../src/sources/proxymesh.source.js';

/**
 * ProxyMesh Demo - Simple endpoint proxy provider
 * 
 * Tests:
 * 1. Load config from private/proxymesh.json
 * 2. Create ProxyMeshSource with Singapore endpoint
 * 3. Get proxy access (returns endpoint access)
 * 4. Test remove/deactivate functionality
 */

async function main() {
  console.log('🌐 ProxyMesh Demo - Single Endpoint Provider\n');

  try {
    // Load credentials from private folder
    console.log('📂 Loading config from private/proxymesh.json...');
    const configPath = path.join('private', 'proxymesh.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    console.log('✅ Config loaded:');
    console.log(`   Login: ${config.login}`);
    console.log(`   Password: ${config.password.substring(0, 3)}...`);
    console.log();

    // Create ProxyMesh source with Singapore endpoint (currently active)
    console.log('🏗️  Creating ProxyMeshSource...');
    const proxyMeshSource = new ProxyMeshSource({
      login: config.login,
      password: config.password,
      host: 'sg.proxymesh.com', // Active Singapore endpoint
      port: 31280
    });
    console.log('✅ ProxyMeshSource created\n');

    // Test 1: Get proxy access
    console.log('🌐 Testing proxy access - requesting endpoint...');
    const startTime = Date.now();
    
    try {
      const proxies = await proxyMeshSource.get(1);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Success! Got endpoint access in ${duration}ms\n`);
      
      // Display proxy details
      console.log('📋 Proxy Details:');
      const proxy = proxies[0];
      console.log(`   ID: ${proxy.id}`);
      console.log(`   Source: ${proxy.source}`);
      console.log(`   TTL: ${proxy.ttl}s`);
      console.log(`   Created: ${proxy.createdAt.toISOString()}`);
      console.log(`   Used: ${proxy.used}`);
      console.log();

      // Display connection info
      console.log('🔗 Connection Details:');
      console.log(`   Connection String: ${proxyMeshSource.getConnectionString()}`);
      console.log(`   Endpoint Active: ${proxyMeshSource.isEndpointActive()}`);
      console.log();

      // Test proxy configuration format
      const proxyConfig = proxyMeshSource.getProxyConfig();
      console.log('⚙️  Proxy Config for HTTP clients:');
      console.log(`   Host: ${proxyConfig.host}`);
      console.log(`   Port: ${proxyConfig.port}`);
      console.log(`   Username: ${proxyConfig.auth.username}`);
      console.log(`   Password: ${proxyConfig.auth.password.substring(0, 3)}...`);
      console.log();

      // Test validation
      console.log('🧪 Testing proxy validation...');
      const isValid = await proxyMeshSource.validate!(proxy);
      console.log(`   Proxy valid: ${isValid}`);
      console.log();

      // Test 2: Remove/deactivate proxy
      console.log('❌ Testing proxy removal (deactivation)...');
      await proxyMeshSource.remove(proxy.id);
      console.log(`   Endpoint active after removal: ${proxyMeshSource.isEndpointActive()}`);
      console.log();

      // Test 3: Try to get proxy when inactive
      console.log('🚫 Testing get() when endpoint is inactive...');
      try {
        await proxyMeshSource.get(1);
        console.log('   ❌ Unexpected: Should have failed!');
      } catch (error) {
        console.log(`   ✅ Expected failure: ${error instanceof Error ? error.message : error}`);
      }
      console.log();

      // Test 4: Reactivate and test again
      console.log('🔄 Testing reactivation...');
      proxyMeshSource.reactivate();
      const finalProxies = await proxyMeshSource.get(1);
      console.log(`   ✅ Reactivated successfully, got proxy: ${finalProxies[0].id}`);
      console.log();


      console.log('🎉 ProxyMesh demo completed successfully!');
      
    } catch (apiError) {
      const duration = Date.now() - startTime;
      console.log(`❌ Error after ${duration}ms:`);
      console.log(`   ${apiError instanceof Error ? apiError.message : apiError}`);
    }

  } catch (error) {
    console.error('💥 Demo failed:');
    console.error(`   ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

// Run demo
main().catch(console.error);
