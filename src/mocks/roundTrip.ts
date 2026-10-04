import { createCrepe } from '../lib/crepe';

/** Opens `markdown` in the real Crepe (no mock) and serializes it back. */
async function roundTrip(markdown: string): Promise<string> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const crepe = await createCrepe(root, markdown, false);
  await crepe.create();
  try {
    return crepe.getMarkdown();
  } finally {
    await crepe.destroy();
    root.remove();
  }
}

export { roundTrip };
