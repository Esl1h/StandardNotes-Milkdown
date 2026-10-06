/**
 * Note content offered by the "Add sample" affordance for an empty note: a
 * tour of what the editor can draw. It is written the way the visual editor
 * writes a note, so the first edit leaves it as it is (roundTrip.test.ts
 * pins that).
 */
const SAMPLE_MARKDOWN_TEXT = `---
title: Milkdown feature tour
tags: [markdown, notes, demo]
---

# Milkdown feature tour

A tour of what the editor can draw, all of it plain Markdown. Select a word to see the **floating toolbar**, press \`/\` on an empty line for the slash menu, and hover a block to drag it.

[TOC]

## Text and links

Plain text with **bold**, *italic*, ***both***, ~~strikethrough~~ and \`inline code\`. A [regular link](https://milkdown.dev), a bare address <https://standardnotes.com>, a [[Wiki link]] kept as typed, and inline math like $E = mc^2$ in the middle of a sentence.

> A blockquote keeps its plain Markdown shape.
> It can run over several lines.

### Headings go down to level six

#### Level four

##### Level five

###### Level six

## Lists

### Bulleted

- Bullet item
- Another item
  - A nested one
  - And one more
- Back at the top level

### Numbered

1. First step
2. Second step
   1. A nested step
3. Third step

### Todo

- [x] Open a note
- [x] Write some Markdown
- [ ] Try the split view
  - [ ] Switch to Source mode

## Callouts

> [!NOTE]
> Useful information that users should know, even when skimming.

> [!TIP]
> Helpful advice for doing things better or more easily.

> [!IMPORTANT]
> Key information users need to know to achieve their goal.

> [!WARNING]
> Urgent information that needs immediate attention to avoid problems.

> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.

## Tables

| Feature        | Where it lives | Available |
| :------------- | :------------: | --------: |
| Visual editing |    The note    |       Yes |
| Split mode     |    Icon bar    |       Yes |
| Source mode    |    Icon bar    |       Yes |

## Code

\`\`\`ts
interface Note {
  title: string;
  text: string;
}

const answer: number = 42;
\`\`\`

\`\`\`python
def greet(name: str) -> str:
    return f"Hello, {name}!"
\`\`\`

\`\`\`bash
npm ci && npm run build
\`\`\`

## Math

Inline formulas use single dollars, such as $a^2 + b^2 = c^2$. Blocks use double dollars:

$$
\\int_{0}^{\\infty} e^{-x^{2}} \\, dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Diagrams

\`\`\`mermaid
graph LR
  Idea --> Draft --> Review --> Done
\`\`\`

\`\`\`mermaid
sequenceDiagram
  participant You
  participant Editor
  You->>Editor: type Markdown
  Editor-->>You: rendered note
\`\`\`

## Images

![A small drawing embedded in the note](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0ODAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgNDgwIDE1MCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjNjM2NmYxIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZWM0ODk5Ii8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjQ4MCIgaGVpZ2h0PSIxNTAiIHJ4PSIxNCIgZmlsbD0idXJsKCNnKSIvPjxjaXJjbGUgY3g9IjY0IiBjeT0iNzUiIHI9IjMwIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii44NSIvPjxyZWN0IHg9IjExNiIgeT0iNTIiIHdpZHRoPSIyNTAiIGhlaWdodD0iMTQiIHJ4PSI3IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii45Ii8+PHJlY3QgeD0iMTE2IiB5PSI4MCIgd2lkdGg9IjE4MCIgaGVpZ2h0PSIxMiIgcng9IjYiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjYiLz48dGV4dCB4PSI0MDAiIHk9Ijg2IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNiIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TUQ8L3RleHQ+PC9zdmc+)

## Horizontal rule

Above the rule.

***

Below the rule.

## Kept as written

Footnotes[^1] and inline HTML such as <kbd>Ctrl</kbd> + <kbd>F</kbd> are left exactly as typed.

[^1]: A footnote definition.
`;

export { SAMPLE_MARKDOWN_TEXT };
