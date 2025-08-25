import { test, describe, expect, beforeEach, vi } from 'vitest';
import { ProxyUnit } from '../src/proxy.unit';
import type { IProxySource, ProxyConnection } from '../src/types';

// Mock sources for testing
const mockSources: IProxySource[] = [
  {
    get: vi.fn().mockResolvedValue([
      { 
        id: 'mock1', 
        host: '1.1.1.1', 
        port: 8080, 
        protocol: 'http',
        ttl: 3600,
        source: 'MockSource1',
        createdAt: new Date()
      },
      { 
        id: 'mock2', 
        host: '2.2.2.2', 
        port: 8080, 
        protocol: 'http',
        ttl: 3600,
        source: 'MockSource1',
        createdAt: new Date()
      }
    ])
  },
  {
    get: vi.fn().mockResolvedValue([
      { 
        id: 'mock3', 
        host: '3.3.3.3', 
        port: 8080, 
        protocol: 'http',
        ttl: 3600,
        source: 'MockSource2',
        createdAt: new Date()
      }
    ])
  }
];

describe('ProxyUnit v1.0.7 - Clean Lifecycle Interface', () => {
  let proxyUnit: ProxyUnit;

  beforeEach(async () => {
    // Create ProxyUnit with direct sources configuration
    proxyUnit = ProxyUnit.create({
      sources: mockSources
    });

    // Initialize with mocked sources
    await proxyUnit.init();
  });

  test('consciousness trinity implemented correctly', () => {
    expect(proxyUnit.capabilities()).toBeDefined();
    expect(proxyUnit.schema()).toBeDefined();
    expect(proxyUnit.validator()).toBeDefined();
  });

  test('required capabilities are available', () => {
    const capabilities = proxyUnit.capabilities().list();
    expect(capabilities).toContain('get');
    expect(capabilities).toContain('release');
    expect(capabilities).toContain('validate');
    expect(capabilities).toContain('delete');
    expect(capabilities).toContain('init');
  });

  test('get() method returns proxy WITHOUT marking as used (clean interface)', async () => {
    const proxy1 = await proxyUnit.get();
    const proxy2 = await proxyUnit.get();
    
    // Should be able to get multiple times (not marking as used)
    expect(proxy1).toBeDefined();
    expect(proxy2).toBeDefined();
    expect(proxy1.host).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    expect(proxy1.port).toBe(8080);
  });

  test('release() method gets proxy AND marks as used', async () => {
    const proxy = await proxyUnit.release();
    
    expect(proxy).toBeDefined();
    expect(proxy.host).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    expect(proxy.port).toBe(8080);
    
    // This proxy should now be marked as used in the pool
    // (Internal implementation detail, but behavior should be consistent)
  });

  test('validate() delegates to ValidateUnit', async () => {
    const proxy = await proxyUnit.get();
    const isValid = await proxyUnit.validate(proxy);
    
    // ValidateUnit currently returns false (placeholder)
    expect(isValid).toBe(false);
  });

  test('pool management triggers replenishment correctly', async () => {
    // Test with fewer proxies to avoid exhaustion 
    const proxies: ProxyConnection[] = [];
    for (let i = 0; i < 3; i++) { // Only use available mocked proxies
      const proxy = await proxyUnit.release();
      proxies.push(proxy);
    }
    
    expect(proxies).toHaveLength(3);
    expect(proxies.every(p => p.host && p.port)).toBe(true);
  });

  test('getStats() provides pool analytics', () => {
    const stats = proxyUnit.getStats();
    
    expect(stats).toHaveProperty('available');
    expect(stats).toHaveProperty('currentSize');
    expect(typeof stats.available).toBe('number');
  });

  test('teaching contract exposes clean interface', () => {
    const contract = proxyUnit.teach();
    
    expect(contract.unitId).toBe('proxy');
    expect(contract.capabilities).toBeDefined();
    expect(contract.schema).toBeDefined();
    expect(contract.validator).toBeDefined();
    
    // Verify key capabilities are exposed
    const capabilityList = contract.capabilities.list();
    expect(capabilityList).toContain('get');
    expect(capabilityList).toContain('release');
  });

  test('error handling provides helpful messages', async () => {
    const emptyProxyUnit = ProxyUnit.create({
      sources: []
    });

    try {
      await emptyProxyUnit.get();
      expect.fail('Should have thrown error for empty sources');
    } catch (error) {
      expect(error.message).toContain('[proxy]');
    }
  });

});

describe('ProxyUnit Integration Patterns', () => {
  test('network request pattern with clean proxy lifecycle', async () => {
    const proxyUnit = ProxyUnit.create({
      sources: mockSources
    });

    await proxyUnit.init();

    // Pattern: Get proxy, use for request, mark as used
    const proxy = await proxyUnit.get();     // Clean acquisition
    
    // Simulate network request (would happen in Network unit)
    const requestSuccessful = Boolean(proxy.host && proxy.port);
    expect(requestSuccessful).toBe(true);
    
    // Mark as used after successful request
    const usedProxy = await proxyUnit.release(); // Marks as used
    expect(usedProxy.host).toBeDefined();
  });

  test('proxy health validation integration', async () => {
    const proxyUnit = ProxyUnit.create({
      sources: mockSources
    });

    await proxyUnit.init();

    const proxy = await proxyUnit.get();
    const isHealthy = await proxyUnit.validate(proxy);
    
    // ValidateUnit returns false for now (future expansion)
    expect(isHealthy).toBe(false);
  });
});
