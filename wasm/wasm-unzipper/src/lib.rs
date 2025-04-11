use wasm_bindgen::prelude::*;
use serde_json::Value;
use serde_wasm_bindgen;
use zip::ZipArchive;
use std::io::Cursor;
use std::io::Read;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn extract_jsons(zip_bytes: &[u8]) -> JsValue {
    web_sys::console::log_1(&format!("[ZIP-RUST] Starting extraction, zip size: {} bytes", zip_bytes.len()).into());

    // Debug: Print first few bytes to verify zip signature
    if zip_bytes.len() >= 4 {
        web_sys::console::log_1(&format!("[ZIP-RUST] Zip first 4 bytes: {:?}", &zip_bytes[0..4]).into());
        if zip_bytes[0] != 0x50 || zip_bytes[1] != 0x4B || zip_bytes[2] != 0x03 || zip_bytes[3] != 0x04 {
            web_sys::console::log_1(&"[ZIP-RUST] ERROR: Invalid ZIP signature".into());
            return serde_wasm_bindgen::to_value(&Vec::<Value>::new()).unwrap();
        }
    }

    let reader = Cursor::new(zip_bytes);
    let mut archive = match ZipArchive::new(reader) {
        Ok(archive) => {
            web_sys::console::log_1(&format!("[ZIP-RUST] Successfully created ZipArchive with {} entries", archive.len()).into());
            archive
        },
        Err(e) => {
            web_sys::console::log_1(&format!("[ZIP-RUST] Failed to create ZipArchive: {:?}", e).into());
            return serde_wasm_bindgen::to_value(&Vec::<Value>::new()).unwrap();
        },
    };

    // Create a single array to hold all JSON objects from all files
    let mut all_json_strings = Vec::new();

    // Print all files in the zip for debugging
    web_sys::console::log_1(&"[ZIP-RUST] Listing all files in zip:".into());
    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            web_sys::console::log_1(&format!("[ZIP-RUST] File {}: {}", i, file.name()).into());
        }
    }

    // Process all files
    for i in 0..archive.len() {
        if let Ok(mut file) = archive.by_index(i) {
            let name = file.name().to_string();

            // Skip directories and system files
            if name.ends_with("/") || name.contains("__MACOSX") || name.ends_with(".DS_Store") {
                continue;
            }

            // Process JSON files from results directory
            if name.ends_with(".json") && (name.contains("/results/") || name.contains("results/")) {
                // Skip invalid-issues.json
                if name.contains("invalid-issues") {
                    continue;
                }

                web_sys::console::log_1(&format!("[ZIP-RUST] Processing JSON file: {}", name).into());

                // Read file contents
                let mut contents = Vec::new();
                match file.read_to_end(&mut contents) {
                    Ok(bytes_read) => {
                        // Try to parse JSON
                        match serde_json::from_slice::<Value>(&contents) {
                            Ok(json) => {
                                web_sys::console::log_1(&format!("[ZIP-RUST] Successfully parsed JSON from {} ({} bytes)",
                                    name, bytes_read).into());

                                // Print a sample of the JSON content for debugging
                                let json_str = serde_json::to_string(&json).unwrap_or_default();
                                let preview = if json_str.len() > 100 {
                                    format!("{}...", &json_str[0..100])
                                } else {
                                    json_str
                                };
                                web_sys::console::log_1(&format!("[ZIP-RUST] JSON content preview: {}", preview).into());

                                // Serialize each JSON object to a string
                                let json_str = serde_json::to_string(&json).unwrap_or_default();
                                all_json_strings.push(json_str);
                            },
                            Err(e) => {
                                web_sys::console::log_1(&format!("[ZIP-RUST] Error parsing JSON from {}: {:?}", name, e).into());

                                // Try to convert to string for better debugging
                                match std::str::from_utf8(&contents) {
                                    Ok(text) => {
                                        let preview = if text.len() > 100 {
                                            format!("{}...", &text[0..100])
                                        } else {
                                            text.to_string()
                                        };
                                        web_sys::console::log_1(&format!("[ZIP-RUST] Content preview: {}", preview).into());
                                    },
                                    Err(_) => {
                                        web_sys::console::log_1(&"[ZIP-RUST] Content is not valid UTF-8".into());
                                    }
                                }
                            }
                        }
                    },
                    Err(e) => {
                        web_sys::console::log_1(&format!("[ZIP-RUST] Error reading file {}: {:?}", name, e).into());
                    }
                }
            }
        }
    }

    web_sys::console::log_1(&format!("[ZIP-RUST] Extraction complete. Found {} JSON objects", all_json_strings.len()).into());

    // Return the array of JSON strings
    serde_wasm_bindgen::to_value(&all_json_strings).unwrap()
}
