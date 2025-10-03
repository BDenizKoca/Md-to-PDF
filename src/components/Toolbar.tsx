import React, { useRef, useState } from 'react';
import { useAppStore } from '../store';
import type { Preferences } from '../types';
import DesignModal from './DesignModal';
import PrefsModal from './PrefsModal';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { handleError, showSuccess } from '../utils/errorHandler';
import { themePresets } from '../themes';
import { setPreferences as persistPreferences, renderMarkdown, renderTypst, readMarkdownFile, createFile, writeMarkdownFile } from '../api';
import { scrubRawTypstAnchors } from '../utils/scrubAnchors';
import './Toolbar.css';

const Toolbar: React.FC = () => {
  const { 
    previewVisible, 
    setPreviewVisible,
    editor,
    designModalOpen, setDesignModalOpen,
    setPreferences,
    addToast,
    setCompileStatus,
    setCurrentFile,
    setContent,
    setModified,
    addOpenFile,
    closeAllFiles,
    recentFiles,
    addRecentFile,
    clearRecentFiles,
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const [recentDropdownOpen, setRecentDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (recentDropdownOpen && !target.closest('.dropdown')) {
        setRecentDropdownOpen(false);
      }
    };
    
    if (recentDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [recentDropdownOpen]);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // File operations
  const handleNewFile = async () => {
    try {
      const name = prompt('Enter file name (with .md extension):');
      if (!name) return;
      
      const fileName = name.includes('.') ? name : `${name}.md`;
      const newContent = `# ${name.replace('.md', '')}\n\nStart writing your document.`;
      const filePath = await createFile(fileName);
      await writeMarkdownFile(filePath, newContent);
      
      addOpenFile(filePath);
      setCurrentFile(filePath);
      setContent(newContent);
      addRecentFile(filePath);
      addToast({ type: 'success', message: 'File created successfully' });
    } catch (err) {
      addToast({ type: 'error', message: 'Failed to create file' });
      handleError(err, { operation: 'create file', component: 'Toolbar' });
    }
  };

  const handleOpenFile = async () => {
    try {
      const result = await open({ multiple: false, filters: [{ name: 'Markdown Files', extensions: ['md'] }] });
      const filePath = Array.isArray(result) ? result?.[0] : result;
      
      if (filePath) {
        try {
          const content = await readMarkdownFile(filePath);
          addOpenFile(filePath);
          setCurrentFile(filePath);
          setContent(content);
          addRecentFile(filePath);
          addToast({ type: 'success', message: 'File opened successfully' });
          return;
        } catch (readError) {
          addToast({ type: 'error', message: 'Failed to read file' });
          handleError(readError, { operation: 'read file', component: 'Toolbar' });
        }
      }
    } catch {
      fileInputRef.current?.click();
    }
  };

  const handleSaveFile = async () => {
    const { currentFile, content, modified } = editor;
    if (!currentFile || !modified) return;
    
    try {
      const cleaned = scrubRawTypstAnchors(content);
      await writeMarkdownFile(currentFile, cleaned);
      setModified(false);
      addToast({ type: 'success', message: 'File saved successfully' });
    } catch (err) {
      addToast({ type: 'error', message: 'Failed to save file' });
      handleError(err, { operation: 'save file', component: 'Toolbar' });
    }
  };

  const handleFallbackChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const safeName = file.name.endsWith('.md') ? file.name : file.name + '.md';
      const newPath = await createFile(safeName);
      const cleaned = scrubRawTypstAnchors(text);
      await writeMarkdownFile(newPath, cleaned);
      
      addOpenFile(newPath);
      setCurrentFile(newPath);
      setContent(cleaned);
      addToast({ type: 'success', message: 'File imported successfully' });
    } catch (e2) {
      addToast({ type: 'error', message: 'Failed to import file' });
      handleError(e2, { operation: 'open file', component: 'Toolbar' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTogglePreview = () => {
    setPreviewVisible(!previewVisible);
  };

  // Unified re-render that supports the in-memory sample document (which has no on-disk path)
  const rerenderCurrent = async () => {
    const { editor: { currentFile, content } } = useAppStore.getState();
    if (!currentFile) return;
    // Detect virtual sample file (no path separators) or explicit 'sample.md'
    const isVirtual = currentFile === 'sample.md' || (!currentFile.includes('/') && !currentFile.includes('\\'));
    if (isVirtual) {
      await renderTypst(content, 'pdf');
    } else {
      await renderMarkdown(currentFile);
    }
  };

  const handleExportPDF = async () => {
    try {
      const pdfSource = editor.compileStatus.pdf_path;
      if (!pdfSource) {
        handleError(new Error('No PDF available to export'), 
          { operation: 'export PDF', component: 'Toolbar' }, 'warning');
        return;
      }

      // Use save dialog (if available via plugin)
      let dest = await save({
        title: 'Save PDF As',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
        defaultPath: 'document.pdf'
      }).catch(() => null);

      if (!dest) {
        // Fallback: open dialog hack (user selects folder and we append name) - skipped for now
        return;
      }
      if (!dest.toLowerCase().endsWith('.pdf')) dest = dest + '.pdf';

      // If source is a temp PDF from in-memory render, we can copy directly.
      // Call backend command save_pdf_as which handles md->pdf export if needed.
      await invoke('save_pdf_as', { filePath: pdfSource, destination: dest });
      showSuccess(`Exported PDF to: ${dest}`);
      addToast({ type: 'success', message: 'PDF exported successfully!' });
    } catch (err) {
      addToast({ type: 'error', message: 'Failed to export PDF' });
      handleError(err, { operation: 'export PDF', component: 'Toolbar' });
    }
  };

  return (
    <div className="toolbar">
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt,.markdown"
        onChange={handleFallbackChange}
        className="hidden-file-input"
        aria-hidden="true"
      />
      
      <div className="toolbar-logo">
        <h1>Tideflow</h1>
      </div>
      
      <div className="toolbar-actions">
        {/* File Operations */}
        <div className="toolbar-section">
          <button onClick={handleNewFile} title="New File (Ctrl+N)">
            📄 New
          </button>
          <div className="toolbar-button-group">
            <button onClick={handleOpenFile} title="Open File (Ctrl+O)">
              📂 Open
            </button>
            {recentFiles.length > 0 && (
              <div className="dropdown">
                <button 
                  className="dropdown-toggle" 
                  title="Recent Files"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRecentDropdownOpen(!recentDropdownOpen);
                  }}
                >
                  ▼
                </button>
                {recentDropdownOpen && (
                  <div className="dropdown-menu">
                    <div className="dropdown-header">Recent Files</div>
                    {recentFiles.map((file) => (
                      <button
                        key={file}
                        className="dropdown-item"
                        onClick={async () => {
                          try {
                            const content = await readMarkdownFile(file);
                            addOpenFile(file);
                            setCurrentFile(file);
                            setContent(content);
                            addRecentFile(file);
                            setRecentDropdownOpen(false);
                            addToast({ type: 'success', message: 'File opened successfully' });
                          } catch (err) {
                            addToast({ type: 'error', message: 'Failed to open file' });
                            handleError(err, { operation: 'open recent file', component: 'Toolbar' });
                          }
                        }}
                        title={file}
                      >
                        {file.split(/[\\/]/).pop() || file}
                      </button>
                    ))}
                    <div className="dropdown-divider"></div>
                    <button
                      className="dropdown-item dropdown-clear"
                      onClick={() => {
                        clearRecentFiles();
                        setRecentDropdownOpen(false);
                        addToast({ type: 'success', message: 'Recent files cleared' });
                      }}
                    >
                      ✖ Clear Recent
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={closeAllFiles}
            title="Close all tabs and return to sample document"
          >
            ✖ Close All
          </button>
        </div>

        <div className="toolbar-separator"></div>

        {/* View Controls */}
        <div className="toolbar-section">
          <button
            onClick={handleTogglePreview}
            className={previewVisible ? 'active' : ''}
            title={previewVisible ? 'Hide Preview (Ctrl+\\)' : 'Show Preview (Ctrl+\\'}
          >
            {previewVisible ? '👁️ Preview' : '👁️‍🗨️ Preview'}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="fullscreen-btn"
          >
            {isFullscreen ? '⊡ Exit' : '⛶ Fullscreen'}
          </button>
        </div>

        <div className="toolbar-separator"></div>

        {/* Document Settings */}
        <div className="toolbar-section">
          <button
            onClick={() => setPrefsModalOpen(true)}
            title="Settings (Performance, Session)"
            className="btn-secondary"
          >
            ⚙️ Settings
          </button>
          <button 
            onClick={handleSaveFile} 
            disabled={!editor.modified}
            title="Save File (Ctrl+S)"
          >
            💾 Save
          </button>
          <button 
            onClick={handleExportPDF}
            disabled={!editor.compileStatus.pdf_path}
            title="Export PDF (Ctrl+E)"
            className="btn-primary"
          >
            📄 Export
          </button>
        </div>
      </div>
      {designModalOpen && <DesignModal />}
      {prefsModalOpen && <PrefsModal onClose={() => setPrefsModalOpen(false)} />}
    </div>
  );
};

export default Toolbar;
