export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileEntry[];
}

export interface Margins {
  x: string;
  y: string;
}

export interface Fonts {
  main: string;
  mono: string;
}

export interface Preferences {
  papersize: string;  // Changed from paper_size to papersize for Typst compatibility
  margin: Margins;    // Changed from margins to margin for Typst compatibility
  toc: boolean;
  number_sections: boolean;
  default_image_width: string;
  default_image_alignment: string;
  fonts: Fonts;
  theme: 'dark' | 'light';
  // Preview optimization settings
  render_debounce_ms: number;
  focused_preview_enabled: boolean;
  preserve_scroll_position: boolean;
}

export interface CompileStatus {
  status: 'idle' | 'queued' | 'running' | 'ok' | 'error';
  message?: string;
  details?: string;
  pdf_path?: string;
}

export type ImageAlignment = 'left' | 'center' | 'right';

export interface EditorState {
  currentFile: string | null;
  openFiles: string[];  // List of open file paths
  content: string;
  modified: boolean;
  compileStatus: CompileStatus;
}
