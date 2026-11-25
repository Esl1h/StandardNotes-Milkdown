import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { defaultHandlers, toMarkdown, type Handle } from 'mdast-util-to-markdown';
import { imageDataAsIs } from './imageMarkdown';
import { roundTrip } from '../mocks/roundTrip';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const dataUrl = fc
  .record({
    type: fc.constantFrom('png', 'jpeg', 'webp', 'svg+xml', 'vnd.x-icon'),
    data: fc.string({ unit: fc.constantFrom(...BASE64), minLength: 1, maxLength: 60 }),
    padding: fc.constantFrom('', '=', '=='),
  })
  .map(({ type, data, padding }) => `data:image/${type};base64,${data}${padding}`);
const label = fc.string({
  unit: fc.constantFrom(...'ab ()[]!<>"\'*_`\\&#+-=.:,\n'),
  maxLength: 12,
});

describe('imageDataAsIs', () => {
  it('writes embedded images as remark does', () => {
    const image = fc.record({
      type: fc.constant('image' as const),
      url: dataUrl,
      alt: label,
      title: label,
    });
    const text = label.map((value) => ({ type: 'text' as const, value }));

    fc.assert(
      fc.property(fc.array(fc.oneof(image, text), { minLength: 1, maxLength: 4 }), (children) => {
        const tree = { type: 'paragraph' as const, children };
        const handlers = { image: imageDataAsIs(defaultHandlers.image) };
        expect(toMarkdown(tree, { handlers })).toBe(toMarkdown(tree));
      }),
      { numRuns: 1000 }
    );
  });

  it('keeps the data away from the escaping', () => {
    const addresses: string[] = [];
    const spy: Handle = (node, parent, state, info) => {
      addresses.push(node.url);
      return defaultHandlers.image(node, parent, state, info);
    };
    const url = `data:image/png;base64,${'A+/'.repeat(1000)}=`;
    const tree = { type: 'paragraph' as const, children: [{ type: 'image' as const, url }] };

    expect(toMarkdown(tree, { handlers: { image: imageDataAsIs(spy) } })).toBe(`![](${url})\n`);
    expect(addresses.every((address) => address.length < 20)).toBe(true);
  });

  it.each([
    ['a linked image', 'https://e.com/c.png'],
    ['data that is not base64', 'data:image/svg+xml,<svg></svg>'],
    ['base64 data that needs an escape', 'data:image/png;base64,AA A)'],
  ])('leaves %s to remark', (_name, url) => {
    const tree = { type: 'paragraph' as const, children: [{ type: 'image' as const, url }] };
    const handlers = { image: imageDataAsIs(defaultHandlers.image) };

    expect(toMarkdown(tree, { handlers })).toBe(toMarkdown(tree));
  });
});

describe('image round trip', () => {
  it.each([
    ['an image without a title', '![A cat](https://e.com/c.png)\n'],
    ['an image with a title', '![A cat](https://e.com/c.png "t")\n'],
    ['an image without alt text', '![](https://e.com/c.png)\n'],
    ['an image block with a resize ratio', '![0.50](https://e.com/c.png)\n'],
    ['an inline image', 'text ![alt](https://e.com/i.png) more\n'],
    ['an inline image without alt text', 'a ![](https://e.com/i.png) b\n'],
    ['an embedded image', '![dot](data:image/png;base64,iVBORw0KGgo+AAAA/w==)\n'],
    ['an embedded image in a sentence', 'a ![](data:image/jpeg;base64,/9j/4AAQ+==) b\n'],
  ])(
    'keeps %s',
    async (_name, markdown) => {
      expect(await roundTrip(markdown)).toBe(markdown);
    },
    20000
  );
});
