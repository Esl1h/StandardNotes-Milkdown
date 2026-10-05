import remarkFrontmatter from 'remark-frontmatter';
import { $nodeSchema, $remark } from '@milkdown/kit/utils';

/**
 * Front matter: the YAML block between `---` fences, or the TOML one
 * between `+++` fences (notes from Obsidian, Jekyll or Hugo). Plain
 * CommonMark reads YAML as a thematic break plus a setext heading, and the
 * first edit rewrote it into `***` and a `## ` heading. Parsed with
 * remark-frontmatter, it becomes an editable plain text block saved back
 * exactly as typed, with the fences it came with.
 */
const KINDS = ['yaml', 'toml'] as const;
type Kind = (typeof KINDS)[number];

const remarkFrontmatterPlugin = $remark('remarkFrontmatter', () => remarkFrontmatter, [...KINDS]);

const frontmatterSchema = $nodeSchema('frontmatter', () => ({
  content: 'text*',
  attrs: { kind: { default: 'yaml' } },
  group: 'block',
  marks: '',
  code: true,
  defining: true,
  isolating: true,
  parseDOM: [
    {
      tag: 'pre.frontmatter',
      preserveWhitespace: 'full',
      priority: 60,
      getAttrs: (dom) => ({ kind: (dom as HTMLElement).dataset.kind === 'toml' ? 'toml' : 'yaml' }),
    },
  ],
  toDOM: (node) => [
    'pre',
    { class: 'frontmatter', 'data-kind': node.attrs.kind as Kind, spellcheck: 'false' },
    ['code', 0],
  ],
  parseMarkdown: {
    match: ({ type }) => (KINDS as readonly string[]).includes(type),
    runner: (state, node, type) => {
      state.openNode(type, { kind: node.type });
      if (node.value) {
        state.addText(node.value as string);
      }
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'frontmatter',
    runner: (state, node) => {
      state.addNode(node.attrs.kind as Kind, undefined, node.textContent);
    },
  },
}));

const frontmatter = [remarkFrontmatterPlugin, frontmatterSchema].flat();

export { frontmatter };
