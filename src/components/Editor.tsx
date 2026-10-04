import React from 'react';
import EditorKit from '@standardnotes/editor-kit';
import { type EditorKitDelegate } from '@standardnotes/editor-kit';
import { SAMPLE_MARKDOWN_TEXT } from '../lib/sampleMarkdown';
import './Editor.css';
import MilkdownEditor from './MilkdownEditor';
import ErrorBoundary from './ErrorBoundary';
import { setPreferenceStore } from '../lib/layout';
import { markdownPreview } from '../lib/preview';

/** How long to wait for Standard Notes to stream the note before saying so */
const NOTE_WAIT_MS = 5000;

interface EditorInterface {
  rawText: string;
  /** Bumped on every note switch; resets the editors' undo history */
  historyEpoch: number;
  /** True once Standard Notes has streamed the note in */
  noteReceived: boolean;
  /** True when no note arrived within NOTE_WAIT_MS */
  waitTimedOut: boolean;
}

export default class Editor extends React.Component<Record<string, never>, EditorInterface> {
  // Only these entry points are used; tests stub this field.
  editorKit: Pick<
    EditorKit,
    'onEditorValueChanged' | 'getComponentDataValueForKey' | 'setComponentDataValueForKey'
  >;

  constructor(props: Record<string, never>) {
    super(props);
    this.configureEditorKit();
    // Nothing is rendered until setEditorRawText delivers the note: an
    // editable placeholder would swallow typing that EditorKit drops.
    this.state = {
      rawText: '',
      historyEpoch: 0,
      noteReceived: false,
      waitTimedOut: false,
    };
  }

  waitTimer?: ReturnType<typeof setTimeout>;

  componentDidMount() {
    this.waitTimer = setTimeout(() => this.setState({ waitTimedOut: true }), NOTE_WAIT_MS);
  }

  componentWillUnmount() {
    clearTimeout(this.waitTimer);
  }

  configureEditorKit = () => {
    const delegate: EditorKitDelegate = {
      setEditorRawText: (text: string) => {
        this.setState({ rawText: text, noteReceived: true });
      },
      // EditorKit calls this after setEditorRawText when the note changed.
      clearUndoHistory: () => {
        this.setState(({ historyEpoch }) => ({ historyEpoch: historyEpoch + 1 }));
      },
      handleRequestForContentHeight: () => undefined,
      generateCustomPreview: (text: string) => ({ plain: markdownPreview(text) }),
    };

    this.editorKit = new EditorKit(delegate, {
      mode: 'plaintext',
      coallesedSaving: true,
      coallesedSavingDelay: 350,
    });
    // Layout preferences live in the component data, which the app keeps
    // on the component item; localStorage alone is lost in sandboxed or
    // per-session iframe origins.
    setPreferenceStore({
      get: (key) => this.editorKit.getComponentDataValueForKey(key),
      set: (key, value) => this.editorKit.setComponentDataValueForKey(key, value),
    });
  };

  handleTextChange = (rawText: string) => {
    this.setState({ rawText });
    this.saveNote(rawText);
  };

  saveNote = (text: string) => {
    /** This will work in an SN context, but breaks the standalone editor,
     * so we need to catch the error
     */
    try {
      this.editorKit.onEditorValueChanged(text);
    } catch (error) {
      console.log('Error saving note:', error);
    }
  };

  handleInsertSample = () => {
    this.handleTextChange(SAMPLE_MARKDOWN_TEXT);
  };

  render() {
    if (!this.state.noteReceived) {
      return (
        <div className="note-status" role="status">
          {this.state.waitTimedOut
            ? 'The note was not received from Standard Notes. Close and reopen it, or restart the app.'
            : 'Waiting for the note...'}
        </div>
      );
    }
    return (
      <ErrorBoundary
        rawText={this.state.rawText}
        onRawTextChange={this.saveNote}
        resetKey={this.state.historyEpoch}
      >
        <MilkdownEditor
          rawText={this.state.rawText}
          historyEpoch={this.state.historyEpoch}
          onTextChange={this.handleTextChange}
          onInsertSample={this.handleInsertSample}
        />
      </ErrorBoundary>
    );
  }
}
