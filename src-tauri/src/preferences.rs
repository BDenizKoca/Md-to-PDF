use crate::utils;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use std::sync::atomic::{AtomicU64, Ordering};
use lazy_static::lazy_static;

// Global monotonically increasing version for preference writes
lazy_static! {
    static ref PREFS_VERSION: AtomicU64 = AtomicU64::new(0);
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Preferences {
    pub papersize: String,  // Changed from paper_size to papersize for Typst compatibility
    pub margin: Margins,    // Changed from margins to margin for Typst compatibility
    pub toc: bool,
    #[serde(default)]
    pub toc_title: String,
    #[serde(rename = "numberSections")]
    pub number_sections: bool,  // Serialize as numberSections for Typst
    pub default_image_width: String,
    pub default_image_alignment: String,
    pub fonts: Fonts,
    // Preview optimization settings
    pub render_debounce_ms: u32,
    pub focused_preview_enabled: bool,
    pub preserve_scroll_position: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Margins {
    pub x: String,
    pub y: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Fonts {
    pub main: String,
    pub mono: String,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            papersize: "a4".to_string(),  // Changed from paper_size to papersize
            margin: Margins {              // Changed from margins to margin
                x: "2cm".to_string(),
                y: "2.5cm".to_string(),
            },
            toc: false, // default disabled
            toc_title: String::new(),
            number_sections: true,
            default_image_width: "60%".to_string(),
            default_image_alignment: "center".to_string(),
            fonts: Fonts {
                main: "New Computer Modern".to_string(),
                mono: "Liberation Mono".to_string(),
            },
            // Preview optimization defaults
            render_debounce_ms: 400,  // 400ms for responsive feel
            focused_preview_enabled: true,
            preserve_scroll_position: true,
        }
    }
}

#[tauri::command]
pub async fn get_preferences(app_handle: AppHandle) -> Result<Preferences, String> {
    let prefs_path = get_preferences_path(&app_handle)?;
    
    if !prefs_path.exists() {
        // If preferences don't exist, create default ones
        let default_prefs = Preferences::default();
        save_preferences_to_file(&app_handle, &default_prefs)?;
        return Ok(default_prefs);
    }
    
    let prefs_content = fs::read_to_string(&prefs_path)
        .map_err(|e| format!("Failed to read preferences: {}", e))?;
    
    let parsed: Preferences = serde_json::from_str(&prefs_content)
        .map_err(|e| format!("Failed to parse preferences: {}", e))?;
    // Emit prefs-read event (does not advance version)
    let payload = serde_json::json!({
        "event": "read",
        "toc": parsed.toc,
        "numberSections": parsed.number_sections,
        "version": PREFS_VERSION.load(Ordering::Relaxed),
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });
    app_handle.emit("prefs-read", payload).ok();
    Ok(parsed)
}

#[tauri::command]
pub async fn set_preferences(app_handle: AppHandle, preferences: Preferences) -> Result<(), String> {
    save_preferences_to_file(&app_handle, &preferences)?;
    apply_preferences_internal(&app_handle, &preferences)
}

#[tauri::command]
pub async fn apply_preferences(app_handle: AppHandle) -> Result<(), String> {
    let preferences = get_preferences(app_handle.clone()).await?;
    apply_preferences_internal(&app_handle, &preferences)
}

fn get_preferences_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let content_dir = utils::get_content_dir(app_handle)
        .map_err(|e| e.to_string())?;
    Ok(content_dir.join("prefs.json"))
}

fn save_preferences_to_file(app_handle: &AppHandle, preferences: &Preferences) -> Result<(), String> {
    let prefs_path = get_preferences_path(app_handle)?;
    
    let json = serde_json::to_string_pretty(preferences)
        .map_err(|e| format!("Failed to serialize preferences: {}", e))?;
    
    fs::write(&prefs_path, json)
        .map_err(|e| format!("Failed to write preferences: {}", e))?;
    // Increment version & emit prefs-write event
    let ver = PREFS_VERSION.fetch_add(1, Ordering::Relaxed) + 1;
    let payload = serde_json::json!({
        "event": "write",
        "toc": preferences.toc,
        "numberSections": preferences.number_sections,
        "version": ver,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });
    app_handle.emit("prefs-write", payload).ok();
    Ok(())
}

fn apply_preferences_internal(app_handle: &AppHandle, preferences: &Preferences) -> Result<(), String> {
    // For Typst, we only need to ensure preferences are saved to _prefs.json
    // The template will read this file directly
    save_preferences_to_file(app_handle, preferences)
}
