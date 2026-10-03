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

/**
 * Builds the editor from the Crepe features this plugin uses. The `Crepe`
 * class imports every feature statically, so even with Latex disabled it
 * bundles KaTeX (and the AI feature); the builder only pulls what is added.
 *
 * Same features and order as Crepe's defaults, minus Latex, plus the
 * optional top bar. The code block config repeats Crepe's defaults, which
 * the builder does not apply.
 */
function createCrepe(root: HTMLElement, defaultValue: string, withTopBar: boolean): CrepeBuilder {
  const crepe = new CrepeBuilder({ root, defaultValue })
    .addFeature(cursor)
    .addFeature(listItem)
    .addFeature(linkTooltip)
    .addFeature(imageBlock)
    .addFeature(blockEdit)
    .addFeature(placeholder, { text: 'Type / for commands' })
    .addFeature(toolbar)
    .addFeature(codeMirror, { theme: oneDark, languages })
    .addFeature(table);
  return withTopBar ? crepe.addFeature(topBar) : crepe;
}

export { createCrepe };
