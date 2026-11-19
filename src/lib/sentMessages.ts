interface SentMessage {
  action: string;
  data?: unknown;
}

/**
 * The editor-kit's component relay keeps every message it ever posted in
 * `sentMessages` until deinit, to route the host's replies by messageId. A
 * save-items message holds a deep copy of the whole note (images included),
 * so a long session leaks one copy per save. Replies only need the messageId
 * and the callback, so the payload is dropped. Call it before a new save:
 * everything sent earlier no longer needs its data. The field is private in
 * the editor-kit types, hence the loose shape; a missing field is ignored.
 */
function releaseSavedPayloads(editorKit: object): void {
  const sent = (editorKit as { componentRelay?: { sentMessages?: SentMessage[] } }).componentRelay
    ?.sentMessages;
  for (const message of sent ?? []) {
    if (message.action === 'save-items') {
      message.data = {};
    }
  }
}

export { releaseSavedPayloads };
