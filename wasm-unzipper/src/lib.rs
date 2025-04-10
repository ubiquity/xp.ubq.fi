use wasm_bindgen::prelude::*;
use miniz_oxide::inflate::decompress_to_vec_zlib;
use serde_json::Value;
use serde_wasm_bindgen;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn extract_jsons(zip_bytes: &[u8]) -> JsValue {
    let mut pos = 0;
    let mut results = Vec::new();

    while pos + 30 < zip_bytes.len() {
        // Check for local file header signature
        if &zip_bytes[pos..pos + 4] != [0x50, 0x4b, 0x03, 0x04] {
            pos += 1;
            continue;
        }

        // Parse local file header
        let file_name_len = u16::from_le_bytes([zip_bytes[pos + 26], zip_bytes[pos + 27]]) as usize;
        let extra_len = u16::from_le_bytes([zip_bytes[pos + 28], zip_bytes[pos + 29]]) as usize;
        let compressed_size = u32::from_le_bytes([
            zip_bytes[pos + 18],
            zip_bytes[pos + 19],
            zip_bytes[pos + 20],
            zip_bytes[pos + 21],
        ]) as usize;
        let compression_method = u16::from_le_bytes([zip_bytes[pos + 8], zip_bytes[pos + 9]]);

        let name_start = pos + 30;
        let name_end = name_start + file_name_len;
        if name_end > zip_bytes.len() {
            break;
        }
        let file_name = &zip_bytes[name_start..name_end];
        let file_name_str = String::from_utf8_lossy(file_name);

        let data_start = name_end + extra_len;
        let data_end = data_start + compressed_size;
        if data_end > zip_bytes.len() {
            break;
        }
        let compressed_data = &zip_bytes[data_start..data_end];

        if file_name_str.ends_with(".json") {
            let decompressed = if compression_method == 0 {
                compressed_data.to_vec()
            } else if compression_method == 8 {
                miniz_oxide::inflate::decompress_to_vec(compressed_data).unwrap_or_default()
            } else {
                Vec::new()
            };

            if let Ok(json) = serde_json::from_slice::<Value>(&decompressed) {
                results.push(json);
            }
        }

        pos = data_end;
    }

    serde_wasm_bindgen::to_value(&results).unwrap()
}
