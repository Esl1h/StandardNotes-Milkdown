import { afterEach, expect, it, vi } from 'vitest';
import { downloadFile } from './download';

afterEach(() => {
  vi.restoreAllMocks();
});

it('saves the text as a file with the given name and type', async () => {
  const blobs: Blob[] = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return 'blob:file';
  });
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  downloadFile('<p>hi</p>', 'note.html', 'text/html');

  // The anchor the click was made on.
  const link = click.mock.contexts[0] as HTMLAnchorElement;
  expect(link.download).toBe('note.html');
  expect(link.href).toBe('blob:file');
  expect(blobs[0].type).toBe('text/html');
  expect(await blobs[0].text()).toBe('<p>hi</p>');
  expect(document.querySelector('a[download]')).toBeNull();
  await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:file'));
});
