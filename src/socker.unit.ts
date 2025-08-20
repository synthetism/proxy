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
import type { IProxySource, Proxy, SourceHealth, SourceStats } from './types/index.js';

interface SockerConfig {
  sources: IProxySource[];
}

interface SockerProps extends UnitProps {
  sources: IProxySource[];
  currentIndex: number;
}

/**
 * SockerUnit - Internal source manager with multi-provider support
 * 
 * Responsibility: Multi-source orchestration, provider management, failover
 * - Simple 80/20 failover strategy
 * - Round-robin source selection
 * - Async removal across sources that support it
 */
export class SockerUnit extends Unit<SockerProps> {
  protected constructor(props: SockerProps) {
    super(props);
  }

  protected build(): UnitCore {
    const capabilities = Capabilities.create(this.dna.id, {
      replenish: (...args: unknown[]) => this.replenish(args[0] as number),
      remove: (...args: unknown[]) => this.remove(args[0] as string),
      testSources: (...args: unknown[]) => this.testSources()
    });

    // Empty schema - internal unit, not meant for teaching
    const schema = Schema.create(this.dna.id, {});
    
    const validator = Validator.create({
      unitId: this.dna.id,
      capabilities,
      schema,
      strictMode: false
    });

    return { capabilities, schema, validator };
  }

  // Required abstract method implementations
  capabilities(): Capabilities {
    return this._unit.capabilities;
  }

  schema(): Schema {
    return this._unit.schema;
  }

  validator(): Validator {
    return this._unit.validator;
  }

  whoami(): string {
    return `SockerUnit(${this.dna.id}): Source manager with ${this.props.sources.length} sources`;
  }

  help(): void {
    console.log(`
SockerUnit - Internal source manager
- replenish(count): Get proxies from sources (80/20 failover)
- remove(id): Mark proxy as used across all sources
- testSources(): Health check all sources
Sources: ${this.props.sources.length}
    `);
  }

  teach(): TeachingContract {
    return {
      unitId: this.dna.id,
      capabilities: this._unit.capabilities,
      schema: this._unit.schema,
      validator: this._unit.validator
    };
  }

  static create(sources: IProxySource[]): SockerUnit {
    const props: SockerProps = {
      dna: createUnitSchema({ id: 'socker', version: '1.0.0' }),
      sources,
      currentIndex: 0
    };
    return new SockerUnit(props);
  }

  /**
   * 80/20 Simple failover - Try sources in order
   */
  async replenish(count: number): Promise<Proxy[]> {
    for (const source of this.props.sources) {
      try {
        const proxies = await source.get(count);
        if (proxies.length > 0) {
          return proxies;
        }
      } catch (error) {
        this.emit({
          type: 'source.failed',
          timestamp: new Date(),
          error: {
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
        continue; // Try next source
      }
    }
    
    throw new Error('All proxy sources exhausted');
  }

  /**
   * Async removal across all sources that support it
   */
  async remove(id: string): Promise<void> {
    const removePromises = this.props.sources
      .filter(source => source.remove) // Only sources that support removal
      .map(source => source.remove!(id).catch(error => {
        this.emit({
          type: 'source.remove.failed',
          timestamp: new Date(),
          error: {
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }));

    await Promise.allSettled(removePromises);
  }

  /**
   * Test all sources for health check
   */
  async testSources(): Promise<SourceHealth[]> {
    const healthChecks = this.props.sources.map(async (source, index) => {
      try {
        // Try to get 1 proxy as health check
        await source.get(1);
        return {
          source: `source-${index}`,
          healthy: true,
          lastCheck: new Date()
        };
      } catch (error) {
        return {
          source: `source-${index}`,
          healthy: false,
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return Promise.all(healthChecks);
  }

  /**
   * Get stats from all sources that support it
   */
  getSourceStats(): SourceStats[] {
    return this.props.sources
      .map((source, index) => {
        if (source.getStats) {
          return source.getStats();
        }
        return {
          name: `source-${index}`,
          total: 0,
          successful: 0,
          failed: 0
        };
      })
      .filter(stats => stats !== null);
  }

  /**
   * Get current source (round-robin selection)
   */
  getCurrentSource(): IProxySource {
    return this.props.sources[this.props.currentIndex];
  }

  /**
   * Source selection - round-robin for now
   */
  private selectSource(): IProxySource {
    const source = this.props.sources[this.props.currentIndex];
    // Update currentIndex for next call (immutable approach)
    this.props.currentIndex = (this.props.currentIndex + 1) % this.props.sources.length;
    return source;
  }
}
