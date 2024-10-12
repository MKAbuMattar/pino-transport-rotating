import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/index.ts',
    external: [
      'pino-abstract-transport',
      'pino-pretty',
      'rotating-file-stream',
    ],
    plugins: [
      terser(),
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
