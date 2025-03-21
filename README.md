# Pino Plugin - Rotating File Transport

<div align="center">
  <a href="https://www.npmjs.com/package/pino-transport-rotating/v/latest" target="_blank" rel="noreferrer">
    <img src="https://img.shields.io/npm/v/pino-transport-rotating/latest?style=for-the-badge&logo=npm&logoColor=white&color=d52128" alt="Latest NPM Version"/>
  </a>

  <a href="https://github.com/MKAbuMattar/pino-transport-rotating" target="_blank" rel="noreferrer">
    <img src="https://img.shields.io/badge/github-%23181717.svg?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repository"/>
  </a>

  <a href="https://github.com/MKAbuMattar/pino-transport-rotating/releases" target="_blank" rel="noreferrer">
    <img alt="GitHub Release" src="https://img.shields.io/github/v/release/MKAbuMattar/pino-transport-rotating?color=%23d52128&label=Latest%20release&style=for-the-badge" />
  </a>

  <a href="/LICENSE" target="_blank" rel="noreferrer">
    <img alt="GitHub License" src="https://img.shields.io/github/license/MKAbuMattar/pino-transport-rotating?color=%23d52128&style=for-the-badge">
  </a>

  <a href="https://github.com/MKAbuMattar/pino-transport-rotating/stargazers" target="_blank" rel="noreferrer">
    <img alt="GitHub Stars" src="https://img.shields.io/github/stars/MKAbuMattar/pino-transport-rotating?color=%23d52128&label=GitHub%20Stars&style=for-the-badge">
  </a>
</div>

This module provides a custom logging transport for the `pino` logger that uses rotating file streams to manage log files. It supports log file rotation based on size and time intervals, and it can be configured to include log file compression.

## Features

- **File Rotation**: Rotates log files based on size and time intervals.
- **Compression**: Compresses rotated log files using gzip.
- **Custom Filename**: Allows customization of the log file name.
- **Enable/Disable**: Option to enable or disable logging.
- **Size Limit**: Configurable size limit for log file rotation.
- **Interval**: Configurable time interval for log file rotation.
- **Compression Method**: Configurable compression method for rotated log files.
- **Immutability**: Option to apply immutability to rotated log files.
- **Event Handling**: Emits a `rotated` event when a log file is rotated.

## Usage

To use the plugin, import it and provide the required configuration options:

```typescript
import path from "node:path";
import { pino, LoggerOptions } from "pino";

const loggerOptions: LoggerOptions = {
  name: "server start",
  level: "trace",
  transport: {
    targets: [
      {
        level: "info",
        target: "pino-pretty",
        options: {
          colorize: true,
        },
      },
      {
        level: "info",
        target: "pino-transport-rotating",
        options: {
          dir: path.join(process.cwd(), "logs"),
          filename: "all",
          enabled: true,
          size: "100K",
          interval: "1d",
          compress: true,
          immutable: true,
        },
      },
      {
        level: "error",
        target: "pino-transport-rotating",
        options: {
          dir: path.join(process.cwd(), "logs"),
          filename: "error",
          enabled: true,
          size: "100K",
          interval: "1d",
          compress: true,
          immutable: true,
        },
      },
    ],
  },
};

const logger = pino(loggerOptions);

logger.info("Server started");
logger.error("An error occurred");
```

## Configuration Options

The plugin accepts the following options:

- `dir` (string, required): The directory where the log files will be saved.
- `filename` (string, optional): The base name of the log file. Defaults to `'app'`.
- `enabled` (boolean, optional): If `false`, logging is disabled. Defaults to `true`.
- `size` (string, optional): The size at which to rotate the log files. Defaults to `'100K'`.
- `interval` (string, optional): The interval at which to rotate the log files. Defaults to `'1d'`.
- `compress` (boolean, optional): Whether to compress rotated files. Defaults to `true`.
- `immutable` (boolean, optional): Whether to apply immutability to the rotated files. Defaults to `true`.

### Example Configuration

```typescript
{
  dir: '/var/log/app',
  filename: 'app',
  enabled: true,
  size: '100K',
  interval: '1d',
  compress: true,
  immutable: true,
}
```

## File Rotation

The log files are rotated based on the following parameters:

- **Size**: `100 KB (100K)` - Log files are rotated when they reach 100 KB in size (configurable).
- **Interval**: `1 day (1d)` - Log files are rotated daily (configurable).
- **Compression**: `gzip` - Rotated files are compressed using gzip (configurable).
- **Filename Pattern**: `${filename}-${timestamp}.log` - The rotated files are named using the `${filename}-${timestamp}.log` pattern.

### Rotated Event

The plugin emits a `rotated` event whenever a log file is rotated. This event can be used to perform additional actions, such as compressing the rotated file. For example:

```typescript
rotatingStream.on("rotated", async (rotatedFile) => {
  console.log(`Log file rotated: ${rotatedFile}`);
  // Additional actions, such as compression, can be performed here.
});
```

## Notes

- Ensure that the directory specified in `dir` exists and is writable by the application.
- The `enabled` option can be used to turn off logging without removing the transport configuration.
- The `compress` option, when enabled, compresses rotated files into `.gz` format and deletes the original file after successful compression.
- The `immutable` option ensures that rotated files are not modified after creation.
- The `rotated` event provides a hook for custom post-rotation actions, such as archiving or uploading rotated files.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
