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
    if zip_bytes.len() >= 4 {
        if zip_bytes[0] != 0x50 || zip_bytes[1] != 0x4B || zip_bytes[2] != 0x03 || zip_bytes[3] != 0x04 {
            return serde_wasm_bindgen::to_value(&Vec::<Value>::new()).unwrap();
        }
    }

    let reader = Cursor::new(zip_bytes);
    let mut archive = match ZipArchive::new(reader) {
        Ok(archive) => archive,
        Err(_) => {
            return serde_wasm_bindgen::to_value(&Vec::<Value>::new()).unwrap();
        },
    };

    // Create a single array to hold all JSON objects from all files
    let mut all_json_strings = Vec::new();


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

                let mut contents = Vec::new();
                if file.read_to_end(&mut contents).is_ok() {
                    if let Ok(json) = serde_json::from_slice::<Value>(&contents) {
                        if let Ok(json_str) = serde_json::to_string(&json) {
                            all_json_strings.push(json_str);
                        }
                    }
                }
            }
        }
    }

    // Return array of JSON strings
    serde_wasm_bindgen::to_value(&all_json_strings).unwrap()
}
