import path from 'node:path';
import {Transform, pipeline} from 'node:stream';

import build from 'pino-abstract-transport';
import {prettyFactory} from 'pino-pretty';
import {createStream} from 'rotating-file-stream';

export type PinoTransportOptions = {
  dir: string;
  filename: string;
  enabled: boolean;
  size: string;
  interval: string;
  compress: string;
  immutable: boolean;
};

async function pinoTransportRotatingFile(
  options: Partial<PinoTransportOptions> = {
    dir: '',
    filename: 'app',
    enabled: true,
    size: '10M',
    interval: '1d',
    compress: 'gzip',
    immutable: true,
  },
) {
  const {
    dir = '',
    filename = 'app',
    enabled = true,
    size = '10M',
    interval = '1d',
    compress = 'gzip',
    immutable = true,
  } = options;

  if (!enabled) {
    return build((source) => source, {
      parse: 'lines',
      close() {},
    });
  }

  if (!dir) {
    throw new Error('Missing required option: dir');
  }

  const pad = (num) => num.toString().padStart(2, '0');
  const generator = (time, index) => {
    if (!time) return path.join(dir, 'app.log');
    const date = `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}`;
    return path.join(dir, `${filename}-${date}.${index}.log`);
  };

  const rotatingStream = createStream(generator, {
    size,
    interval,
    compress,
    immutable,
  });

  return build(
    (source) => {
      const pretty = prettyFactory({colorize: false});

      const prettyStream = new Transform({
        objectMode: true,
        autoDestroy: true,
        transform(chunk, encoding, callback) {
          callback(null, pretty(chunk));
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
      async close() {
        await new Promise((resolve) => {
          rotatingStream.end(() => resolve());
        });
      },
    },
  );
}

export default pinoTransportRotatingFile;
