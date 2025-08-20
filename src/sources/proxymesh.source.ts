import type { IProxySource, Proxy, SourceStats } from '../types/index.js';

interface ProxyMeshProxy {
  id: string;
  address: string; // "host:port" format
  status: 'active' | 'inactive';
}

interface ProxyMeshConfig {
  proxies: ProxyMeshProxy[];
  username?: string;
  password?: string;
}

/**
 * ProxyMesh Source - Pool-based proxy provider with rotation
 * 
 * Emulates database behavior with remove() function
 * Uses proxymesh.json configuration
 */
export class ProxyMeshSource implements IProxySource {
  private proxies: Map<string, ProxyMeshProxy>;
  private usedProxies: Set<string>;
  private stats: SourceStats;
  private readonly config: ProxyMeshConfig;

  constructor(config: ProxyMeshConfig) {
    this.config = config;
    this.proxies = new Map();
    this.usedProxies = new Set();
    
    // Initialize proxy pool
    config.proxies.forEach(proxy => {
      this.proxies.set(proxy.id, proxy);
    });

    this.stats = {
      name: 'proxymesh',
      total: config.proxies.length,
      successful: 0,
      failed: 0
    };
  }

  async get(count: number): Promise<Proxy[]> {
    try {
      const availableProxies = Array.from(this.proxies.values())
        .filter(proxy => 
          proxy.status === 'active' && 
          !this.usedProxies.has(proxy.id)
        );

      if (availableProxies.length === 0) {
        this.stats.failed++;
        this.stats.lastFailure = new Date();
        throw new Error('ProxyMesh: No available proxies');
      }

      const selectedProxies = availableProxies
        .slice(0, Math.min(count, availableProxies.length))
        .map(proxy => this.convertToProxy(proxy));

      this.stats.successful++;
      this.stats.lastSuccess = new Date();

      return selectedProxies;
    } catch (error) {
      this.stats.failed++;
      this.stats.lastFailure = new Date();
      throw error;
    }
  }

  // Critical for database-like sources - mark proxy as used
  async remove(id: string): Promise<void> {
    // Extract original proxy ID from synet proxy ID
    const originalId = this.extractOriginalId(id);
    
    if (this.proxies.has(originalId)) {
      this.usedProxies.add(originalId);
      console.log(`ProxyMesh: Marked proxy ${originalId} as used`);
    } else {
      throw new Error(`ProxyMesh: Proxy ${originalId} not found`);
    }
  }

  async validate?(proxy: Proxy): Promise<boolean> {
    const originalId = this.extractOriginalId(proxy.id);
    const meshProxy = this.proxies.get(originalId);
    
    return meshProxy !== undefined && 
           meshProxy.status === 'active' && 
           !this.usedProxies.has(originalId);
  }

  getStats(): SourceStats {
    return {
      ...this.stats,
      total: this.proxies.size
    };
  }

  /**
   * Reset used proxies (for testing)
   */
  reset(): void {
    this.usedProxies.clear();
  }

  /**
   * Get current pool status
   */
  getPoolStatus() {
    return {
      total: this.proxies.size,
      active: Array.from(this.proxies.values()).filter(p => p.status === 'active').length,
      used: this.usedProxies.size,
      available: Array.from(this.proxies.values()).filter(p => 
        p.status === 'active' && !this.usedProxies.has(p.id)
      ).length
    };
  }

  private convertToProxy(meshProxy: ProxyMeshProxy): Proxy {
    return {
      id: `proxymesh-${meshProxy.id}-${Date.now()}`, // Unique ID for tracking
      ttl: 3600, // 1 hour TTL for pool proxies
      source: 'proxymesh',
      used: false,
      createdAt: new Date()
    };
  }

  private extractOriginalId(synetProxyId: string): string {
    // Extract original ID from "proxymesh-{originalId}-{timestamp}" format
    const parts = synetProxyId.split('-');
    if (parts.length >= 3 && parts[0] === 'proxymesh') {
      // Join middle parts in case original ID contains dashes
      return parts.slice(1, -1).join('-');
    }
    return synetProxyId; // Fallback
  }
}
