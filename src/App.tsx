import { useEffect, useState } from 'react';
import { 
  Panel, 
  PanelGroup, 
  PanelResizeHandle 
} from 'react-resizable-panels';
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from './store';
import { getPreferences, listenForFileChanges } from './api';
import './App.css';

// Import components
import TabBar from './components/TabBar';
import Editor from './components/Editor';
import PDFPreview from './components/PDFPreview';
import Toolbar from './components/Toolbar';
import PrefsModal from './components/PrefsModal';
import StatusBar from './components/StatusBar';

function App() {
  const [loading, setLoading] = useState(true);
  const {
    setPreferences,
    previewVisible,
    prefsModalOpen,
    editor,
    setCurrentFile,
    setContent,
    addOpenFile,
    preferences
  } = useAppStore();

  // Initialize app
  useEffect(() => {
    const init = async () => {
      try {
        // Load preferences
        const prefs = await getPreferences();
        setPreferences(prefs);
        
        // Initialize with default content if no file is open
        if (!editor.currentFile) {
          setCurrentFile('sample.md');
          addOpenFile('sample.md');
          setContent(`# Welcome to MarkdownToPDF

This is a sample document to get you started.

## Features

- **Real-time PDF rendering**: Changes automatically render to PDF
- **Markdown support**: Full CommonMark and extended syntax
- **Image support**: Drag & drop or paste images
- **Tables**: Easy table creation and editing

## Getting Started

1. Start typing in this editor
2. Watch the PDF preview update automatically
3. Use the toolbar buttons for common elements
4. Save your work with Ctrl+S

## Math Support

You can include mathematical expressions:

Inline math: $E = mc^2$

Block math:
$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

## Code Blocks

\`\`\`python
def hello_world():
    print("Hello, World!")
\`\`\`

Happy writing!
`);
        }
        
        // Setup file change listener
        await listenForFileChanges((filePath) => {
          if (filePath === editor.currentFile) {
            // Notify about file change if it's the current file
            // Could trigger reload or render here
          }
        });

        // Setup compile event listeners
        const unlistenCompiled = await listen<string>("compiled", () => {
          // The PDFPreview component will pick this up via the store's compileStatus
        });

        const unlistenCompileError = await listen<string>("compile-error", () => {
          // The PDFPreview component will show the error
        });

        // Cleanup listeners on component unmount
        return () => {
          unlistenCompiled();
          unlistenCompileError();
        };
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setLoading(false);
      }
    };
    
    init();
  }, [editor.currentFile, setPreferences, setCurrentFile, setContent, addOpenFile]);

  useEffect(() => {
    document.body.classList.toggle('light', preferences.theme === 'light');
  }, [preferences.theme]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      <Toolbar />
      <TabBar />
      
      <div className="main-content">
        <PanelGroup direction="horizontal" style={{ height: '100%', overflow: 'hidden' }}>
          {/* Editor Panel */}
          <Panel 
            defaultSize={previewVisible ? 50 : 100} 
            minSize={25}
            maxSize={previewVisible ? 75 : 100}
            style={{ overflow: 'hidden', minWidth: 0 }}
          >
            <Editor />
          </Panel>
          
          {previewVisible && (
            <>
              <PanelResizeHandle className="resize-handle" />
              
              {/* PDF Preview Panel */}
              <Panel 
                defaultSize={50} 
                minSize={25}
                maxSize={75}
                style={{ overflow: 'hidden', minWidth: 0 }}
              >
                <PDFPreview />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
      
      <StatusBar />
      
      {prefsModalOpen && <PrefsModal />}
    </div>
  );
}

export default App;
