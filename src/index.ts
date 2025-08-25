// Core types
export type { 
  IProxySource, 
  ProxyItem, 
  ProxyConnection, 
  ProxyCriteria, 
  SourceStats, 
  SourceHealth 
} from './types.js';

// Main proxy unit
export { ProxyUnit, VERSION, type ProxyEvent } from './proxy.unit.js';

// Socker unit
export { Socker } from './socker.unit.js';

// Validate unit
export { Validate } from './validate.unit.js';


// Source implementations
export { OculusSource, type OculusConfig } from './sources/oculus.source.js';
export { ProxyMeshSource, type ProxyMeshConfig } from './sources/proxymesh.source.js';
