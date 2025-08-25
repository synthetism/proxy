import { 
  Unit, 
  type UnitProps, 
  createUnitSchema, 
  type TeachingContract,
  type UnitCore,
  type Event,
  Capabilities,
  Schema,
  Validator
} from '@synet/unit';
import { createState, type State } from '@synet/state';
import { Socker } from './socker.unit.js';
import { Validate } from './validate.unit.js';
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
  socker: Socker;
  validator: Validate;
  poolState: State; // State unit from @synet/state
  poolSize: number;
  rotationThreshold: number;
}

interface PoolData {
  proxies: ProxyItem[];
  size: number;
  lastRefresh: Date | null;
}

export interface ProxyEvent extends Event {
  type: 'pool.initialized' | 'pool.replenished' | 'pool.replenish.failed' | 'pool.init.failed' | 'proxy.remove.failed';
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
      get: (...args: unknown[]) => this.get(),
      exclusive: (...args: unknown[]) => this.exclusive(),
      failed: (...args: unknown[]) => this.failed(args[0] as ProxyConnection),
      validate: (...args: unknown[]) => this.validate(args[0] as ProxyConnection),
      delete: (...args: unknown[]) => this.delete(args[0] as ProxyConnection),
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
        description: 'Get proxy connection (clean - no marking as used)',
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
      exclusive: {
        name: 'exclusive',
        description: 'Get proxy connection and mark as used (exclusive access)',
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
    // Basic principle: Convention over configuration, impose reasonable defaults
    const poolSize = config.poolSize ?? 20; // No choice - 20 is optimal for most operations
    const rotationThreshold = config.rotationThreshold ?? 0.3; // No choice - 30% is optimal

    const socker = Socker.create(config.sources);
    const validator = Validate.create();
    const poolState = createState('proxy-pool', {
      proxies: [],
      size: 0,
      lastRefresh: null,
      initialized: false  // Track initialization in state
    });

    const props: ProxyProps = {
      dna: createUnitSchema({ id: 'proxy', version: '1.0.7' }),
      socker,
      validator,
      poolState,
      poolSize,
      rotationThreshold
    };

    return new ProxyUnit(props);
  }

