import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { setPreferences, applyPreferences, getCacheStats, clearRenderCache } from '../api';
import type { Preferences } from '../types';
import './PrefsModal.css';

const PrefsModal: React.FC = () => {
  const { preferences, setPreferences: updatePreferences, setPrefsModalOpen } = useAppStore();
  const [formData, setFormData] = useState<Preferences>({ ...preferences });
  const [saving, setSaving] = useState(false);
  const [cacheStats, setCacheStats] = useState<{
    cached_documents: number;
    cache_size_mb: number;
    cache_hits: number;
    cache_misses: number;
  } | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    // Reset form data when preferences change
    setFormData({ ...preferences });
    
    // Load cache stats when modal opens
    loadCacheStats();
  }, [preferences]);

  const loadCacheStats = async () => {
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      await clearRenderCache();
      await loadCacheStats(); // Refresh stats
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setClearingCache(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    // Handle checkboxes
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }
    
    // Handle nested properties (margin, fonts)
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      
      if (parent === 'margin') {
        setFormData(prev => ({
          ...prev,
          margin: {
            ...prev.margin,
            [child]: value,
          },
        }));
      } else if (parent === 'fonts') {
        setFormData(prev => ({
          ...prev,
          fonts: {
            ...prev.fonts,
            [child]: value,
          },
        }));
      }
      return;
    }
    
    // Handle regular inputs
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      // Update preferences in the backend
      await setPreferences(formData);
      
      // Update preferences in the store
      updatePreferences(formData);
      
      // Apply preferences to generate prefs.json for Typst
      await applyPreferences();
      
      // Close the modal
      setPrefsModalOpen(false);
    } catch (err) {
      console.error('Failed to save preferences:', err);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPrefsModalOpen(false);
  };

  return (
    <div className="prefs-modal-overlay">
      <div className="prefs-modal">
        <div className="prefs-modal-header">
          <h2>Preferences</h2>
          <button 
            className="close-button" 
            onClick={handleCancel}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="prefs-section">
            <h3>Document</h3>
            
            <div className="form-group">
              <label htmlFor="papersize">Paper Size</label>
              <select
                id="papersize"
                name="papersize"
                value={formData.papersize}
                onChange={handleInputChange}
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="legal">Legal</option>
              </select>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="margin.x">Horizontal Margin</label>
                <input
                  type="text"
                  id="margin.x"
                  name="margin.x"
                  value={formData.margin.x}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="margin.y">Vertical Margin</label>
                <input
                  type="text"
                  id="margin.y"
                  name="margin.y"
                  value={formData.margin.y}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="toc"
                  checked={formData.toc}
                  onChange={handleInputChange}
                />
                Include Table of Contents
              </label>
            </div>
            
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="number_sections"
                  checked={formData.number_sections}
                  onChange={handleInputChange}
                />
                Number Sections
              </label>
            </div>
          </div>

          <div className="prefs-section">
            <h3>Theme</h3>
            <div className="form-group">
              <label htmlFor="theme">Interface Theme</label>
              <select
                id="theme"
                name="theme"
                value={formData.theme}
                onChange={handleInputChange}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </div>
          
          <div className="prefs-section">
            <h3>Images</h3>
            
            <div className="form-group">
              <label htmlFor="default_image_width">Default Image Width</label>
              <input
                type="text"
                id="default_image_width"
                name="default_image_width"
                value={formData.default_image_width}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="default_image_alignment">Default Image Alignment</label>
              <select
                id="default_image_alignment"
                name="default_image_alignment"
                value={formData.default_image_alignment}
                onChange={handleInputChange}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
          
          <div className="prefs-section">
            <h3>Performance & Caching</h3>
            
            {cacheStats && (
              <div className="cache-stats">
                <h4>Cache Statistics</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Cached Documents:</span>
                    <span className="stat-value">{cacheStats.cached_documents}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Cache Size:</span>
                    <span className="stat-value">{cacheStats.cache_size_mb.toFixed(2)} MB</span>
                  </div>
                </div>
                
                <button 
                  type="button"
                  className="clear-cache-btn"
                  onClick={handleClearCache}
                  disabled={clearingCache}
                >
                  {clearingCache ? 'Clearing...' : 'Clear Cache'}
                </button>
              </div>
            )}
          </div>
          
          <div className="prefs-section">
            <h3>Fonts</h3>
            
            <div className="form-group">
              <label htmlFor="fonts.main">Main Font</label>
              <input
                type="text"
                id="fonts.main"
                name="fonts.main"
                value={formData.fonts.main}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="fonts.mono">Monospace Font</label>
              <input
                type="text"
                id="fonts.mono"
                name="fonts.mono"
                value={formData.fonts.mono}
                onChange={handleInputChange}
              />
            </div>
          </div>
          
          <div className="form-actions">
            <button 
              type="button" 
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PrefsModal;
