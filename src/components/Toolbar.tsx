import React from 'react';
import { useAppStore } from '../store';
import { showOpenDialog, setPreferences as savePreferences, applyPreferences } from '../api';
import './Toolbar.css';

const Toolbar: React.FC = () => {
  const {
    previewVisible,
    setPreviewVisible,
    setPrefsModalOpen,
    editor,
    preferences,
    setPreferences: updatePreferences,
  } = useAppStore();

  const handleTogglePreview = () => {
    setPreviewVisible(!previewVisible);
  };

  const handleOpenPreferences = () => {
    setPrefsModalOpen(true);
  };

  const handleThemeChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newTheme = e.target.value as 'dark' | 'light';
    const newPrefs = { ...preferences, theme: newTheme };
    await savePreferences(newPrefs);
    updatePreferences(newPrefs);
    await applyPreferences();
  };

  const handleExportPDF = async () => {
    if (!editor.compileStatus.pdf_path) {
      alert('No PDF available to export. Please render a document first.');
      return;
    }

    try {
      const savePath = await showOpenDialog(
        [{ name: 'PDF Files', extensions: ['pdf'] }],
        false
      );
      
      if (savePath) {
        // File save dialog will handle the actual saving
        // In a real app, we would copy the PDF to the selected location
      }
    } catch (err) {
      console.error('Failed to export PDF:', err);
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-logo">
        <h1>Tideflow</h1>
      </div>
      
      <div className="toolbar-actions">
        <button 
          onClick={handleTogglePreview}
          className={previewVisible ? 'active' : ''}
          title={previewVisible ? 'Hide Preview' : 'Show Preview'}
        >
          {previewVisible ? '👁️ Hide Preview' : '👁️‍🗨️ Show Preview'}
        </button>
        
        <button 
          onClick={handleExportPDF}
          disabled={!editor.compileStatus.pdf_path}
          title="Export PDF"
        >
          📄 Export PDF
        </button>
        
        <select
          value={preferences.theme}
          onChange={handleThemeChange}
          title="Interface Theme"
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>

        <button onClick={handleOpenPreferences} title="Preferences">
          ⚙️ Preferences
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
