# Testing Guide

Comprehensive guide for testing SnowClash server logic with Jest.

**Related Documentation:**
- [Architecture Guide](./ARCHITECTURE.md) - Understanding the codebase structure
- [API Reference](./API.md) - Server API and message protocols
- [Contributing](./CONTRIBUTING.md) - Development workflow

---

## Table of Contents

- [Setup](#setup)
- [Running Tests](#running-tests)
- [Test Files](#test-files)
- [Test Coverage](#test-coverage)
- [Writing New Tests](#writing-new-tests)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)
- [Future Test Coverage](#future-test-coverage)

---

## Setup

The testing dependencies are already included in the project. If you need to reinstall:

```bash
npm install
```

Testing stack:
- **Jest**: Test framework
- **ts-jest**: TypeScript support for Jest
- **@types/jest**: TypeScript type definitions

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (auto-rerun on file changes)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

## Test Files

### 1. NicknameGenerator Tests
**File**: `src/server/utils/NicknameGenerator.test.ts`

Tests for random nickname generation:
- ✅ Nickname format validation (AdjectiveNounNumber)
- ✅ Number range validation (0-99)
- ✅ Uniqueness verification
- ✅ Valid adjective/noun usage
- ✅ Length constraints (≤ 20 characters)
- ✅ Bot nickname generation

**Run**: `jest NicknameGenerator.test.ts`

### 2. BotController Tests
**File**: `src/server/bots/BotController.test.ts`

Tests for bot AI system:
- ✅ Bot creation with correct properties
- ✅ Team assignment (red/blue)
- ✅ Bot positioning in correct territory
- ✅ Team filling (3v3 enforcement)
- ✅ Bot movement during playing phase
- ✅ Stunned bot behavior (no movement)
- ✅ Periodic snowball throwing (2s interval)
- ✅ Direction changes (1s interval)
- ✅ Territory boundary enforcement
- ✅ Bot removal

**Run**: `jest BotController.test.ts`

### 3. GameRoom Tests
**File**: `src/server/rooms/GameRoom.test.ts`

Tests for core game logic:
- ✅ Room initialization
- ✅ Player join/leave mechanics
- ✅ Nickname sanitization (XSS prevention)
- ✅ Max player enforcement (6 players)
- ✅ Team selection and balancing
- ✅ Ready system
- ✅ Host authority (first player)
- ✅ Host transfer on leave
- ✅ Game start conditions
- ✅ Snowball mechanics (normal/charged damage)
- ✅ Snowball direction (red: ↙, blue: ↗)

**Run**: `jest GameRoom.test.ts`

## Test Coverage

After running `npm run test:coverage`, check the `coverage/` directory for detailed reports:

```bash
# View HTML coverage report
open coverage/lcov-report/index.html
```

Expected coverage for core server logic:
- **NicknameGenerator**: ~100% (simple utility)
- **BotController**: ~90% (comprehensive bot behavior)
- **GameRoom**: ~70% (complex integration, some private methods)

## Writing New Tests

### Test Structure

```typescript
import { MyClass } from './MyClass';

describe('MyClass', () => {
  describe('myMethod', () => {
    it('should do something specific', () => {
      // Arrange
      const instance = new MyClass();

      // Act
      const result = instance.myMethod();

      // Assert
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Best Practices

1. **Use descriptive test names**: Test names should clearly describe what is being tested
2. **Arrange-Act-Assert pattern**: Organize tests into setup, execution, and verification
3. **Test one thing per test**: Each test should verify a single behavior
4. **Use beforeEach for setup**: Avoid duplication by using setup hooks
5. **Mock external dependencies**: Isolate the unit under test
6. **Test edge cases**: Include boundary conditions, empty inputs, etc.

## Continuous Integration

To run tests in CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: |
    npm install
    npm test

- name: Check coverage
  run: npm run test:coverage
```

## Troubleshooting

### Issue: "Cannot find module '@colyseus/schema'"
**Solution**: Make sure all dependencies are installed
```bash
npm install
```

### Issue: Tests timeout
**Solution**: Increase Jest timeout in jest.config.js
```javascript
module.exports = {
  testTimeout: 10000, // 10 seconds
  // ... other config
};
```

### Issue: "ReferenceError: regeneratorRuntime is not defined"
**Solution**: This is usually fixed by ts-jest. Make sure jest.config.js uses 'ts-jest' preset.

## Future Test Coverage

Areas to expand test coverage:

### Server Side
- [ ] Snowball collision detection logic
- [ ] Win condition checking (all opponents stunned)
- [ ] Player movement validation (territory boundaries)
- [ ] Ready timeout enforcement (60s auto-kick)
- [ ] Game end cleanup (bot removal, interval clearing)

### Integration Tests
- [ ] Full game flow (lobby → playing → ended)
- [ ] Multiple players joining/leaving
- [ ] Team balance maintenance
- [ ] Bot behavior in full game scenario

### Client Side (Future)
- [ ] Scene transitions (MainMenu → Lobby → Game)
- [ ] Input handling (keyboard/pointer)
- [ ] Client-side prediction accuracy
- [ ] Animation state management
- [ ] UI component interactions

### Performance Tests
- [ ] Game loop performance (60 FPS maintenance)
- [ ] Memory leak detection
- [ ] Snowball cleanup efficiency
- [ ] State synchronization overhead

## Test Statistics

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| NicknameGenerator | 10 | 100% |
| BotController | 18 | 91.4% |
| GameRoom | 16 (9 skipped) | 29.16% |
| **Total** | **44 passed** | **59.23%** |

*Note: GameRoom has lower coverage because message handling tests are skipped (require Colyseus test utilities).*

---

## Related Documentation

- **[Architecture Guide](./ARCHITECTURE.md)** - Understanding the system design
- **[API Reference](./API.md)** - Server API and message protocols
- **[Game Mechanics](./GAME_MECHANICS.md)** - Game rules and expected behavior
- **[Contributing](./CONTRIBUTING.md)** - Development workflow and guidelines

## Navigation

- [← Back to Documentation Index](./README.md)
- [← Back to Main README](../README.md)

---

**Last Updated**: 2026-01-15
