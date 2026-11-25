import { prosePluginsCtx } from '@milkdown/kit/core';
import { type MilkdownPlugin } from '@milkdown/kit/ctx';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import {
  MAX_DATA_URI_LENGTH,
  MAX_NOTE_IMAGE_LENGTH,
  embedImage,
  embeddedLength,
  getNoteText,
} from './image';

/** An embedded image of pasted HTML: heavier than the per image limit, or a
 * document (SVG) that must not be stored. */
const DATA_IMAGE = /data:image\/([\w.+-]+);base64,([A-Za-z0-9+/=]+)/g;
const ONE_DATA_IMAGE = new RegExp(DATA_IMAGE.source);

/**
 * Recompresses or drops the embedded images of pasted HTML: a data URI in a
 * clipboard never went through the limits of an upload, so one paste could
 * carry a picture of any size, or an SVG document, into the note. Images
 * within the limits are left as they are; one that cannot fit is dropped,
 * with the reason the upload path would give.
 */
export async function cleanPastedHtml(html: string): Promise<string> {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const dataImages = [...document.images]
    .map((image) => ({ image, uri: image.getAttribute('src') ?? '' }))
    .filter(({ uri }) => ONE_DATA_IMAGE.test(uri));
  if (dataImages.length === 0) {
    return html;
  }
  let keptLength = 0;
  for (const { image, uri } of dataImages) {
    const [, type] = ONE_DATA_IMAGE.exec(uri) ?? [];
    if (type.toLowerCase() !== 'svg+xml' && uri.length <= MAX_DATA_URI_LENGTH) {
      keptLength += uri.length;
      continue;
    }
    try {
      // Decoded by hand: fetching a data URI would run into the CSP of the
      // page, which allows connections to the plugin's origin only.
      const [, type, base64] = ONE_DATA_IMAGE.exec(uri) ?? [];
      const bytes = Uint8Array.from(atob(base64 ?? ''), (char) => char.charCodeAt(0));
      const embedded = await embedImage(
        new File([bytes], 'image', { type: `image/${type.toLowerCase()}` })
      );
      image.setAttribute('src', embedded);
      keptLength += embedded.length;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
      image.remove();
    }
  }
  // The per image limits keep most pastes in place; the note budget counts
  // every embedded image of the paste together with the ones the note holds.
  if (keptLength > MAX_NOTE_IMAGE_LENGTH - embeddedLength(getNoteText() ?? '')) {
    window.alert(
      `The note already holds about ${Math.round(
        MAX_NOTE_IMAGE_LENGTH / 1024 / 1024
      )} MB of images, the limit for one note. The pasted image was not added; remove an image first.`
    );
    document.querySelectorAll('img[src^="data:image/"]').forEach((image) => image.remove());
  }
  return document.body.innerHTML;
}

/**
 * A clipboard transfer. jsdom has no DataTransfer constructor, and only the
 * two text types are needed: the clipboard plugin reads them by name.
 */
function makeTransfer(): DataTransfer {
  const map = new Map<string, string>();
  if (typeof DataTransfer !== 'function') {
    return {
      get types() {
        return [...map.keys()];
      },
      setData: (type: string, value: string) => void map.set(type, value),
      getData: (type: string) => map.get(type) ?? '',
    } as unknown as DataTransfer;
  }
  return new DataTransfer();
}

/**
 * Sends pasted HTML with embedded images through `cleanPastedHtml` before the
 * clipboard plugin parses it: the image is re-embedded under the same limits
 * as an upload, or dropped. Everything else reaches the parser unchanged.
 */
const pasteImageLimits: MilkdownPlugin = (ctx) => async () => {
  let reentry = false;
  const plugin = new Plugin({
    key: new PluginKey('pasteImageLimits'),
    props: {
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData;
        if (reentry || !clipboard || view.state.selection.$from.parent.type.spec.code) {
          return false;
        }
        const html = clipboard.getData('text/html');
        if (!/data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]{600,}|data:image\/svg\+xml/i.test(html)) {
          return false;
        }
        const transfer = makeTransfer();
        for (const type of clipboard.types) {
          if (type !== 'text/html') {
            transfer.setData(type, clipboard.getData(type));
          }
        }
        void cleanPastedHtml(html).then((cleaned) => {
          transfer.setData('text/html', cleaned);
          // The selection survives the async work while nothing else edits the
          // document; the redispatched event is handled by the clipboard
          // plugin, with this plugin stepping aside.
          reentry = true;
          try {
            // A plain Event with clipboardData on it: jsdom has no
            // ClipboardEvent constructor.
            const redispatched = new Event('paste', { bubbles: true, cancelable: true });
            Object.defineProperty(redispatched, 'clipboardData', { value: transfer });
            view.dom.dispatchEvent(redispatched);
          } finally {
            reentry = false;
          }
        });
        return true;
      },
    },
  });
  ctx.update(prosePluginsCtx, (plugins) => [plugin, ...plugins]);
};

export { pasteImageLimits };
