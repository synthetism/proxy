import { 
  Unit, 
  type UnitProps, 
  createUnitSchema, 
  type TeachingContract,
  type UnitCore,
  Capabilities,
  Schema,
  Validator
} from '@synet/unit';
import { createState, type State } from '@synet/state';
import { SockerUnit } from './socker.unit.js';
import type { 
  IProxySource, 
  ProxyItem, 
  ProxyConnection, 
  ProxyCriteria, 
  ProxyStats, 
  PoolStatus 
} from './types.js';

interface ProxyConfig {
  sources: IProxySource[];
  poolSize?: number;
  rotationThreshold?: number;
}

interface ProxyProps extends UnitProps {
  socker: SockerUnit;
  poolState: State; // State unit from @synet/state
  poolSize: number;
  rotationThreshold: number;
  initialized: boolean;
}

interface PoolData {
  proxies: ProxyItem[];
  size: number;
  lastRefresh: Date | null;
}

/**
 * ProxyUnit - Network-facing proxy orchestrator with pool management
 * 
 * SMITH PRINCIPLE: No choices. One way. AI-first.
 * - Single init() call required
 * - Single get() method for all needs
 * - Automatic pool management (no configuration needed)
 * - Fire-and-forget operations (non-blocking)
 */
export class ProxyUnit extends Unit<ProxyProps> {
  protected constructor(props: ProxyProps) {
    super(props);
  }

