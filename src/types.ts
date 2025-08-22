export interface ProxyItem {
  id: string;
  ttl: number;
  source: string;
  used?: boolean;
  createdAt: Date;
}

export interface ProxyConnection {
  id: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks5';
  type?: 'datacenter' | 'residential';
  country?: string;
}

export interface ProxyCriteria {
  country?: string;
  protocol?: 'http' | 'socks5';
  type?: 'datacenter' | 'residential';
}

export interface SourceStats {
  name: string;
  total: number;
  successful: number;
  failed: number;
  lastSuccess?: Date;
  lastFailure?: Date;
}

export interface SourceHealth {
  source: string;
  healthy: boolean;
  lastCheck: Date;
  error?: string;
}

export interface IProxySource {
  get(count: number): Promise<ProxyItem[]>;
  remove?(id: string): Promise<void>;  // Mark proxy as used in source
  validate?(proxy: ProxyItem): Promise<boolean>;
}

export interface ProxyStats {
  poolSize: number;
  currentSize: number;
  available: number;
  lastRefresh: Date | null;
  rotationThreshold: number;
  initialized: boolean;
}

export interface PoolStatus extends ProxyStats {
  shouldReplenish: boolean;
  proxies: Array<{
    id: string;
    source: string;
    used: boolean;
    age: number;
  }>;
}
