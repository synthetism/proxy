import type { IProxySource, ProxyItem } from '../types.js';

export interface ProxyMeshConfig {
  login: string;
  password: string;
  host: string;
  port: number;
  protocol?: 'http' | 'https' | 'socks5';
}

/**
 * ProxyMesh Source - Single endpoint proxy provider
 * 
 * Handles one active ProxyMesh endpoint (e.g., sg.proxymesh.com:31280)
 * Each endpoint provides access to a regional IP pool
 * Format: username:password@host:port (standard proxy auth)
 */
export class ProxyMeshSource implements IProxySource {
  private readonly config: ProxyMeshConfig;
  private isActive: boolean;

  constructor(config: ProxyMeshConfig) {
    this.config = config;
    this.isActive = true; // Start as active
  }

  async get(count: number): Promise<ProxyItem[]> {
    if (!this.isActive) {
      throw new Error('ProxyMesh endpoint is inactive');
    }

    // ProxyMesh endpoint represents access to regional IP pool
    // We return one "proxy" representing this endpoint access
    const proxy: ProxyItem = {
      id: `proxymesh-${this.config.host}-${Date.now()}`,
      ttl: 3600, // 1 hour TTL for endpoint access
      source: 'proxymesh',
      host: this.config.host,
      port: this.config.port,
      username: this.config.login,
      password: this.config.password,
      protocol: this.config.protocol || 'http',
      used: false,
      createdAt: new Date()
    };

    // ProxyMesh provides one endpoint access, regardless of count requested
    return [proxy];
  }

  /**
   * Mark endpoint as inactive (simulates removal/deactivation)
   */
  async remove(id: string): Promise<void> {
    console.log(`ProxyMesh: Deactivating endpoint for proxy ${id}`);
    this.isActive = false;
  }

  async validate?(proxy: ProxyItem): Promise<boolean> {
    // Validate that proxy is from this source and endpoint is still active
    return proxy?.source === 'proxymesh' && 
           proxy?.id?.includes(this.config.host) && 
           this.isActive;
  }

  /**
   * Get formatted proxy connection string for HTTP clients
   * Format: username:password@host:port
   */
  getConnectionString(): string {
    return `${this.config.login}:${this.config.password}@${this.config.host}:${this.config.port}`;
  }

  /**
   * Get proxy configuration for HTTP clients
   */
  getProxyConfig() {
    return {
      host: this.config.host,
      port: this.config.port,
      auth: {
        username: this.config.login,
        password: this.config.password
      }
    };
  }

  /**
   * Check if endpoint is currently active
   */
  isEndpointActive(): boolean {
    return this.isActive;
  }

  /**
   * Reactivate endpoint (for testing/demo purposes)
   */
  reactivate(): void {
    this.isActive = true;
    console.log(`ProxyMesh: Endpoint ${this.config.host} reactivated`);
  }
}
