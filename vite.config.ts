import { mkdir, rm, writeFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { basename, join } from 'node:path'
import { generateDtsBundle } from 'dts-bundle-generator'
import { type UserConfig, defineConfig } from 'vite'
import pkg from './package.json'

const dist = join(import.meta.dirname, 'dist')
const src = join(import.meta.dirname, 'src')

export default defineConfig(async ({ command, mode }) => {
  const isBrowser = mode === 'browser'
  const entry = [join(src, 'index.ts'), join(src, 'reporters/HttpReporter.ts')]
  if (!isBrowser) {
    entry.push(
      join(src, 'reporters/FileReporter.ts'),
      join(src, 'reporters/StreamReporter.ts'),
    )
  }

  if (command === 'build' && !isBrowser) {
    const preferredConfigPath = join(import.meta.dirname, 'tsconfig.json')
    await rm(dist, { force: true, recursive: true })
    await mkdir(dist)
    for (const e of entry) {
      const [result] = generateDtsBundle(
        [
          {
            filePath: e,
            output: {
              inlineDeclareGlobals: true,
              noBanner: true,
            },
          },
        ],
        { preferredConfigPath },
      )
      if (!result) {
        throw new Error('dts is empty')
      }
      await writeFile(
        join(dist, basename(e)).replace('.ts', '.d.ts'),
        result,
        'utf-8',
      )
    }
  }

  return {
    build: {
      emptyOutDir: isBrowser,
      outDir: isBrowser ? join(dist, 'browser') : dist,
      target: isBrowser ? ['chrome87'] : ['chrome89', 'node14'], // electron 12
      lib: {
        entry: entry,
        fileName(format, entry) {
          return format === 'es' ? entry.concat('.js') : entry.concat('.cjs')
        },
        formats: isBrowser ? ['es'] : ['es', 'cjs'],
      },
      minify: isBrowser,
      reportCompressedSize: isBrowser,
      rollupOptions: {
        external: isBrowser
          ? []
          : [
              ...builtinModules,
              ...(isBrowser ? [] : Object.keys(pkg.dependencies)),
            ],
      },
      sourcemap: isBrowser,
    },
  } satisfies UserConfig
})
