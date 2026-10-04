import { imageBlockSchema } from '@milkdown/kit/component/image-block';
import { type Ctx } from '@milkdown/kit/ctx';
import { $remark } from '@milkdown/kit/utils';

interface MarkdownNode {
  type: string;
  title?: string | null;
  alt?: string | null;
  children?: MarkdownNode[];
}

function fillImageText(node: MarkdownNode): void {
  if (node.type === 'image' || node.type === 'image-block') {
    node.title ??= '';
    node.alt ??= '';
  }
  node.children?.forEach(fillImageText);
}

/**
 * remark gives `![alt](url)` a null title, and the image schemas only accept
 * strings: ProseMirror threw a RangeError and the image was dropped, so the
 * next save deleted it from the note. An empty title is not written back.
 */
const imageNullFields = $remark('imageNullFields', () => () => (tree: MarkdownNode) => {
  fillImageText(tree);
});

/**
 * Crepe's image block stores its resize ratio in the Markdown alt text, so
 * `![A cat](cat.png)` was saved as `![1.00](cat.png)` on the first edit.
 * The alt is kept in its own attribute and written back while the image
 * keeps its natural size (an empty alt reads back as that size); a resized
 * image still needs the alt for its ratio.
 */
function keepImageAlt(ctx: Ctx): void {
  ctx.update(imageBlockSchema.key, (factory) => (schemaCtx) => {
    const schema = factory(schemaCtx);
    return {
      ...schema,
      attrs: { ...schema.attrs, alt: { default: '', validate: 'string' } },
      parseMarkdown: {
        match: schema.parseMarkdown.match,
        runner: (state, node, type) => {
          const alt = typeof node.alt === 'string' ? node.alt : '';
          const ratio = Number(alt);
          const isRatio = alt !== '' && Number.isFinite(ratio) && ratio > 0;
          state.addNode(type, {
            src: node.url,
            caption: node.title ?? '',
            ratio: isRatio ? ratio : 1,
            alt: isRatio ? '' : alt,
          });
        },
      },
      toMarkdown: {
        match: schema.toMarkdown.match,
        runner: (state, node) => {
          const { alt, ratio, src, caption } = node.attrs;
          state.openNode('paragraph');
          state.addNode('image', undefined, undefined, {
            title: caption,
            url: src,
            alt: Number(ratio) === 1 ? alt : Number.parseFloat(ratio).toFixed(2),
          });
          state.closeNode();
        },
      },
    };
  });
}

export { imageNullFields, keepImageAlt };
