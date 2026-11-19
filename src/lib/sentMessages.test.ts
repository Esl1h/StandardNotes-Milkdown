import { describe, expect, it, vi } from 'vitest';
import { releaseSavedPayloads } from './sentMessages';

const bigNote = () => ({ items: [{ content: { text: 'x'.repeat(1000) } }] });

describe('releaseSavedPayloads', () => {
  it('drops the note copy of save-items messages but keeps the reply handling', () => {
    const callback = vi.fn();
    const sentMessages = [
      { action: 'save-items', messageId: 'a', data: bigNote(), callback },
      { action: 'stream-context-item', messageId: 'b', data: {}, callback },
    ];

    releaseSavedPayloads({ componentRelay: { sentMessages } });

    expect(sentMessages[0]).toMatchObject({ messageId: 'a', callback, data: {} });
    expect(sentMessages[0].data).toEqual({});
    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[1].data).toEqual({});
  });

  it('is a no-op when the relay is not there (standalone or a changed editor-kit)', () => {
    expect(() => releaseSavedPayloads({})).not.toThrow();
    expect(() => releaseSavedPayloads({ componentRelay: {} })).not.toThrow();
  });
});