  protected build(): UnitCore {
    const capabilities = Capabilities.create(this.dna.id, {
      init: (...args: unknown[]) => this.init(),
      get: (...args: unknown[]) => this.get(args[0] as ProxyCriteria),
      validate: (...args: unknown[]) => this.validate(args[0] as ProxyConnection),
      delete: (...args: unknown[]) => this.delete(args[0] as ProxyConnection),
      getStats: (...args: unknown[]) => this.getStats(),
      getPoolStatus: (...args: unknown[]) => this.getPoolStatus()
    });

    const schema = Schema.create(this.dna.id, {
      init: {
        name: 'init',
        description: 'Initialize proxy pool (REQUIRED before use)',
        parameters: { type: 'object', properties: {} },
        response: { type: 'object', properties: { initialized: { type: 'boolean' } } }
      },
      get: {
        name: 'get',
        description: 'Get proxy connection for network requests',
        parameters: {
          type: 'object',
          properties: {
            criteria: {
              type: 'object',
              description: 'Criteria for selecting a proxy',
              properties: {
                country: { type: 'string', description: 'Proxy country code' },
                protocol: { type: 'string', description: 'Proxy protocol', enum: ['http', 'socks5'] },
                type: { type: 'string', description: 'Proxy type', enum: ['datacenter', 'residential'] }
              }
            }
          }
        },
        response: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            host: { type: 'string' },
            port: { type: 'number' },
            username: { type: 'string' },
            password: { type: 'string' },
            protocol: { type: 'string' },
            type: { type: 'string' },
            country: { type: 'string' }
          },
          required: ['id', 'host', 'port', 'protocol']
        }
      },
      validate: {
        name: 'validate',
        description: 'Validate proxy connection',
        parameters: {
          type: 'object',
          properties: {
            proxy: { type: 'object', description: 'Proxy connection to validate' }
          },
          required: ['proxy']
        },
        response: { type: 'boolean' }
      },
      delete: {
        name: 'delete',
        description: 'Remove proxy from pool and mark as used',
        parameters: {
          type: 'object',
          properties: {
            proxy: { type: 'object', description: 'Proxy connection to remove' }
          },
          required: ['proxy']
        },
        response: { type: 'object', properties: { removed: { type: 'boolean' } } }
      }
    });

    const validator = Validator.create({
      unitId: this.dna.id,
      capabilities,
      schema,
      strictMode: false
    });

    return { capabilities, schema, validator };
  }

  // Consciousness Trinity Access
  capabilities(): Capabilities { return this._unit.capabilities; }
  schema(): Schema { return this._unit.schema; }
  validator(): Validator { return this._unit.validator; }

  static create(config: ProxyConfig): ProxyUnit {
    // SMITH PRINCIPLE: Eliminate choice, impose reasonable defaults
    const poolSize = config.poolSize ?? 20; // No choice - 20 is optimal
    const rotationThreshold = config.rotationThreshold ?? 0.3; // No choice - 30% is optimal

    const socker = SockerUnit.create(config.sources);
    const poolState = createState('proxy-pool', {
      proxies: [],
      size: 0,
      lastRefresh: null
    });

    const props: ProxyProps = {
      dna: createUnitSchema({ id: 'proxy', version: '1.0.0' }),
      socker,
      poolState,
      poolSize,
      rotationThreshold,
      initialized: false
    };

    return new ProxyUnit(props);
  }

  /**
   * REQUIRED: Initialize proxy pool before first use
   * SMITH PRINCIPLE: One call, no options, just works
   */
  async init(): Promise<void> {
    if (this.props.initialized) {
      return; // Already initialized - idempotent
    }

    try {
      // Initial pool population
      const initialProxies = await this.props.socker.replenish(this.props.poolSize);
      
      // Update state using key-value pairs
      this.props.poolState.set('proxies', initialProxies);
      this.props.poolState.set('size', initialProxies.length);
      this.props.poolState.set('lastRefresh', new Date());

      // Mark as initialized
      this.props.initialized = true;

      this.emit({
        type: 'pool.initialized',
        timestamp: new Date()
      });

    } catch (error) {
      this.emit({
        type: 'pool.init.failed',
        timestamp: new Date(),
        error: {
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw new Error(`[${this.dna.id}] Proxy pool initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get proxy connection for network requests
   * SMITH PRINCIPLE: One method, automatic management, no decisions needed
   */
  async get(criteria?: ProxyCriteria): Promise<ProxyConnection> {
    if (!this.props.initialized) {
      throw new Error(`[${this.dna.id}] Proxy pool not initialized - call init() first`);
    }

    // Check if pool needs replenishment (async, non-blocking)
    if (this.shouldReplenish()) {
      this.replenishPool(); // Fire and forget - SMITH PRINCIPLE
    }

    // Get from current pool immediately
    const proxy = this.getFromPool(criteria);
    if (!proxy) {
      throw new Error(`[${this.dna.id}] Proxy pool exhausted - replenishment in progress`);
    }

    return this.formatForNetwork(proxy);
  }

  /**
   * Validate proxy connection
   */
  async validate(proxy: ProxyConnection): Promise<boolean> {
    // Basic validation - could be enhanced with connectivity test
    return !!(proxy.id && proxy.host && proxy.port && proxy.protocol);
  }

  /**
   * Remove proxy from pool and mark as used
   * SMITH PRINCIPLE: Fire and forget, no complex state management
   */
  async delete(proxy: ProxyConnection): Promise<void> {
    // Remove from local pool immediately
    this.removeFromPool(proxy.id);
    
    // Async removal from source (fire and forget)
    this.props.socker.remove(proxy.id)
      .catch(error => {
        this.emit({
          type: 'proxy.remove.failed',
          timestamp: new Date(),
          error: {
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      });
  }

  /**
   * Get proxy statistics for monitoring
   */
  getStats(): ProxyStats {
    const proxies = this.props.poolState.get<ProxyItem[]>('proxies') || [];
    const size = this.props.poolState.get<number>('size') || 0;
    const lastRefresh = this.props.poolState.get<Date>('lastRefresh') || null;
    
    return {
      poolSize: this.props.poolSize,
      currentSize: size,
      available: proxies.filter((p: ProxyItem) => !p.used).length,
      lastRefresh,
      rotationThreshold: this.props.rotationThreshold,
      initialized: this.props.initialized
    };
  }

  /**
   * Get pool status for debugging
   */
  getPoolStatus(): PoolStatus {
    const proxies = this.props.poolState.get<ProxyItem[]>('proxies') || [];
    const stats = this.getStats();
    
    return {
      ...stats,
      shouldReplenish: this.shouldReplenish(),
      proxies: proxies.map((p: ProxyItem) => ({
        id: p.id,
        source: p.source,
        used: p.used || false,
        age: Date.now() - p.createdAt.getTime()
      }))
    };
  }

  // SMITH PRINCIPLE: Private methods with no configuration options
  
  /**
   * Check if pool needs replenishment
   * SMITH RULE: 30% threshold, no choice
   */
  private shouldReplenish(): boolean {
    const proxies = this.props.poolState.get<ProxyItem[]>('proxies') || [];
    const availableCount = proxies.filter((p: ProxyItem) => !p.used).length;
    const threshold = this.props.poolSize * this.props.rotationThreshold;
    return availableCount <= threshold;
  }

  /**
   * Async pool replenishment (non-blocking)
   * SMITH PRINCIPLE: Fire and forget, handle errors internally
   */
  private replenishPool(): void {
    const currentSize = this.props.poolState.get<number>('size') || 0;
    const neededCount = this.props.poolSize - currentSize;
    
    this.props.socker.replenish(neededCount)
      .then(newProxies => {
        if (newProxies.length > 0) {
          this.addToPool(newProxies);
          this.emit({
            type: 'pool.replenished',
            timestamp: new Date()
          });
        }
      })
      .catch(error => {
        this.emit({
          type: 'pool.replenish.failed',
          timestamp: new Date(),
          error: {
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      });
  }

  /**
   * Get proxy from pool with simple criteria matching
   * SMITH PRINCIPLE: Simple matching, no complex algorithms
   */
  private getFromPool(criteria?: ProxyCriteria): ProxyItem | null {
    const proxies = this.props.poolState.get<ProxyItem[]>('proxies') || [];
    const availableProxies = proxies.filter((p: ProxyItem) => !p.used);

    if (availableProxies.length === 0) {
      return null;
    }

    // Simple criteria matching - SMITH PRINCIPLE: No complex filtering
    if (criteria) {
      const filtered = availableProxies.filter((proxy: ProxyItem) => {
        // Basic filtering - could be enhanced based on proxy metadata
        return true; // For now, return any available proxy
      });
      
      if (filtered.length > 0) {
        return filtered[0]; // First match - no choice
      }
    }

    return availableProxies[0]; // First available - SMITH PRINCIPLE
  }

  /**
   * Add proxies to pool
   */
  private addToPool(newProxies: ProxyItem[]): void {
    const currentProxies = this.props.poolState.get<ProxyItem[]>('proxies') || [];
    const updatedProxies = [...currentProxies, ...newProxies];
    
    this.props.poolState.set('proxies', updatedProxies);
    this.props.poolState.set('size', updatedProxies.length);
    this.props.poolState.set('lastRefresh', new Date());
  }

  /**
   * Remove proxy from pool
   */
  private removeFromPool(proxyId: string): void {
    const currentProxies = this.props.poolState.get<ProxyItem[]>('proxies') || [];
    const updatedProxies = currentProxies.filter((p: ProxyItem) => p.id !== proxyId);
    
    this.props.poolState.set('proxies', updatedProxies);
    this.props.poolState.set('size', updatedProxies.length);
  }

  /**
   * Format proxy for Network unit consumption
   * SMITH PRINCIPLE: Standard format, no options
   */
  private formatForNetwork(proxy: ProxyItem): ProxyConnection {
    // Mark as used in pool
    const currentProxies = this.props.poolState.get<ProxyItem[]>('proxies') || [];
    const updatedProxies = currentProxies.map((p: ProxyItem) => 
      p.id === proxy.id ? { ...p, used: true } : p
    );
    
    this.props.poolState.set('proxies', updatedProxies);

    // Return standard format for Network unit
    return {
      id: proxy.id,
      host: '127.0.0.1', // Placeholder - will be populated from source data
      port: 8080,        // Placeholder - will be populated from source data
      protocol: 'http',  // Default - SMITH PRINCIPLE
      type: 'datacenter' // Default - SMITH PRINCIPLE
    };
  }

  teach(): TeachingContract {
    return {
      unitId: this.dna.id,
      capabilities: this._unit.capabilities,
      schema: this._unit.schema,
      validator: this._unit.validator
    };
  }

  whoami(): string {
    const stats = this.getStats();
    return `ProxyUnit[${stats.currentSize}/${stats.poolSize} proxies, ${stats.available} available] - Pool Management + Source Orchestration - v${this.dna.version}`;
  }

  help(): void {
    console.log(`
ProxyUnit v${this.dna.version} - Pool Management + Source Orchestration

SMITH PRINCIPLE: No choices. One way. AI-first.

REQUIRED INITIALIZATION:
  await proxy.init(); // Must call before use

ONE METHOD TO RULE THEM ALL:
  const connection = await proxy.get(criteria?);

Pool Management (Automatic):
• 20 proxy pool size (no choice)
• 30% replenishment threshold (no choice)
• Fire-and-forget replenishment (non-blocking)
• Automatic source failover via SockerUnit

Configuration Example:
  const proxy = ProxyUnit.create({
    sources: [
      new OculusSource({ apiToken: 'token' }),
      new FloppyDataSource({ database })
    ]
  });
  
  await proxy.init(); // REQUIRED
  
  const connection = await proxy.get(); // No criteria needed
  // Use with Network unit...

Stats & Monitoring:
• getStats() - Pool statistics
• getPoolStatus() - Detailed pool state
• Events: pool.initialized, pool.replenished, pool.replenish.failed

Sources: ${this.props.socker.whoami()}
    `);
  }
}
