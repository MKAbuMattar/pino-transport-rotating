import {Buffer} from 'node:buffer';
import path from 'node:path';
import {Transform, type TransformCallback, pipeline} from 'node:stream';
import build, {type OnUnknown} from 'pino-abstract-transport';
import {prettyFactory} from 'pino-pretty';
import {type RotatingFileStream, createStream} from 'rotating-file-stream';

export type PinoTransportOptions = {
  dir: string;
  filename: string;
  enabled: boolean;
  size: string;
  interval: string;
  compress: string;
  immutable: boolean;
};

/**
 * @function pad
 * @description Pads a number to ensure it has at least two digits by adding a leading zero if necessary.
 * @param {number} num - The number to pad.
 * @returns {string} The padded string representation of the number.
 */
export function pad(num: number): string {
  return num.toString().padStart(2, '0');
}

/**
 * @function generator
 * @description Generates the file path for the rotating log file.
 * @param {number | Date | null} time - The current time (or null for the initial log file).
 * @param {number | undefined} index - The file index for rotation.
 * @param {string} dir - The directory to store log files.
 * @param {string} filename - The base filename for log files.
 * @throws Error if the time value is not a Date object.
 * @returns {string} The file path for the rotating log file.
 */
export function generator(
  time: number | Date | null,
  index: number | undefined,
  dir: string,
  filename: string,
): string {
  if (!time) return path.join(dir, `${filename}.log`);
  const _date = new Date(time);
  const date = `${_date.getFullYear()}-${pad(_date.getMonth() + 1)}-${pad(_date.getDate())}`;
  return path.join(dir, `${filename}-${date}.${index}.log`);
}

/**
 * @typedef {Object} PinoTransportOptions
 * @property {string} dir - The directory to store log files.
 * @property {string} filename - The base filename for log files.
 * @property {boolean} enabled - Whether the transport is enabled.
 * @property {string} size - The maximum size of the log file before rotation.
 * @property {string} interval - The interval at which to rotate the log file.
 * @property {string} compress - The compression algorithm to use for rotated log files.
 * @property {boolean} immutable - Whether to use immutable logs.
 */

/**
 * @function pinoTransportRotatingFile
 * @description Creates a Pino transport that writes logs to a rotating file.
 * @param {Partial<PinoTransportOptions>} options - The options for the transport.
 * @returns {Promise<Transform & OnUnknown>} The Pino transport that writes logs to a rotating file.
 */
export async function pinoTransportRotatingFile(
  options: Partial<PinoTransportOptions> = {
    dir: '',
    filename: 'app',
    enabled: true,
    size: '100K',
    interval: '1d',
    compress: 'gzip',
    immutable: true,
  },
): Promise<Transform & OnUnknown> {
  const {
    dir,
    filename = 'app',
    enabled = true,
    size = '100K',
    interval = '1d',
    compress = 'gzip',
    immutable = true,
  } = options;

  if (!enabled) {
    const transform: Promise<Transform & OnUnknown> &
      Transform &
      OnUnknown &
      Promise<Transform> = build((source) => source, {
      parse: 'lines',
      // @ts-expect-error
      enablePipelining: false,
      close() {},
      expectPinoConfig: true,
    });
    return transform;
  }

  if (!dir) {
    throw new Error('Missing required option: dir');
  }

  const rotatingStream: RotatingFileStream = createStream(
    (time, index) => generator(time, index, dir, filename),
    {
      size,
      interval,
      compress,
      immutable,
    },
  );

  return build(
    (source: Transform & OnUnknown) => {
      const pretty = prettyFactory({colorize: false});

      const prettyStream: Transform = new Transform({
        objectMode: true,
        autoDestroy: true,
        transform(
          chunk: any,
          encoding: BufferEncoding,
          callback: TransformCallback,
        ) {
          try {
            const logMessage = Buffer.isBuffer(chunk)
              ? chunk.toString(encoding)
              : chunk;

            const prettyLog = pretty(logMessage);

            callback(null, prettyLog);
          } catch (error: unknown) {
            // Enhanced error handling
            if (error instanceof Error) {
              callback(error); // Pass the existing Error
            } else if (typeof error === 'string') {
              callback(new Error(error)); // Wrap the string in an Error
            } else {
              callback(new Error('An unknown error occurred')); // Generic Error for unexpected cases
            }
          }
        },
      });

      pipeline(
        source,
        prettyStream,
        rotatingStream,
        (err: NodeJS.ErrnoException | null) => {
          if (err) {
            console.error('Failed to write log in transport:', err);
          }
        },
      );

      return prettyStream;
    },
    {
      parse: 'lines',
      // @ts-expect-error
      enablePipelining: false,
      async close() {
        await new Promise<void>((resolve) => {
          rotatingStream.end(() => resolve());
        });
      },
      expectPinoConfig: true,
    },
  );
}

export default pinoTransportRotatingFile;
