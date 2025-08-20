import { describe, it, expect, beforeEach } from 'vitest';
import { SockerUnit } from '../src/socker.unit.js';
import { OculusSource } from '../src/sources/oculus.source.js';
import { ProxyMeshSource } from '../src/sources/proxymesh.source.js';
import type { IProxySource } from '../src/types/index.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Mock Oculus config (using real structure from private/oculus.json)

  // Load AI API key
  const mockOculusConfig = JSON.parse(
          readFileSync(path.join('private',  `oculus.json`), 'utf-8')
  );


  const mockProxyMeshConfig = JSON.parse(
          readFileSync(path.join('private',  `proxymesh.json`), 'utf-8')
  );


// Mock ProxyMesh config (using real structure from private/proxymesh.json)
/* const mockProxyMeshConfig = {
  proxies: [
    { id: 'proxymesh-1', address: 'us-ca.proxymesh.com:31280', status: 'active' as const },
    { id: 'proxymesh-2', address: 'open.proxymesh.com:31280', status: 'active' as const },
    { id: 'proxymesh-3', address: 'open.proxymesh.com:31280', status: 'active' as const },
    { id: 'proxymesh-4', address: 'open.proxymesh.com:31280', status: 'inactive' as const },
  ]
}; */

describe('SockerUnit - Base Functionality', () => {
  let proxyMeshSource: ProxyMeshSource;
  let oculusSource: OculusSource;
  let socker: SockerUnit;

  beforeEach(() => {
    // Reset ProxyMesh for each test
    proxyMeshSource = new ProxyMeshSource(mockProxyMeshConfig);
    proxyMeshSource.reset();
    
    // Create Oculus source (will use mocked responses in real tests)
    oculusSource = new OculusSource(mockOculusConfig);
    
    // Create Socker with both sources
    socker = SockerUnit.create([proxyMeshSource, oculusSource]);
  });

  describe('Unit Creation and Identity', () => {
    it('should create Socker unit with proper identity', () => {
      expect(socker.whoami()).toContain('SockerUnit');
      expect(socker.whoami()).toContain('2 sources');
    });

    it('should have required capabilities', () => {
      const capabilities = socker.getCapabilities();
      expect(capabilities).toContain('replenish');
      expect(capabilities).toContain('remove');
      expect(capabilities).toContain('testSources');
    });

    it('should implement help method', () => {
      expect(() => socker.help()).not.toThrow();
    });
  });

  describe('Source Management', () => {
    it('should replenish proxies from first available source', async () => {
      const proxies = await socker.replenish(2);
      
      expect(proxies).toHaveLength(2);
      expect(proxies[0].source).toBe('proxymesh');
      expect(proxies[0].id).toContain('proxymesh-');
      expect(proxies[0].used).toBe(false);
    });

    it('should handle proxy removal across sources', async () => {
      const proxies = await socker.replenish(1);
      const proxyId = proxies[0].id;
      
      // Remove proxy - should work without throwing
      await expect(socker.remove(proxyId)).resolves.not.toThrow();
      
      // Verify ProxyMesh source marked it as used
      const poolStatus = proxyMeshSource.getPoolStatus();
      expect(poolStatus.used).toBe(1);
      expect(poolStatus.available).toBe(2); // 3 active - 1 used
    });

    it('should test source health', async () => {
      const healthChecks = await socker.testSources();
      
      expect(healthChecks).toHaveLength(2);
      expect(healthChecks[0].source).toBe('source-0'); // ProxyMesh
      expect(healthChecks[0].healthy).toBe(true);
      // Oculus might fail without real API, that's OK for unit test
    });

    it('should get source statistics', () => {
      const stats = socker.getSourceStats();
      
      expect(stats).toHaveLength(2);
      expect(stats[0].name).toBe('proxymesh');
      expect(stats[0].total).toBe(4); // Total proxies in config
    });
  });

  describe('Failover Behavior', () => {
    it('should exhaust proxies gracefully', async () => {
      // Use all available ProxyMesh proxies
      await socker.replenish(1);
      const proxy1 = (await socker.replenish(1))[0];
      await socker.remove(proxy1.id);
      
      await socker.replenish(1);
      const proxy2 = (await socker.replenish(1))[0];
      await socker.remove(proxy2.id);
      
      await socker.replenish(1);
      const proxy3 = (await socker.replenish(1))[0];
      await socker.remove(proxy3.id);
      
      // Should still have 1 more proxy available
      const finalProxies = await socker.replenish(1);
      expect(finalProxies).toHaveLength(1);
    });

    it('should handle source failure and continue with next source', async () => {
      // Create Socker with exhausted ProxyMesh source
      const exhaustedMesh = new ProxyMeshSource({ proxies: [] });
      const sockerWithFailover = SockerUnit.create([exhaustedMesh, proxyMeshSource]);
      
      // Should skip exhausted source and use second one
      const proxies = await sockerWithFailover.replenish(1);
      expect(proxies).toHaveLength(1);
      expect(proxies[0].source).toBe('proxymesh');
    });
  });

  describe('ProxyMesh Source Specific Tests', () => {
    it('should track proxy usage correctly', async () => {
      const initialStatus = proxyMeshSource.getPoolStatus();
      expect(initialStatus.available).toBe(3); // 3 active proxies
      expect(initialStatus.used).toBe(0);
      
      const proxies = await proxyMeshSource.get(2);
      expect(proxies).toHaveLength(2);
      
      // Remove one proxy
      await proxyMeshSource.remove(proxies[0].id);
      
      const updatedStatus = proxyMeshSource.getPoolStatus();
      expect(updatedStatus.available).toBe(2); // 3 active - 1 used
      expect(updatedStatus.used).toBe(1);
    });

    it('should validate proxies correctly', async () => {
      const proxies = await proxyMeshSource.get(1);
      const proxy = proxies[0];
      
      // Should be valid initially
      const isValid = await proxyMeshSource.validate!(proxy);
      expect(isValid).toBe(true);
      
      // Should be invalid after removal
      await proxyMeshSource.remove(proxy.id);
      const isStillValid = await proxyMeshSource.validate!(proxy);
      expect(isStillValid).toBe(false);
    });
  });

  describe('Event System', () => {
    it('should emit events on source failures', async () => {
      const emptySource: IProxySource = {
        get: async () => { throw new Error('Test failure'); }
      };
      
      const sockerWithFailure = SockerUnit.create([emptySource]);
      
      let eventEmitted = false;
      sockerWithFailure.on('source.failed', () => {
        eventEmitted = true;
      });
      
      await expect(sockerWithFailure.replenish(1)).rejects.toThrow();
      expect(eventEmitted).toBe(true);
    });
  });
});

describe('Individual Source Tests', () => {
  describe('ProxyMeshSource', () => {
    let source: ProxyMeshSource;

    beforeEach(() => {
      source = new ProxyMeshSource(mockProxyMeshConfig);
    });

    it('should create source with correct initial state', () => {
      const stats = source.getStats();
      expect(stats.name).toBe('proxymesh');
      expect(stats.total).toBe(4);
      
      const status = source.getPoolStatus();
      expect(status.total).toBe(4);
      expect(status.active).toBe(3); // 3 active, 1 inactive
      expect(status.available).toBe(3);
    });

    it('should handle proxy exhaustion', async () => {
      // Use all active proxies
      await source.get(3);
      
      // Should throw when no more proxies available
      await expect(source.get(1)).rejects.toThrow('No available proxies');
    });
  });

  describe('OculusSource', () => {
    let source: OculusSource;

    beforeEach(() => {
      source = new OculusSource(mockOculusConfig);
    });

    it('should create source with correct configuration', () => {
      const stats = source.getStats();
      expect(stats.name).toBe('oculus');
      expect(stats.total).toBe(0); // No API calls yet
    });

    // Note: Real API tests would require mocking fetch or using actual API
    // For now, we verify the source is properly configured
  });
});
