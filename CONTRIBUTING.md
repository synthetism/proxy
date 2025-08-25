# Contributing to @synet/proxy

Thank you for your interest in contributing to @synet/proxy! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Adding New Proxy Sources](#adding-new-proxy-sources)
- [Documentation](#documentation)
- [Issue Reporting](#issue-reporting)

## Getting Started

@synet/proxy follows [Unit Architecture](https://github.com/synthetism/unit) principles. Before contributing, please familiarize yourself with:

- Unit Architecture doctrine and patterns
- Consciousness trinity (Capabilities + Schema + Validator)
- Teaching/learning paradigm for capability sharing
- Immutable value objects with identity

## Development Setup

1. **Clone and install dependencies:**
```bash
git clone https://github.com/synthetism/proxy.git
cd proxy
npm install
```

2. **Set up test credentials:**
```bash
# Copy configuration templates
cp private/oculus.json.example private/oculus.json

# Fill in your test credentials (optional for most development)
```

3. **Run tests:**
```bash
npm test          # Run all tests
npm run test:watch # Watch mode during development
```

4. **Run demos:**
```bash
npm run demo              # Basic proxy demo
npm run demo:oculus       # OculusProxies demo
npm run demo:proxymesh    # ProxyMesh demo
```

## Code Style

### Unit Architecture Compliance

All code must follow Unit Architecture latest doctrine:

```typescript
// ✅ Correct: Unit with consciousness trinity
export class MySource extends Unit<MySourceProps> {
  protected constructor(props: MySourceProps) {
    super(props);
  }

  protected build(): UnitCore {
    const capabilities = Capabilities.create(this.dna.id, {
      nativeMethod: (...args) => this.nativeMethod(...args)
    });

    const schema = Schema.create(this.dna.id, {
      nativeMethod: { /* schema definition */ }
    });

    const validator = Validator.create({
      unitId: this.dna.id,
      capabilities,
      schema,
      strictMode: false
    });

    return { capabilities, schema, validator };
  }

  static create(config: MySourceConfig): MySource {
    // Validation and props creation
    return new MySource(props);
  }
}
```

### TypeScript Guidelines

- Use strict TypeScript configuration
- Prefer interfaces for public contracts
- Use proper JSDoc comments for public APIs
- Follow naming conventions: `PascalCase` for classes, `camelCase` for methods

### Error Handling

Follow the two-pattern approach:

```typescript
// Simple operations: Exception-based
throw new Error(`[${this.dna.id}] Clear error message with guidance`);

// Complex operations: Result pattern  
return Result.success(value) || Result.fail(message);
```

## Testing

### Test Structure

Tests should follow the established patterns:

```typescript
describe('MyUnit v1.0.0 - Feature Description', () => {
  let unit: MyUnit;

  beforeEach(async () => {
    unit = MyUnit.create({ /* config */ });
    await unit.init();
  });

  test('consciousness trinity implemented correctly', () => {
    expect(unit.capabilities()).toBeDefined();
    expect(unit.schema()).toBeDefined();
    expect(unit.validator()).toBeDefined();
  });

  test('specific functionality works correctly', async () => {
    const result = await unit.someMethod();
    expect(result).toMatchObject({ /* expected */ });
  });
});
```

### Test Coverage

- All public methods must have tests
- Error conditions should be tested
- Integration patterns should have dedicated test suites
- Mock external API calls appropriately

## Submitting Changes

### Pull Request Process

1. **Create a feature branch:**
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes following the guidelines above**

3. **Ensure all tests pass:**
```bash
npm test
npm run lint
```

4. **Update documentation if needed:**
   - Update README.md for new features
   - Add JSDoc comments for new public APIs
   - Update type definitions

5. **Submit pull request with:**
   - Clear description of changes
   - Link to related issues
   - Screenshots/examples for UI changes
   - Test results confirmation

### Commit Message Format

Follow conventional commits:

```
type(scope): description

feat(sources): add support for new proxy provider
fix(pool): resolve memory leak in replenishment logic
docs(readme): update usage examples for new API
test(unit): add integration tests for failover
```

## Adding New Proxy Sources

### Source Implementation

New proxy sources must implement the `IProxySource` interface:

```typescript
export interface IProxySource {
  get(count: number): Promise<ProxyItem[]>;
  remove?(id: string): Promise<void>;
  validate?(proxy: ProxyItem): Promise<boolean>;
}
```

### Source Guidelines

1. **Follow naming convention:** `[ProviderName]Source`
2. **Implement proper error handling** with provider-specific messages
3. **Add comprehensive tests** including API mocking
4. **Document configuration options** in README.md
5. **Provide setup instructions** including account requirements

### Example Source Structure

```typescript
interface MyProviderConfig {
  apiKey: string;
  region?: string;
}

export class MyProviderSource implements IProxySource {
  constructor(private config: MyProviderConfig) {}

  async get(count: number): Promise<ProxyItem[]> {
    // Implementation with proper error handling
  }

  async remove?(id: string): Promise<void> {
    // Optional: provider-specific cleanup
  }

  async validate?(proxy: ProxyItem): Promise<boolean> {
    // Optional: provider-specific validation
  }
}
```

## Documentation

### README Updates

When adding features, update relevant README sections:

- Add provider to comparison table
- Update configuration examples
- Add troubleshooting entries
- Update API reference

### Code Documentation

Use JSDoc for public APIs:

```typescript
/**
 * Get proxy connections from provider
 * @param count - Number of proxies to retrieve
 * @param criteria - Optional selection criteria
 * @returns Promise resolving to proxy connections
 * @throws {Error} When provider API fails or quota exceeded
 */
async get(count: number, criteria?: ProxyCriteria): Promise<ProxyConnection[]>
```

## Issue Reporting

### Bug Reports

Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS)
- Relevant error messages and stack traces

### Feature Requests

Include:
- Use case description
- Proposed API design
- Implementation considerations
- Backward compatibility impact

### Security Issues

**Do not open public issues for security vulnerabilities.** Please contact the maintainers directly.

## Development Tips

### Debugging

Enable debug logging during development:

```typescript
import { Logger } from '@synet/logger';

const logger = Logger.create({ level: 'debug' });
const unit = Unit.create({ logger });
```

### Testing with Real Providers

- Use test credentials when available
- Mock API responses for CI/CD environments
- Never commit real credentials to the repository
- Use environment variables for sensitive data

### Performance Considerations

- Minimize API calls through intelligent pooling
- Implement proper rate limiting
- Use connection pooling for HTTP requests
- Monitor memory usage during long-running tests

## Questions?

- Check existing issues and discussions
- Review the Unit Architecture documentation
- Ask questions in pull request discussions
- Contact maintainers for complex design decisions

Thank you for contributing to @synet/proxy! 
