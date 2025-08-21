import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProxyMeshSource } from '../src/sources/proxymesh.source.js';
import { ProxyItem } from '../src/types.js';

describe('ProxyMeshSource', () => {
  const mockConfig = {
    login: 'test-username',
    password: 'test-password',
    host: 'sg.proxymesh.com',
    port: 31280
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should create ProxyMeshSource with proper configuration', () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      expect(proxyMeshSource.isEndpointActive()).toBe(true);
    });

    it('should create with different configuration', () => {
      const sourceWithDifferentConfig = new ProxyMeshSource({
        login: 'test-user',
        password: 'test-pass',
        host: 'us.proxymesh.com',
        port: 31281
      });
      expect(sourceWithDifferentConfig.isEndpointActive()).toBe(true);
    });
  });

  describe('Proxy Management', () => {
    it('should get one proxy (endpoint access)', async () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      const proxies = await proxyMeshSource.get(3);

      // ProxyMesh always returns one proxy (endpoint access)
      expect(proxies).toHaveLength(1);
      expect(proxies[0].source).toBe('proxymesh');
      expect(proxies[0].id).toContain('proxymesh-');
      expect(proxies[0].ttl).toBe(3600);
      expect(proxies[0].used).toBe(false);
      expect(proxies[0].createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique proxy IDs', async () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      const proxies1 = await proxyMeshSource.get(2);
      // Wait a moment to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      const proxies2 = await proxyMeshSource.get(2);
      
      expect(proxies1[0].id).not.toBe(proxies2[0].id);
      expect(proxies1[0].id).toContain('proxymesh-');
      expect(proxies2[0].id).toContain('proxymesh-');
    });

    it('should always return one proxy regardless of count', async () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      const oneProxy = await proxyMeshSource.get(1);
      const fiveProxies = await proxyMeshSource.get(5);
      
      expect(oneProxy).toHaveLength(1);
      expect(fiveProxies).toHaveLength(1); // Still one endpoint
    });

    it('should return one proxy even for zero count', async () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      const proxies = await proxyMeshSource.get(0);
      
      expect(proxies).toHaveLength(1); // Still provides endpoint access
    });
  });

  describe('Lifecycle Management', () => {
    it('should check endpoint active status', () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      expect(proxyMeshSource.isEndpointActive()).toBe(true);
    });

    it('should reactivate endpoint', () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      expect(() => proxyMeshSource.reactivate()).not.toThrow();
      expect(proxyMeshSource.isEndpointActive()).toBe(true);
    });

    it('should remove proxy (no-op)', async () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      await expect(proxyMeshSource.remove?.('test-id')).resolves.not.toThrow();
    });
  });

  describe('Validation', () => {
    it('should validate proxy correctly', async () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      const validProxy: ProxyItem = {
        id: 'proxymesh-sg.proxymesh.com',
        ttl: 300,
        source: 'proxymesh',
        used: false,
        createdAt: new Date(),
      };

      const invalidProxy: ProxyItem = {
        id: 'other-123',
        ttl: 300,
        source: 'other',
        used: false,
        createdAt: new Date()
      };

      expect(await proxyMeshSource.validate?.(validProxy)).toBe(true);
      expect(await proxyMeshSource.validate?.(invalidProxy)).toBe(false);
    });

    it('should validate null proxy as false', async () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      // Testing with null proxy - should return false for invalid input
      expect(await proxyMeshSource.validate?.(null as never)).toBe(false);
    });
  });

  describe('Stats Tracking', () => {
    it('should work without stats tracking', async () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      const proxies = await proxyMeshSource.get(2);
      
      expect(proxies).toHaveLength(1);
      expect(proxies[0].source).toBe('proxymesh');
    });

    it('should handle multiple requests without stats', async () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      await proxyMeshSource.get(1);
      await proxyMeshSource.get(3);
      
      // Just verify it works
      expect(proxyMeshSource.isEndpointActive()).toBe(true);
    });
  });

  describe('Connection Configuration', () => {
    it('should generate correct connection string', () => {
      const proxyMeshSource = new ProxyMeshSource({
        login: 'testuser',
        password: 'testpass',
        host: 'example.proxymesh.com',
        port: 8080
      });
      
      const connectionString = proxyMeshSource.getConnectionString();
      expect(connectionString).toBe('testuser:testpass@example.proxymesh.com:8080');
    });

    it('should provide proxy configuration', () => {
      const proxyMeshSource = new ProxyMeshSource({
        login: 'user',
        password: 'pass',
        host: 'sg.proxymesh.com',
        port: 31280
      });
      
      const config = proxyMeshSource.getProxyConfig();
      expect(config).toEqual({
        host: 'sg.proxymesh.com',
        port: 31280,
        auth: {
          username: 'user',
          password: 'pass'
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle negative proxy count (still returns one)', async () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      const proxies = await proxyMeshSource.get(-1);
      
      expect(proxies).toHaveLength(1); // Still returns endpoint access
    });

    it('should handle very large proxy count (still returns one)', async () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      const proxies = await proxyMeshSource.get(1000);
      
      expect(proxies).toHaveLength(1);
      expect(proxies[0].source).toBe('proxymesh');
    });
  });

  describe('Integration Points', () => {
    it('should maintain consistent proxy structure', async () => {
      const proxyMeshSource = new ProxyMeshSource(mockConfig);
      
      const proxies = await proxyMeshSource.get(1);
      const proxy = proxies[0];
      
      expect(proxy).toHaveProperty('id');
      expect(proxy).toHaveProperty('ttl');
      expect(proxy).toHaveProperty('source');
      expect(proxy).toHaveProperty('used');
      expect(proxy).toHaveProperty('createdAt');
      
      expect(typeof proxy.id).toBe('string');
      expect(typeof proxy.ttl).toBe('number');
      expect(typeof proxy.source).toBe('string');
      expect(typeof proxy.used).toBe('boolean');
      expect(proxy.createdAt).toBeInstanceOf(Date);
    });

    it('should work with different config variations', async () => {
      const configs = [
        { login: 'user1', password: 'pass1', host: 'us.proxymesh.com', port: 31280 },
        { login: 'user2', password: 'pass2', host: 'custom.endpoint.com', port: 9090 },
        { login: 'user3', password: 'pass3', host: 'sg.proxymesh.com', port: 31280 }
      ];
      
      for (const config of configs) {
        const source = new ProxyMeshSource(config);
        const proxies = await source.get(1);
        
        expect(proxies).toHaveLength(1);
        expect(proxies[0].source).toBe('proxymesh');
      }
    });
  });
});
