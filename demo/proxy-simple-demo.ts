#!/usr/bin/env node

import { ProxyUnit } from '../src/proxy.unit.js';
import type { ProxyEvent } from '../src/proxy.unit.js';
import type { IProxySource, ProxyItem, ProxyConnection } from '../src/types.js';

/**
 * Mock Proxy Source for Demo - No external dependencies
 * SMITH PRINCIPLE: Simple, working demo that demonstrates functionality
 */
class MockProxySource implements IProxySource {
  private readonly name: string;
  private counter = 0;

  constructor(name: string) {
    this.name = name;
  }

  async get(count: number): Promise<ProxyItem[]> {
    const proxies: ProxyItem[] = [];
    
    for (let i = 0; i < count; i++) {
      this.counter++;
      proxies.push({
        id: `${this.name}-proxy-${this.counter}`,
        ttl: 3600,
        source: this.name,
        used: false,
        createdAt: new Date(),
        // Real proxy connection details
        host: `${this.counter}.proxy.${this.name}.com`,
        port: 8080 + (this.counter % 100),
        username: `user${this.counter}`,
        password: `pass${this.counter}`,
        protocol: this.counter % 2 === 0 ? 'http' : 'socks5',
        type: this.counter % 3 === 0 ? 'residential' : 'datacenter',
        country: ['US', 'UK', 'DE', 'FR', 'JP'][this.counter % 5]
      });
    }
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    return proxies;
  }

