import remarkFrontmatter from 'remark-frontmatter';
import { $nodeSchema, $remark } from '@milkdown/kit/utils';

/**
 * YAML front matter (the `---` block at the top of notes from Obsidian,
 * Jekyll or Hugo). Plain CommonMark reads it as a thematic break plus a
 * setext heading, and the first edit rewrote it into `***` and a `## `
 * heading. Parsed with remark-frontmatter, it becomes an editable plain
 * text block saved back exactly as typed.
 */
const remarkFrontmatterPlugin = $remark('remarkFrontmatter', () => remarkFrontmatter, ['yaml']);

const frontmatterSchema = $nodeSchema('frontmatter', () => ({
  content: 'text*',
  group: 'block',
  marks: '',
  code: true,
  defining: true,
  isolating: true,
  parseDOM: [{ tag: 'pre.frontmatter', preserveWhitespace: 'full', priority: 60 }],
  toDOM: () => ['pre', { class: 'frontmatter', spellcheck: 'false' }, ['code', 0]],
  parseMarkdown: {
    match: ({ type }) => type === 'yaml',
    runner: (state, node, type) => {
      state.openNode(type);
      if (node.value) {
        state.addText(node.value as string);
      }
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'frontmatter',
    runner: (state, node) => {
      state.addNode('yaml', undefined, node.textContent);
    },
  },
}));

const frontmatter = [remarkFrontmatterPlugin, frontmatterSchema].flat();

export { frontmatter };
