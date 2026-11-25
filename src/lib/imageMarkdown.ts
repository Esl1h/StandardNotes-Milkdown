import { defaultHandlers, type Handle } from 'mdast-util-to-markdown';
import { imageBlockSchema } from '@milkdown/kit/component/image-block';
import { remarkStringifyOptionsCtx } from '@milkdown/kit/core';
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

const BASE64_IMAGE = /^data:image\/[\w.+-]+;base64,[A-Za-z0-9+/]+=*$/;
// Stands in for the data while the image is written; a private use character,
// so no alt or title holds it by chance.
const PLACEHOLDER = 'data:,\uE000';

/**
 * remark checks an image address against every Markdown syntax to escape it:
 * on a note with a few embedded pictures that was most of the time to save it.
 * Base64 never needs an escape, so the data goes in after the image is written.
 */
function imageDataAsIs(image: Handle): Handle {
  const handle: Handle = (node, parent, state, info) => {
    if (!BASE64_IMAGE.test(node.url)) {
      return image(node, parent, state, info);
    }
    const written = image({ ...node, url: PLACEHOLDER }, parent, state, info);
    return written.replace(`](${PLACEHOLDER}`, () => `](${node.url}`);
  };
  // The serializer peeks at the first character of the node that follows.
  return Object.assign(handle, { peek: (image as { peek?: Handle }).peek });
}

function writeImageDataAsIs(ctx: Ctx): void {
  ctx.update(remarkStringifyOptionsCtx, (options) => {
    const handlers = (options.handlers ?? {}) as Record<string, Handle>;
    const image = imageDataAsIs(handlers.image ?? defaultHandlers.image);
    return { ...options, handlers: { ...handlers, image } };
  });
}

export { imageDataAsIs, imageNullFields, keepImageAlt, writeImageDataAsIs };
