import React from 'react';
import { type Heading } from './CrepeView';

interface OutlineProps {
  headings: Heading[];
  onSelect: (heading: Heading) => void;
}

/** The note's headings, indented by level; a click jumps to the heading. */
function Outline({ headings, onSelect }: OutlineProps) {
  return (
    <nav className="outline" aria-label="Outline">
      {headings.length === 0 ? (
        <p className="outline-empty">Headings show up here.</p>
      ) : (
        <ul>
          {headings.map((heading) => (
            <li key={heading.pos} className={`outline-level-${heading.level}`}>
              <button onClick={() => onSelect(heading)}>{heading.text || 'Untitled'}</button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

export default Outline;