  /**
   * REQUIRED: Initialize proxy pool before first use
   */
  async init(): Promise<void> {
    const isInitialized = this.props.poolState.get<boolean>('initialized') || false;
    if (isInitialized) {
      return; // Already initialized - idempotent
    }

    try {
      // Initial pool population
      const initialProxies = await this.props.socker.replenish(this.props.poolSize);
      
      // Update state using key-value pairs
      this.props.poolState.set('proxies', initialProxies);
      this.props.poolState.set('size', initialProxies.length);
      this.props.poolState.set('lastRefresh', new Date());
      this.props.poolState.set('initialized', true);

      this.emit<ProxyEvent>({
        type: 'pool.initialized',
        timestamp: new Date()
      });

    } catch (error) {
      this.emit<ProxyEvent>({
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
   * Get proxy connection (clean - no marking as used)
   * Base principle: Simple get, no side effects
   */
  async get(): Promise<ProxyConnection> {
    const isInitialized = this.props.poolState.get<boolean>('initialized') || false;
    if (!isInitialized) {
      throw new Error(`[${this.dna.id}] Proxy pool not initialized - call init() first`);
    }

    // Get from current pool immediately
    const proxy = this.getFromPool();
    if (!proxy) {
      throw new Error(`[${this.dna.id}] Proxy pool exhausted - replenishment in progress`);
    }

    return this.formatProxyConnection(proxy);
  }

  /**
   * Get proxy connection and mark as used (exclusive access)
   * Uses get() for clean code reuse
   */
  async exclusive(): Promise<ProxyConnection> {
    const proxy = await this.get(); // Reuse get() logic
    
    // Mark as used and trigger replenishment check
    this.markProxyAsUsed(proxy.id);
    
    // Check if pool needs replenishment after marking as used
    if (this.shouldReplenish() && !this.isReplenishing()) {
      this.replenishPool(); // Fire and forget - SMITH PRINCIPLE
    }

    return proxy;
  }

  /**
   * Mark proxy as failed and remove from pool
   * Use when proxy fails - cleaner than delete()
   */
  async failed(proxy: ProxyConnection): Promise<void> {
    // Remove from local pool immediately
    this.removeFromPool(proxy.id);
    
    // Note: No source removal - let pool logic handle cleanup
    // This preserves pool integrity and avoids corruption
  }

  /**
   * Validate proxy connection using ValidateUnit
   */
  async validate(proxy: ProxyConnection): Promise<boolean> {
    return await this.props.validator.validate(proxy);
  }

  /**
   * Remove proxy from pool and mark as used
   * Base principle:: Fire and forget, no complex state management
   */
  async delete(proxy: ProxyConnection): Promise<void> {
    // Remove from local pool immediately
    this.removeFromPool(proxy.id);
    
    // Async removal from source (fire and forget)
    this.props.socker.remove(proxy.id)
      .catch(error => {
        this.emit<ProxyEvent>({
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
      initialized: this.props.poolState.get<boolean>('initialized') || false
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
        age: Date.now() - p.createdAt.getTime(),
      }))
    };
  }

  /**
   * Check if pool needs replenishment
   */
  private shouldReplenish(): boolean {
    const proxies = this.props.poolState.get<ProxyItem[]>('proxies') || [];
    const availableCount = proxies.filter((p: ProxyItem) => !p.used).length;
    const threshold = this.props.poolSize * this.props.rotationThreshold;
    return availableCount <= threshold;
  }

  /**
   * Check if replenishment is already in progress
   * Prevents race conditions from multiple simultaneous replenishments
   */
  private isReplenishing(): boolean {
    return this.props.poolState.get<boolean>('replenishing') || false;
  }

  /**
   * Async pool replenishment (non-blocking)
   * Base principle: Fire and forget, handle errors internally
   */
  private replenishPool(): void {
    // Set replenishing flag
    this.props.poolState.set('replenishing', true);
    
    const proxies = this.props.poolState.get<ProxyItem[]>('proxies') || [];
    const availableCount = proxies.filter((p: ProxyItem) => !p.used).length;
    const neededCount = this.props.poolSize - availableCount;

    console.log('availableCount: ', availableCount);
    console.log('Needed count: ', neededCount);
    this.props.socker.replenish(neededCount)
      .then(newProxies => {
        if (newProxies.length > 0) {
          this.addToPool(newProxies);
          this.emit<ProxyEvent>({
            type: 'pool.replenished',
            timestamp: new Date()
          });
        }
      })
      .catch(error => {
        this.emit<ProxyEvent>({
          type: 'pool.replenish.failed',
          timestamp: new Date(),
          error: {
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      })
      .finally(() => {
        // Clear replenishing flag regardless of outcome
        this.props.poolState.set('replenishing', false);
      });
  }

  /**
   * Get proxy from pool - simplified, no criteria
   * Simple matching, just get next available
   */
  private getFromPool(): ProxyItem | null {
    const proxies = this.props.poolState.get<ProxyItem[]>('proxies') || [];
    const availableProxies = proxies.filter((p: ProxyItem) => !p.used);

    if (availableProxies.length === 0) {
      return null;
    }

    return availableProxies[0]; // First available 
  }

  /**
   * Mark proxy as used - explicit and visible
   */
  private markProxyAsUsed(proxyId: string): void {
    const currentProxies = this.props.poolState.get<ProxyItem[]>('proxies') || [];
    const updatedProxies = currentProxies.map((p: ProxyItem) => 
      p.id === proxyId ? { ...p, used: true } : p
    );
    
    this.props.poolState.set('proxies', updatedProxies);
  }

  /**
   * Format proxy for Network unit consumption - clean separation
   */
  private formatProxyConnection(proxy: ProxyItem): ProxyConnection {
    return {
      id: proxy.id,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      protocol: proxy.protocol,
      country: proxy.country
    };
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

REQUIRED INITIALIZATION:
  await proxy.init(); // Must call before use

TWO METHODS FOR PROXY ACCESS:
  const connection = await proxy.get();     // Clean get - no marking as used
  const connection = await proxy.release(); // Get + mark as used

OTHER METHODS:
  const isValid = await proxy.validate(connection); // Validate using ValidateUnit
  await proxy.delete(connection); // Remove from pool

Pool Management (Automatic):
• 20 proxy pool size (convention over configuration)
• 30% replenishment threshold (convention over configuration)
• Fire-and-forget replenishment (non-blocking)
• Automatic source failover via Socker

Configuration Example:
  const proxy = ProxyUnit.create({
    sources: [
      new OculusSource({ apiToken: 'token' }),
      new FloppyDataSource({ database })
    ]
  });
  
  await proxy.init(); // REQUIRED
  
  const connection = await proxy.get();     // No side effects
  const connection = await proxy.release(); // Marks as used
  // Use with Network unit...

Stats & Monitoring:
• getStats() - Pool statistics
• getPoolStatus() - Detailed pool state
• Events: pool.initialized, pool.replenished, pool.replenish.failed

Sources: ${this.props.socker.whoami()}
Validation: ${this.props.validator.whoami()}
    `);
  }
}
