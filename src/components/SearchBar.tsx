import React, { useEffect, useReducer, useRef, useState } from 'react';
import { TextSelection } from '@milkdown/kit/prose/state';
import { type EditorView } from '@milkdown/kit/prose/view';
import {
  SearchQuery,
  findNext,
  findPrev,
  getMatchHighlights,
  replaceAll,
  replaceNext,
  setSearchState,
} from 'prosemirror-search';

interface SearchBarProps {
  view: EditorView;
  onClose: () => void;
}

/** "2/7": the match under the selection out of all matches. */
function matchCount(view: EditorView): string {
  const matches = getMatchHighlights(view.state).find();
  if (matches.length === 0) {
    return 'No results';
  }
  const { from, to } = view.state.selection;
  const current = matches.findIndex((match) => match.from === from && match.to === to);
  return `${current + 1}/${matches.length}`;
}

/** Find and replace for the visual editor, driving prosemirror-search. */
function SearchBar({ view, onClose }: SearchBarProps) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  // The count reads the view state, which changes outside React.
  const [, refresh] = useReducer((tick: number) => tick + 1, 0);
  const findRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    findRef.current?.focus();
  }, []);

  const run = (command: typeof findNext) => {
    command(view.state, view.dispatch);
    refresh();
  };

  const setQuery = (nextFind: string, nextReplace: string) => {
    view.dispatch(
      setSearchState(view.state.tr, new SearchQuery({ search: nextFind, replace: nextReplace }))
    );
  };

  const changeFind = (value: string) => {
    setFind(value);
    setQuery(value, replace);
    if (value) {
      // Search from the start of the current match, so typing one more
      // character keeps the match under the cursor instead of skipping it.
      const { from } = view.state.selection;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from)));
      findNext(view.state, view.dispatch);
    }
    refresh();
  };

  const changeReplace = (value: string) => {
    setReplace(value);
    setQuery(find, value);
  };

  const close = () => {
    setQuery('', '');
    onClose();
    view.focus();
  };

  return (
    <div className="search-bar" role="search">
      <input
        ref={findRef}
        placeholder="Find"
        value={find}
        onChange={(event) => changeFind(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            run(event.shiftKey ? findPrev : findNext);
          } else if (event.key === 'Escape') {
            close();
          }
        }}
      />
      <span className="search-count">{find ? matchCount(view) : ''}</span>
      <button title="Previous match" aria-label="Previous match" onClick={() => run(findPrev)}>
        ↑
      </button>
      <button title="Next match" aria-label="Next match" onClick={() => run(findNext)}>
        ↓
      </button>
      <input
        placeholder="Replace"
        value={replace}
        onChange={(event) => changeReplace(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            run(replaceNext);
          } else if (event.key === 'Escape') {
            close();
          }
        }}
      />
      <button title="Replace" aria-label="Replace" onClick={() => run(replaceNext)}>
        Replace
      </button>
      <button title="Replace all" aria-label="Replace all" onClick={() => run(replaceAll)}>
        All
      </button>
      <button title="Close the search" aria-label="Close the search" onClick={close}>
        ✕
      </button>
    </div>
  );
}

export default SearchBar;
