import {Buffer} from 'node:buffer';
import {createReadStream, createWriteStream} from 'node:fs';
import {access, stat, unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {Transform, type TransformCallback, pipeline} from 'node:stream';
import {promisify} from 'node:util';
import {createGzip} from 'node:zlib';
import build, {type OnUnknown} from 'pino-abstract-transport';
import {prettyFactory} from 'pino-pretty';
import {type RotatingFileStream, createStream} from 'rotating-file-stream';

/**
 * @constant {Function} pipelineAsync
 * @description Promisified version of the Node.js pipeline function for handling streams.
 */
const pipelineAsync = promisify(pipeline);

export type PinoTransportOptions = {
  dir: string;
  filename: string;
  enabled: boolean;
  size: string;
  interval: string;
  compress: boolean;
  immutable: boolean;
};

/**
 * @function generator
 * @description Generates the file path for the rotating log file.
 *
 * @param {number | Date | null} time - The time to use in the filename.
 * @param {string} dir - The directory to store the log files.
 * @param {string} filename - The base filename for the log files.
 *
 * @returns {string} The generated file path.
 */
function generator(
  time: number | Date | null,
  dir: string,
  filename: string,
): string {
  if (!time) return join(dir, `${filename}.log`);
  const _date = new Date(time);
  const timestamp = _date.toISOString().replace(/[-:T]/g, '').split('.')[0];
  return join(dir, `${filename}-${timestamp}.log`);
}

/**
 * @function fileExists
 * @description Checks if a file exists at the given path.
 *
 * @param {string} path - The path to the file.
 *
 * @returns {Promise<boolean>} A promise that resolves to true if the file exists, otherwise false.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * @function compressFile
 * @description Compresses a file using gzip.
 *
 * @param {string} src - The path to the source file.
 * @param {string} dest - The path to the destination file.
 *
 * @returns {Promise<void>} A promise that resolves when the file has been compressed.
 */
async function compressFile(src: string, dest: string): Promise<void> {
  try {
    const exists = await fileExists(src);
    if (!exists) {
      console.warn(`Skipping compression, file does not exist: ${src}`);
      return;
    }

    const stats = await stat(src);
    if (stats.isDirectory()) {
      console.warn(`Skipping compression, source is a directory: ${src}`);
      return;
    }

    await pipelineAsync(
      createReadStream(src),
      createGzip(),
      createWriteStream(dest),
    );

    if (await fileExists(dest)) {
      try {
        await unlink(src);
      } catch (unlinkError) {
        if (
          unlinkError instanceof Error &&
          (unlinkError as any).code !== 'ENOENT'
        ) {
          console.error(`Error unlinking original file ${src}:`, unlinkError);
        }
      }
    } else {
      console.error(`Compression failed: Destination file ${dest} not found.`);
    }
  } catch (error) {
    console.error(`Error compressing file ${src}:`, error);
  }
}

/**
 * @typedef {Object} PinoTransportOptions
 * @property {string} dir - The directory to store log files.
 * @property {string} filename - The base filename for log files.
 * @property {boolean} enabled - Whether the transport is enabled.
 * @property {string} size - The maximum size of the log file before rotation.
 * @property {string} interval - The interval at which to rotate the log file.
 * @property {boolean} compress - Whether to compress rotated log files.
 * @property {boolean} immutable - Whether to use immutable logs.
 */

/**
 * @function pinoTransportRotatingFile
 * @description Creates a Pino transport that writes logs to a rotating file, optionally compressing rotated files.
 *
 * @param {Partial<PinoTransportOptions>} options - The transport options.
 *
 * @returns {Promise<Transform & OnUnknown>} A promise that resolves to the transport stream.
 */
export async function pinoTransportRotatingFile(
  options: Partial<PinoTransportOptions> = {
    dir: '',
    filename: 'app',
    enabled: true,
    size: '100K',
    interval: '1d',
    compress: true,
    immutable: true,
  },
): Promise<Transform & OnUnknown> {
  const {
    dir,
    filename = 'app',
    enabled = true,
    size = '100K',
    interval = '1d',
    compress = true,
    immutable = true,
  } = options;

  if (!enabled) {
    return build((source) => source, {
      parse: 'lines',
      expectPinoConfig: true,
      // @ts-expect-error
      enablePipelining: false,
      close() {},
    });
  }

  if (!dir) {
    throw new Error('Missing required option: dir');
  }

  const rotatingStream: RotatingFileStream = createStream(
    (time) => generator(time, dir, filename),
    {
      size,
      interval,
      immutable,
    },
  );

  const compressedFiles = new Set<string>();

  if (compress) {
    rotatingStream.on('rotated', async (rotatedFile: string) => {
      try {
        if (compressedFiles.has(rotatedFile)) {
          return;
        }

        const isFile = (await stat(rotatedFile)).isFile();
        if (isFile) {
          const compressedFile = `${rotatedFile}.gz`;
          await compressFile(rotatedFile, compressedFile);
          compressedFiles.add(rotatedFile);
        } else {
          console.warn(
            `Skipping compression, rotated file is a directory: ${rotatedFile}`,
          );
        }
      } catch (err) {
        console.error(`Error compressing rotated file ${rotatedFile}:`, err);
      }
    });
  }

  return build(
    (source: Transform & OnUnknown) => {
      const pretty = prettyFactory({colorize: false});

      const prettyStream: Transform = new Transform({
        objectMode: true,
        autoDestroy: true,
        transform(
          chunk: string | Buffer<ArrayBufferLike> | ArrayBufferView,
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
            callback(
              error instanceof Error
                ? error
                : new Error(String(error) || 'An unknown error occurred'),
            );
          }
        },
      });

      pipeline(source, prettyStream, rotatingStream, (err) => {
        if (err) {
          console.error('Failed to write log in transport:', err);
        }
      });

      return prettyStream;
    },
    {
      parse: 'lines',
      expectPinoConfig: true,
      // @ts-expect-error
      enablePipelining: false,
      async close() {
        await new Promise<void>((resolve) => {
          rotatingStream.end(() => resolve());
        });
      },
    },
  );
}

export default pinoTransportRotatingFile;
