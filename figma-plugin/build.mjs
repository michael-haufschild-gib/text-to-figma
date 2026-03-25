import { build, context } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'code.js',
  target: 'es2017',
  format: 'iife',
  define: {
    __PLUGIN_VERSION__: JSON.stringify(pkg.version)
  }
};

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build(options);
}
