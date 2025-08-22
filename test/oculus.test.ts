import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { OculusSource } from '../src/sources/oculus.source.js';

// Mock fetch globally
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Helper function to create mock response
const createMockResponse = (data: unknown, status = 200, headers?: Record<string, string>) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Bad Request',
  json: async () => data,
  text: async () => typeof data === 'string' ? data : JSON.stringify(data),
  headers: new Map(Object.entries(headers || {}))
} as unknown as Response);

describe('OculusSource', () => {
  const mockConfig = {
    apiToken: 'test-api-token',
    orderToken: 'test-order-token',
    host: 'proxy.oculus-proxy.com',
    port: 31112,
    planType:"SHARED_DC",
    country: "us",
    whiteListIP: ["1.1.1.1"]

  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API Integration', () => {
    it('should successfully get proxies from API', async () => {
      const oculusSource = new OculusSource(mockConfig);
      const mockProxies = [
        'proxy.oculus-proxy.com:31114:username1:password1',
        'proxy.oculus-proxy.com:31111:username2:password2'
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse(mockProxies));

      const proxies = await oculusSource.get(2);

      expect(proxies).toHaveLength(2);
      expect(proxies[0].source).toBe('oculus');
      expect(proxies[0].id).toContain('oculus-');
      expect(proxies[0].ttl).toBe(300);
      expect(proxies[0].used).toBe(false);

      // Verify API call was made correctly
      expect(fetch).toHaveBeenCalledWith(
        'https://api.oculusproxies.com/v1/configure/proxy/getProxies',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'authToken': 'test-api-token'
          }),
          body: expect.stringContaining('"orderToken":"test-order-token"')
        })
      );
    });

    it('should handle different response formats from API', async () => {
      const oculusSource = new OculusSource(mockConfig);
      const mockProxies = [
        'proxy.oculus-proxy.com:31114:username1:password1'
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse(mockProxies));

      const proxies = await oculusSource.get(1);

      expect(proxies).toHaveLength(1);
      expect(proxies[0].source).toBe('oculus');
      expect(proxies[0].id).toContain('oculus-');
    });

    it('should handle HTTP errors correctly', async () => {
      const oculusSource = new OculusSource(mockConfig);
      mockFetch.mockResolvedValueOnce(createMockResponse('bad request', 400, {
        'x-tlp-err-code': 'client_10001',
        'x-tlp-error': 'Authentication failed',
        'x-tlp-err-msg': 'Check your credentials'
      }));

      await expect(oculusSource.get(1)).rejects.toThrow('Oculus API Error: Check your credentials(client_10001)');
    });

    it('should handle network errors', async () => {
      const oculusSource = new OculusSource(mockConfig);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(oculusSource.get(1)).rejects.toThrow('Oculus API error: Network error');
    });

    it('should handle empty proxy response', async () => {
      const oculusSource = new OculusSource(mockConfig);
      mockFetch.mockResolvedValueOnce(createMockResponse([]));

      await expect(oculusSource.get(1)).rejects.toThrow('Oculus API returned no proxies');
    });

    it('should handle invalid proxy format', async () => {
      const oculusSource = new OculusSource(mockConfig);
      const invalidProxies = [
        'invalid-proxy-format' // Should have 4 parts separated by :
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse(invalidProxies));

      await expect(oculusSource.get(1)).rejects.toThrow('Invalid Oculus proxy format');
    });
  });


  describe('Optional Methods', () => {
    it('should handle remove method (no-op for Oculus)', async () => {
      const oculusSource = new OculusSource(mockConfig);
      await expect(oculusSource.remove?.('test-id')).resolves.not.toThrow();
    });

    it('should validate proxy correctly', async () => {
      const oculusSource = new OculusSource(mockConfig);
      const validProxy = {
        id: 'oculus-123',
        ttl: 300,
        source: 'oculus',
        used: false,
        createdAt: new Date()
      };

      const invalidProxy = {
        id: 'other-123',
        ttl: 300,
        source: 'other',
        used: false,
        createdAt: new Date()
      };

      expect(await oculusSource.validate?.(validProxy)).toBe(true);
      expect(await oculusSource.validate?.(invalidProxy)).toBe(false);
    });
  });

  describe('Request Configuration', () => {
    it('should include all required parameters in API request', async () => {
      const oculusSource = new OculusSource(mockConfig);
      mockFetch.mockResolvedValueOnce(createMockResponse(['proxy.oculus-proxy.com:31114:user:pass']));

      await oculusSource.get(5);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall?.[1]?.body as string);
      expect(requestBody).toEqual({
        orderToken: 'test-order-token',
        planType: 'SHARED_DC',
        numberOfProxies: 5,
        country: 'us',
        enableSock5: false,
        whiteListIP: ['1.1.1.1'] // Match the actual hardcoded IP
      });
    });


  });
});
