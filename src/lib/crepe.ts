import { CrepeBuilder } from '@milkdown/crepe/builder';
import { blockEdit } from '@milkdown/crepe/feature/block-edit';
import { codeMirror } from '@milkdown/crepe/feature/code-mirror';
import { cursor } from '@milkdown/crepe/feature/cursor';
import { imageBlock } from '@milkdown/crepe/feature/image-block';
import { linkTooltip } from '@milkdown/crepe/feature/link-tooltip';
import { listItem } from '@milkdown/crepe/feature/list-item';
import { placeholder } from '@milkdown/crepe/feature/placeholder';
import { table } from '@milkdown/crepe/feature/table';
import { toolbar } from '@milkdown/crepe/feature/toolbar';
import { topBar } from '@milkdown/crepe/feature/top-bar';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { embedImage } from './image';
import { renderMermaidPreview } from './mermaid';
import { frontmatter } from './frontmatter';

// Latex pulls KaTeX in (about 90 KB gzipped plus fonts); it is split into
// its own chunk, and the import starts right away so it is usually loaded
// by the time Standard Notes has streamed the note in.
const latexFeature = import('./latex');

/**
 * Builds the editor from the Crepe features this plugin uses. The `Crepe`
 * class imports every feature statically (the AI one and an eager KaTeX
 * included); the builder only pulls what is added, and Latex lazily.
 *
 * Same features and order as Crepe's defaults, plus the optional top bar.
 * The code block config repeats Crepe's defaults, which the builder does
 * not apply.
 */
async function createCrepe(
  root: HTMLElement,
  defaultValue: string,
  withTopBar: boolean
): Promise<CrepeBuilder> {
  const { latex } = await latexFeature;
  const crepe = new CrepeBuilder({ root, defaultValue })
    .addFeature(cursor)
    .addFeature(listItem)
    .addFeature(linkTooltip)
    // Uploads (button, paste, drop) are embedded as data URIs: without it
    // Crepe stores a blob: URL that is gone once the note is reopened.
    .addFeature(imageBlock, { onUpload: embedImage })
    .addFeature(blockEdit)
    .addFeature(placeholder, { text: 'Type / for commands' })
    .addFeature(toolbar)
    // Latex, added below, wraps this preview hook for its own blocks.
    .addFeature(codeMirror, { theme: oneDark, languages, renderPreview: renderMermaidPreview })
    .addFeature(table)
    .addFeature(latex);
  // Syntaxes the commonmark/GFM presets would mangle on save.
  crepe.editor.use(frontmatter);
  return withTopBar ? crepe.addFeature(topBar) : crepe;
}

export { createCrepe };
