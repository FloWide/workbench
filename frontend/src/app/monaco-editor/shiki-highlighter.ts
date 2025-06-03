import { createHighlighterCore } from '@shikijs/core'
import { createOnigurumaEngine } from '@shikijs/engine-oniguruma'

import darkPlus from 'shiki/dist/themes/dark-plus.mjs'
import lightPlus from 'shiki/dist/themes/light-plus.mjs'

const LANGUAGES = [
    'javascript',
    'typescript',
    'json',
    'yaml',
    'yml',
    'python',
    'toml',
    'jsx',
    'tsx',
    'css',
    'html',
]


export async function createHighlighter() {
  return createHighlighterCore({
    themes: [darkPlus, lightPlus],
    langs: LANGUAGES.map((l) => import(`shiki/dist/langs/${l}.mjs`)),

    engine: createOnigurumaEngine(import('shiki/dist/wasm.mjs')),
  })
}