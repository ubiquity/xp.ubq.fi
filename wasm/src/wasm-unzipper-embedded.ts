import { wasmBase64 } from './wasm-base64';
import {
  addHeapObject,
  getObject,
  takeObject,
  base64ToUint8Array,
  passArray8ToWasm,
  passStringToWasm,
  getStringFromWasm,
  getDataViewMemory,
  debugString,
  WASM_VECTOR_LEN as helpersWasmVectorLen, // Import with alias to avoid conflict
  resetMemoryCaches
} from './wasm-helpers';

// Initialize the WebAssembly instance
let wasm: any; // Holds the instantiated WASM exports
let WASM_VECTOR_LEN = 0; // Local variable to track length for current operation

// The actual function that we need to expose
export function extract_jsons(zip_bytes: Uint8Array): any[] {
  if (!wasm) {
    throw new Error("WASM module not loaded yet. Call initWasm() first.");
  }
  // Use the helper, passing the necessary malloc function and memory
  const ptr0 = passArray8ToWasm(zip_bytes, wasm.__wbindgen_export_0, wasm.memory);
  // Read the length set by the helper
  const len0 = helpersWasmVectorLen;
  const ret = wasm.extract_jsons(ptr0, len0);
  // Use the helper to take the resulting object from the heap
  return takeObject(ret);
}

// Initialize WebAssembly from the base64 string
export async function initWasm(): Promise<void> {
  if (wasm) return; // Already initialized

  const wasmBytes = base64ToUint8Array(wasmBase64);
  const imports: any = { wbg: {} }; // Standard wasm-bindgen import object

  // --- Import Object Setup ---
  // Map JS functions to the names expected by the WASM module

  // Disable WASM logging
  imports.wbg.__wbg_log_c222819a41e063d3 = function(_arg0: number) {};

  imports.wbg.__wbg_new_405e22f390576ce2 = function() {
    const ret = new Object();
    return addHeapObject(ret); // Use helper
  };

  imports.wbg.__wbg_new_5e0be73521bc8c17 = function() {
    const ret = new Map();
    return addHeapObject(ret); // Use helper
  };

  imports.wbg.__wbg_new_78feb108b6472713 = function() {
    const ret = new Array();
    return addHeapObject(ret); // Use helper
  };

  imports.wbg.__wbg_set_37837023f3d740e8 = function(arg0: number, arg1: number, arg2: number) {
    getObject(arg0)[arg1 >>> 0] = takeObject(arg2); // Use helpers
  };

  imports.wbg.__wbg_set_3f1d0b984ed272ed = function(arg0: number, arg1: number, arg2: number) {
    getObject(arg0)[takeObject(arg1)] = takeObject(arg2); // Use helpers
  };

  imports.wbg.__wbg_set_8fc6bf8a5b1071d1 = function(arg0: number, arg1: number, arg2: number) {
    const ret = getObject(arg0).set(getObject(arg1), getObject(arg2)); // Use helpers
    return addHeapObject(ret); // Use helper
  };

  imports.wbg.__wbindgen_bigint_from_i64 = function(arg0: any) {
    const ret = arg0;
    return addHeapObject(ret); // Use helper
  };

  imports.wbg.__wbindgen_bigint_from_u64 = function(arg0: any) {
    const ret = BigInt.asUintN(64, arg0);
    return addHeapObject(ret); // Use helper
  };

  imports.wbg.__wbindgen_debug_string = function(arg0: number, arg1: number) {
    const ret = debugString(getObject(arg1)); // Use helper
    // Use the helper, passing necessary malloc/realloc and memory
    const ptr1 = passStringToWasm(ret, wasm.__wbindgen_export_0, wasm.__wbindgen_export_1, wasm.memory);
    // Read the length set by the helper
    const len1 = helpersWasmVectorLen;
    // Use helper to get DataView
    getDataViewMemory(wasm.memory).setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory(wasm.memory).setInt32(arg0 + 4 * 0, ptr1, true);
  };

  imports.wbg.__wbindgen_error_new = function(arg0: number, arg1: number) {
    // Use helper, passing memory
    const ret = new Error(getStringFromWasm(arg0, arg1, wasm.memory));
    return addHeapObject(ret); // Use helper
  };

  imports.wbg.__wbindgen_is_string = function(arg0: number) {
    const ret = typeof(getObject(arg0)) === 'string'; // Use helper
    return ret;
  };

  imports.wbg.__wbindgen_number_new = function(arg0: number) {
    const ret = arg0;
    return addHeapObject(ret); // Use helper
  };

  imports.wbg.__wbindgen_object_drop_ref = function(arg0: number) {
    takeObject(arg0); // Use helper
  };

  imports.wbg.__wbindgen_string_new = function(arg0: number, arg1: number) {
    // Use helper, passing memory
    const ret = getStringFromWasm(arg0, arg1, wasm.memory);
    return addHeapObject(ret); // Use helper
  };

  imports.wbg.__wbindgen_throw = function(arg0: number, arg1: number) {
    // Use helper, passing memory
    throw new Error(getStringFromWasm(arg0, arg1, wasm.memory));
  };

  // Instantiate the WebAssembly module
  const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
  wasm = instance.exports;

  // Reset memory caches after instantiation, in case memory layout changed
  resetMemoryCaches();
}
