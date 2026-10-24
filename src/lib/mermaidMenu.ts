import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import {
  clearTextInCurrentBlockCommand,
  codeBlockSchema,
  setBlockTypeCommand,
} from '@milkdown/kit/preset/commonmark';
import { type BlockEditFeatureConfig } from '@milkdown/crepe/feature/block-edit';

/** Slash menu entries that start a Mermaid diagram from a small template. */

const DIAGRAM_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
    <path fill="currentColor" d="M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3z" />
  </svg>
`;

const TEMPLATES: Array<{ key: string; label: string; code: string }> = [
  {
    key: 'flowchart',
    label: 'Flowchart',
    code: 'flowchart TD\n  A[Start] --> B{Choice}\n  B -->|Yes| C[Do it]\n  B -->|No| D[Skip]',
  },
  {
    key: 'sequence',
    label: 'Sequence diagram',
    code: 'sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi',
  },
  {
    key: 'class',
    label: 'Class diagram',
    code: 'classDiagram\n  Animal <|-- Dog\n  Animal : +name\n  Dog : +bark()',
  },
  {
    key: 'state',
    label: 'State diagram',
    code: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy\n  Busy --> [*]',
  },
  {
    key: 'er',
    label: 'Entity relationship',
    code: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  ORDER ||--|{ ITEM : contains',
  },
  {
    key: 'gantt',
    label: 'Gantt chart',
    code: 'gantt\n  dateFormat YYYY-MM-DD\n  section Plan\n  Draft :a1, 2026-01-01, 7d\n  Review :after a1, 3d',
  },
  {
    key: 'pie',
    label: 'Pie chart',
    code: 'pie\n  "A" : 60\n  "B" : 40',
  },
  {
    key: 'mindmap',
    label: 'Mind map',
    code: 'mindmap\n  root((Idea))\n    One\n    Two',
  },
];

const addMermaidMenuItems: NonNullable<BlockEditFeatureConfig['buildMenu']> = (builder) => {
  const group = builder.getGroup('advanced');
  for (const template of TEMPLATES) {
    group.addItem(`mermaid-${template.key}`, {
      label: `Mermaid ${template.label.toLowerCase()}`,
      icon: DIAGRAM_ICON,
      onRun: (ctx) => {
        const commands = ctx.get(commandsCtx);
        commands.call(clearTextInCurrentBlockCommand.key);
        commands.call(setBlockTypeCommand.key, {
          nodeType: codeBlockSchema.type(ctx),
          attrs: { language: 'mermaid' },
        });
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.insertText(template.code));
      },
    });
  }
};

export { addMermaidMenuItems };