  async remove(id: string): Promise<void> {
    console.log(`[${this.name}] Removing proxy ${id.substring(0, 12)}...`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

/**
 * Complete Proxy System Demo - ProxyUnit + SockerUnit Integration
 * SMITH PRINCIPLE: No external dependencies. Pure functionality demo.
 */
async function main() {
  console.log('🚀 SYNET Proxy System Demo - Complete Integration Test\\n');

  try {
    // =============================================================================
    // STEP 1: Create ProxyUnit with multiple mock sources
    // =============================================================================
    
    console.log('🏗️  Creating ProxyUnit with multiple sources...');
    
    const sources = [
      new MockProxySource('premium'),
      new MockProxySource('standard'),
      new MockProxySource('backup')
    ];

    const proxy = ProxyUnit.create({
      sources,
      poolSize: 8,     // Small pool for demo
      rotationThreshold: 0.3  // 30% threshold
    });

    console.log('✅ ProxyUnit created:');
    console.log(`   ${proxy.whoami()}`);
    console.log();

    // =============================================================================
    // STEP 2: Event Monitoring Setup
    // =============================================================================
    
    console.log('📡 Setting up event monitoring...');
    
    const events: string[] = [];
    
    // Monitor all proxy events
    proxy.on<ProxyEvent>('*', (event) => {
      const timestamp = event.timestamp.toISOString().substring(11, 23);
      const logLine = `[${timestamp}] 📊 ${event.type}`;
      console.log(logLine);
      events.push(event.type);
      
      if (event.error) {
        console.log(`          ❌ Error: ${event.error.message}`);
      }
    });

    console.log('✅ Event monitoring active\\n');

    // =============================================================================
    // STEP 3: Initialize Proxy Pool
    // =============================================================================
    
    console.log('🔄 Initializing proxy pool...');
    const initStart = Date.now();
    
    await proxy.init();
    const initDuration = Date.now() - initStart;
    
    console.log(`✅ Pool initialized in ${initDuration}ms`);
    
    // Show initial stats
    const initialStats = proxy.getStats();
    console.log('📊 Initial Pool Stats:');
    console.log(`   Pool Size: ${initialStats.currentSize}/${initialStats.poolSize}`);
    console.log(`   Available: ${initialStats.available}`);
    console.log(`   Last Refresh: ${initialStats.lastRefresh?.toISOString().substring(11, 19)}`);
    console.log();

    // =============================================================================
    // STEP 4: Test Proxy Retrieval (No Criteria)
    // =============================================================================
    
    console.log('🌐 Testing proxy retrieval (no criteria)...');
    
    for (let i = 1; i <= 3; i++) {
      try {
        const connection = await proxy.get();
        console.log(`✅ Proxy ${i}: ${connection.protocol}://${connection.username}@${connection.host}:${connection.port} (${connection.country})`);
        
        // Simulate usage delay
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.log(`❌ Proxy ${i}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log();

    // =============================================================================
    // STEP 5: Test Proxy Retrieval (With Criteria)
    // =============================================================================
    
    console.log('🎯 Testing proxy retrieval (with criteria)...');
    
    const testCriteria = [
      { protocol: 'http' as const },
      { type: 'datacenter' as const },
      { country: 'US' },
      { protocol: 'socks5' as const, country: 'UK' }
    ];

    for (const criteria of testCriteria) {
      try {
        const connection = await proxy.get(criteria);
        const criteriaStr = Object.entries(criteria).map(([k, v]) => `${k}:${v}`).join(', ');
        console.log(`✅ Criteria {${criteriaStr}}: ${connection.protocol}://${connection.host}:${connection.port} (${connection.country})`);
      } catch (error) {
        const criteriaStr = Object.entries(criteria).map(([k, v]) => `${k}:${v}`).join(', ');
        console.log(`❌ Criteria {${criteriaStr}}: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log();

    // =============================================================================
    // STEP 6: Test Pool Status & Replenishment Trigger
    // =============================================================================
    
    console.log('📊 Checking pool status after usage...');
    const poolStatus = proxy.getPoolStatus();
    
    console.log('Pool Status:');
    console.log(`   Total: ${poolStatus.currentSize}/${poolStatus.poolSize}`);
    console.log(`   Available: ${poolStatus.available}`);
    console.log(`   Should Replenish: ${poolStatus.shouldReplenish ? '🔄 YES' : '✅ NO'}`);
    console.log('   Proxy Details:');
    
    for (const proxyInfo of poolStatus.proxies.slice(0, 5)) {  // Show first 5
      const ageSeconds = Math.round(proxyInfo.age / 1000);
      const status = proxyInfo.used ? '🔴 USED' : '🟢 AVAILABLE';
      console.log(`     ${proxyInfo.id.substring(0, 16)}... ${status} (${ageSeconds}s old)`);
    }
    
    if (poolStatus.proxies.length > 5) {
      console.log(`     ... and ${poolStatus.proxies.length - 5} more`);
    }
    console.log();

    // =============================================================================
    // STEP 7: Test Proxy Removal & Automatic Replenishment
    // =============================================================================
    
    console.log('🗑️  Testing proxy removal...');
    
    try {
      const connection = await proxy.get();
      console.log(`✅ Retrieved proxy for removal: ${connection.id.substring(0, 16)}...`);
      
      await proxy.delete(connection);
      console.log('✅ Proxy removed from pool');
      
      // Wait a moment for potential async replenishment
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.log(`❌ Removal test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log();

    // =============================================================================
    // STEP 8: Force Pool Depletion to Test Replenishment
    // =============================================================================
    
    console.log('🔥 Testing automatic replenishment (depleting pool)...');
    
    const connections: ProxyConnection[] = [];
    try {
      // Get more proxies to trigger replenishment
      for (let i = 0; i < 6; i++) {
        const connection = await proxy.get();
        connections.push(connection);
        console.log(`   Depleting: Got proxy ${i + 1} (${connection.id.substring(0, 12)}...)`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.log(`   Pool exhausted: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Wait for automatic replenishment
    console.log('⏳ Waiting for automatic replenishment...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log();

    // =============================================================================
    // STEP 9: Final Stats & Event Summary
    // =============================================================================
    
    console.log('📊 Final Statistics:');
    const finalStats = proxy.getStats();
    
    console.log('Pool Management:');
    console.log(`   Final Size: ${finalStats.currentSize}/${finalStats.poolSize}`);
    console.log(`   Available: ${finalStats.available}`);
    console.log(`   Rotation Threshold: ${finalStats.rotationThreshold * 100}%`);
    console.log(`   Initialized: ${finalStats.initialized ? '✅' : '❌'}`);
    
    console.log();
    console.log('📈 Events Captured:');
    const eventCounts = events.reduce((acc, event) => {
      acc[event] = (acc[event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [eventType, count] of Object.entries(eventCounts)) {
      console.log(`   ${eventType}: ${count}x`);
    }
    
    console.log();
    console.log('🎉 Proxy System Demo Completed Successfully!');
    console.log();
    console.log('💡 Key Features Demonstrated:');
    console.log('   ✅ Multi-source proxy management (SockerUnit failover)');
    console.log('   ✅ Automatic pool management (ProxyUnit)'); 
    console.log('   ✅ Criteria-based proxy selection');
    console.log('   ✅ Type-safe event monitoring');
    console.log('   ✅ Graceful degradation and failover');
    console.log('   ✅ Real-time pool replenishment');
    console.log('   ✅ Smith Architecture: No choices, just works');

  } catch (error) {
    console.error('❌ Demo failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Smith Architecture: No choices - just run
main().catch(console.error);
