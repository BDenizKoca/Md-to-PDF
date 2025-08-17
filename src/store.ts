import { create } from 'zustand';
import type { CompileStatus, EditorState, Preferences } from './types';

// Initial preferences
const defaultPreferences: Preferences = {
  papersize: 'a4',  // Changed from paper_size to papersize
  margin: {         // Changed from margins to margin
    x: '2cm',
    y: '2.5cm',
  },
  toc: true,
  number_sections: true,
  default_image_width: '60%',
  default_image_alignment: 'center',
  fonts: {
    main: 'New Computer Modern',
    mono: 'Liberation Mono',
  },
  theme: 'dark',
  // Preview optimization settings
  render_debounce_ms: 400,
  focused_preview_enabled: true,
  preserve_scroll_position: true,
};

// Initial editor state
const initialEditorState: EditorState = {
  currentFile: null,
  openFiles: [],
  content: '',
  modified: false,
  compileStatus: {
    status: 'idle',
  },
};

// Define store types
interface AppState {
  // Editor state
  editor: EditorState;
  setCurrentFile: (path: string | null) => void;
  setContent: (content: string) => void;
  setModified: (modified: boolean) => void;
  setCompileStatus: (status: CompileStatus) => void;
  
  // Tab management
  addOpenFile: (path: string) => void;
  removeOpenFile: (path: string) => void;
  closeAllFiles: () => void;
  
  // Preferences state
  preferences: Preferences;
  setPreferences: (preferences: Preferences) => void;
  
  // UI state
  prefsModalOpen: boolean;
  setPrefsModalOpen: (open: boolean) => void;
  
  previewVisible: boolean;
  setPreviewVisible: (visible: boolean) => void;
  
  // Reset state
  resetState: () => void;
}

// Create store
export const useAppStore = create<AppState>((set) => ({
  // Editor state
  editor: initialEditorState,
  setCurrentFile: (path: string | null) => set((state: AppState) => {
    return {
      editor: {
        ...state.editor,
        currentFile: path,
        // Don't reset content here - it should be set separately with setContent
        modified: false,
      }
    };
  }),
  setContent: (content: string) => set((state: AppState) => {
    return {
      editor: {
        ...state.editor,
        content,
      }
    };
  }),
  setModified: (modified: boolean) => set((state: AppState) => ({
    editor: {
      ...state.editor,
      modified,
    }
  })),
  setCompileStatus: (compileStatus: CompileStatus) => set((state: AppState) => ({
    editor: {
      ...state.editor,
      compileStatus,
    }
  })),
  
  // Tab management
  addOpenFile: (path: string) => set((state: AppState) => {
    // If file is already open, don't add it again
    if (state.editor.openFiles.includes(path)) {
      return { editor: state.editor };
    }
    
    // Add file to open files list
    const newState = {
      editor: {
        ...state.editor,
        openFiles: [...state.editor.openFiles, path]
      }
    };
    return newState;
  }),
  
  removeOpenFile: (path: string) => set((state: AppState) => {
    // Remove file from open files
    const newOpenFiles = state.editor.openFiles.filter(f => f !== path);
    
    // If we're closing the current file, set currentFile to the last open file or null
    let newCurrentFile = state.editor.currentFile;
    let newContent = state.editor.content;
    let newModified = state.editor.modified;
    
    if (path === state.editor.currentFile) {
      newCurrentFile = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null;
      
      if (newCurrentFile === null) {
        // If no files left open, reset content and modified state
        newContent = '';
        newModified = false;
      }
    }
    
    return {
      editor: {
        ...state.editor,
        openFiles: newOpenFiles,
        currentFile: newCurrentFile,
        content: newContent,
        modified: newModified
      }
    };
  }),
  
  closeAllFiles: () => set((state: AppState) => ({
    editor: {
      ...state.editor,
      openFiles: [],
      currentFile: null,
      content: '',
      modified: false
    }
  })),
  
  // Preferences state
  preferences: defaultPreferences,
  setPreferences: (preferences: Preferences) => set({ preferences }),
  
  // UI state
  prefsModalOpen: false,
  setPrefsModalOpen: (open: boolean) => set({ prefsModalOpen: open }),
  
  previewVisible: true,
  setPreviewVisible: (visible: boolean) => set({ previewVisible: visible }),
  
  // Reset state
  resetState: () => set({
    editor: initialEditorState,
    preferences: defaultPreferences,
    prefsModalOpen: false,
    previewVisible: true,
  }),
}));
