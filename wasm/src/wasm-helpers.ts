// --- Heap Management ---
const heap = new Array(128).fill(undefined);
heap.push(undefined, null, true, false);
let heap_next = heap.length;

export function addHeapObject(obj: any): number {
  if (heap_next === heap.length) heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];
  heap[idx] = obj;
  return idx;
}

export function getObject(idx: number): any { return heap[idx]; }

export function dropObject(idx: number): void {
  if (idx < 132) return;
  heap[idx] = heap_next;
  heap_next = idx;
}

export function takeObject(idx: number): any {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}

// --- Memory Access ---
let cachedUint8ArrayMemory: Uint8Array | null = null;
let cachedDataViewMemory: DataView | null = null;
export let WASM_VECTOR_LEN = 0; // Export this so it can be set/read

export function getUint8ArrayMemory(memory: WebAssembly.Memory): Uint8Array {
  if (cachedUint8ArrayMemory === null || cachedUint8ArrayMemory.byteLength === 0) {
    cachedUint8ArrayMemory = new Uint8Array(memory.buffer);
  }
  return cachedUint8ArrayMemory;
}

export function getDataViewMemory(memory: WebAssembly.Memory): DataView {
  if (cachedDataViewMemory === null || cachedDataViewMemory.buffer !== memory.buffer) {
    cachedDataViewMemory = new DataView(memory.buffer);
  }
  return cachedDataViewMemory;
}

// Function to reset cached views, needed if memory grows
export function resetMemoryCaches(): void {
  cachedUint8ArrayMemory = null;
  cachedDataViewMemory = null;
}

export function passArray8ToWasm(arg: Uint8Array, malloc: (size: number, align: number) => number, memory: WebAssembly.Memory): number {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory(memory).set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length; // Update exported variable
  return ptr;
}

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder() : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof TextEncoder !== 'undefined' && 'encodeInto' in TextEncoder.prototype
  ? function (arg: string, view: Uint8Array) {
    return (cachedTextEncoder as TextEncoder).encodeInto(arg, view);
  }
  : function (arg: string, view: Uint8Array) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  });

export function passStringToWasm(
  arg: string,
  malloc: (size: number, align: number) => number,
  realloc: ((ptr: number, oldSize: number, newSize: number, align: number) => number) | undefined,
  memory: WebAssembly.Memory
): number {
  const mem = getUint8ArrayMemory(memory);

  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    mem.subarray(ptr, ptr + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length; // Update exported variable
    return ptr;
  }

  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  let offset = 0;

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7F) break;
    mem[ptr + offset] = code;
  }

  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = mem.subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }

  WASM_VECTOR_LEN = offset; // Update exported variable
  return ptr;
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );
if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); }; // Eagerly check if TextDecoder works

export function getStringFromWasm(ptr: number, len: number, memory: WebAssembly.Memory): string {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8ArrayMemory(memory).subarray(ptr, ptr + len));
}

// --- Base64 Conversion ---
export function base64ToUint8Array(base64: string): Uint8Array {
  try {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Failed to decode base64 string:", e);
    throw new Error("Invalid base64 string provided.");
  }
}

// --- Debug String ---
export function debugString(val: any): string {
  // primitive types
  const type = typeof val;
  if (type == 'number' || type == 'boolean' || val == null) {
    return `${val}`;
  }
  if (type == 'string') {
    return `"${val}"`;
  }
  if (type == 'symbol') {
    const description = val.description;
    if (description == null) {
      return 'Symbol';
    } else {
      return `Symbol(${description})`;
    }
  }
  if (type == 'function') {
    const name = val.name;
    if (typeof name == 'string' && name.length > 0) {
      return `Function(${name})`;
    } else {
      return 'Function';
    }
  }
  // objects
  if (Array.isArray(val)) {
    const length = val.length;
    let debug = '[';
    if (length > 0) {
      debug += debugString(val[0]);
    }
    for(let i = 1; i < length; i++) {
      debug += ', ' + debugString(val[i]);
    }
    debug += ']';
    return debug;
  }
  // Test for built-in
  const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
  let className;
  if (builtInMatches && builtInMatches.length > 1) {
    className = builtInMatches[1];
  } else {
    // Failed to match the standard '[object ClassName]'
    return toString.call(val);
  }
  if (className == 'Object') {
    // we're a user defined class or Object
    // JSON.stringify avoids problems with cycles, and is generally much
    // easier than looping through ownProperties of `val`.
    try {
      return 'Object(' + JSON.stringify(val) + ')';
    } catch (_) {
      return 'Object';
    }
  }
  // errors
  if (val instanceof Error) {
    return `${val.name}: ${val.message}\n${val.stack}`;
  }
  // TODO we could test for more things here, like `Set`s and `Map`s.
  return className;
}
