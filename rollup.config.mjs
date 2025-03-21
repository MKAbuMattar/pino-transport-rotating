import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/index.ts',
    external: [
      'node:buffer',
      'node:fs',
      'node:fs/promises',
      'node:path',
      'node:stream',
      'node:util',
      'node:zlib',
      'pino-abstract-transport',
      'pino-pretty',
      'rotating-file-stream',
    ],
    plugins: [
      typescript({
        tsconfig: 'tsconfig.json',
        declaration: true,
        rootDir: 'src',
        sourceMap: true,
      }),
    ],
    output: [
      {
        file: 'lib/index.js',
        name: 'PinoTransportRotating',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      {
        file: 'lib/index.mjs',
        name: 'PinoTransportRotating',
        format: 'es',
        sourcemap: true,
      },
    ],
  },
];
