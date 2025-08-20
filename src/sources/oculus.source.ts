import type { IProxySource, Proxy, SourceStats } from '../types/index.js';

interface OculusConfig {
  apiToken: string; // Used as authToken header
  orderToken?: string; // Optional separate order token, defaults to apiToken
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  planType?: 'DEDICATED_DC' | 'ISP' | 'ISP_PREMIUM' | 'SHARED_DC' | 'RESIDENTIAL_SCRAPER';
}

interface OculusApiResponse {
  proxies?: string[];
  error?: string;
}


/**
 * Oculus Proxy Source - API-based proxy provider
 * 
 * Follows Oculus API documentation for SHARED_DC proxies
 * Format: "host:port:username:password"
 */
export class OculusSource implements IProxySource {
  private readonly config: OculusConfig;
  private stats: SourceStats;

  constructor(config: OculusConfig) {
    this.config = {
      planType: 'SHARED_DC',
      ...config
    };
    
    this.stats = {
      name: 'oculus',
      total: 0,
      successful: 0,
      failed: 0
    };
  }

  async get(count: number): Promise<Proxy[]> {
    try {
      const response = await this.callApi(count);
      
      if (response.error) {
        this.stats.failed++;
        this.stats.lastFailure = new Date();
        throw new Error(`Oculus API error: ${response.error}`);
      }

      if (!response.proxies || response.proxies.length === 0) {
        this.stats.failed++;
        this.stats.lastFailure = new Date();
        throw new Error('Oculus API returned no proxies');
      }

      const proxies = response.proxies.map((proxyString, index) => {
        return this.parseProxyString(proxyString, index);
      });

      this.stats.successful++;
      this.stats.total += proxies.length;
      this.stats.lastSuccess = new Date();

      return proxies;
    } catch (error) {
      this.stats.failed++;
      this.stats.lastFailure = new Date();
      throw error;
    }
  }

  // Optional: API providers might not support removal
  // Oculus handles session management automatically
  async remove?(id: string): Promise<void> {
    // Oculus doesn't require explicit proxy removal
    // Sessions are managed server-side
    return Promise.resolve();
  }

  async validate?(proxy: Proxy): Promise<boolean> {
    // Basic validation - could be enhanced with actual connectivity test
    return proxy.id.length > 0 && proxy.source === 'oculus';
  }

  getStats(): SourceStats {
    return { ...this.stats };
  }

  private async callApi(count: number): Promise<OculusApiResponse> {
    const apiUrl = 'https://api.oculusproxies.com/v1/configure/proxy/getProxies';
    
    const requestBody = {
      orderToken: this.config.orderToken, // Use orderToken if provided, otherwise apiToken
      planType: this.config.planType,
      numberOfProxies: count,
      country: 'US', // Default to US, could be configurable
      enableSock5: false, // Default to HTTP, could be configurable
      whiteListIP: ['0.0.0.0'] // Empty array - let Oculus determine IP
    };

    console.log('🌐 Oculus API Request:', JSON.stringify(requestBody, null, 2));
    console.log('🔑 Auth Token:', this.config.apiToken.substring(0, 8) + '...');

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authToken': this.config.apiToken // Add authToken header as required
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`Oculus API Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error response body:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: unknown = await response.json();
      console.log('✅ API Response data:', JSON.stringify(data, null, 2));
      
      // Handle different response formats from Oculus API
      if (Array.isArray(data)) {
        return { proxies: data as string[] };
      }
      
      if (data && typeof data === 'object' && 'proxies' in data && Array.isArray((data as any).proxies)) {
        return { proxies: (data as any).proxies as string[] };
      }
      
      return { error: 'Invalid response format from Oculus API' };
    } catch (error) {
      console.log('💥 API call failed:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown API error' 
      };
    }
  }

  private parseProxyString(proxyString: string, index: number): Proxy {
    // Oculus format: "host:port:username:password"
    // Example: "192.0.2.1:8080:login:password"
    
    const parts = proxyString.split(':');
    if (parts.length !== 4) {
      throw new Error(`Invalid Oculus proxy format: ${proxyString}`);
    }

    const [host, port, username, password] = parts;

    return {
      id: `oculus-${Date.now()}-${index}`,
      ttl: 300, // 5 minutes default TTL
      source: 'oculus',
      used: false,
      createdAt: new Date()
    };
  }
}
