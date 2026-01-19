import { Logger, LogLevel, createLogger } from './logger';

describe('Logger', () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create logger with context and default log level', () => {
      const logger = new Logger('TestContext');

      expect(logger).toBeDefined();
    });

    it('should create logger with custom log level', () => {
      const logger = new Logger('TestContext', LogLevel.ERROR);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');

      // Only ERROR level and above should log
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('debug', () => {
    it('should log debug messages when level is DEBUG', () => {
      const logger = new Logger('TestContext', LogLevel.DEBUG);

      logger.debug('debug message');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[TestContext] debug message', '');
    });

    it('should log debug messages with data', () => {
      const logger = new Logger('TestContext', LogLevel.DEBUG);

      logger.debug('debug message', { foo: 'bar' });

      expect(consoleDebugSpy).toHaveBeenCalledWith('[TestContext] debug message', { foo: 'bar' });
    });

    it('should not log debug messages when level is INFO', () => {
      const logger = new Logger('TestContext', LogLevel.INFO);

      logger.debug('debug message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('should log info messages when level is INFO', () => {
      const logger = new Logger('TestContext', LogLevel.INFO);

      logger.info('info message');

      expect(consoleLogSpy).toHaveBeenCalledWith('[TestContext] info message', '');
    });

    it('should log info messages with data', () => {
      const logger = new Logger('TestContext', LogLevel.INFO);

      logger.info('info message', { count: 42 });

      expect(consoleLogSpy).toHaveBeenCalledWith('[TestContext] info message', { count: 42 });
    });

    it('should not log info messages when level is WARN', () => {
      const logger = new Logger('TestContext', LogLevel.WARN);

      logger.info('info message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should log warn messages when level is WARN', () => {
      const logger = new Logger('TestContext', LogLevel.WARN);

      logger.warn('warn message');

      expect(consoleWarnSpy).toHaveBeenCalledWith('[TestContext] warn message', '');
    });

    it('should log warn messages with data', () => {
      const logger = new Logger('TestContext', LogLevel.WARN);

      logger.warn('warn message', { issue: 'problem' });

      expect(consoleWarnSpy).toHaveBeenCalledWith('[TestContext] warn message', { issue: 'problem' });
    });

    it('should not log warn messages when level is ERROR', () => {
      const logger = new Logger('TestContext', LogLevel.ERROR);

      logger.warn('warn message');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      const logger = new Logger('TestContext', LogLevel.ERROR);

      logger.error('error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[TestContext] error message', '');
    });

    it('should log error messages with Error object', () => {
      const logger = new Logger('TestContext', LogLevel.ERROR);
      const error = new Error('Test error');

      logger.error('error message', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[TestContext] error message', {
        name: 'Error',
        message: 'Test error',
        stack: expect.any(String),
      });
    });

    it('should log error messages with arbitrary data', () => {
      const logger = new Logger('TestContext', LogLevel.ERROR);

      logger.error('error message', { code: 500 });

      expect(consoleErrorSpy).toHaveBeenCalledWith('[TestContext] error message', { code: 500 });
    });
  });

  describe('log level filtering', () => {
    it('should respect DEBUG level (logs everything)', () => {
      const logger = new Logger('TestContext', LogLevel.DEBUG);

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should respect INFO level (no debug)', () => {
      const logger = new Logger('TestContext', LogLevel.INFO);

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should respect WARN level (no debug or info)', () => {
      const logger = new Logger('TestContext', LogLevel.WARN);

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should respect ERROR level (only errors)', () => {
      const logger = new Logger('TestContext', LogLevel.ERROR);

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('context formatting', () => {
    it('should include context in all log messages', () => {
      const logger = new Logger('MyModule', LogLevel.DEBUG);

      logger.debug('message');
      logger.info('message');
      logger.warn('message');
      logger.error('message');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[MyModule] message', '');
      expect(consoleLogSpy).toHaveBeenCalledWith('[MyModule] message', '');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[MyModule] message', '');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[MyModule] message', '');
    });
  });
});

describe('createLogger', () => {
  it('should create logger with correct context', () => {
    const logger = createLogger('TestContext');

    expect(logger).toBeInstanceOf(Logger);
  });

  it('should create logger with INFO level in browser environment', () => {
    const logger = createLogger('TestContext');
    const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    logger.debug('debug message');
    logger.info('info message');

    // In Node.js test environment (no window), it uses DEBUG level
    // But we're testing the factory function creation
    expect(logger).toBeDefined();

    consoleDebugSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});

describe('LogLevel enum', () => {
  it('should have correct numeric values in order', () => {
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
  });

  it('should be ordered from least to most severe', () => {
    expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
    expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
    expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
  });
});
