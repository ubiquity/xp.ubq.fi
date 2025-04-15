
/**
 * Recursively converts Maps (and nested Maps) to plain JS objects/arrays.
 */
export function mapToObject(obj: any): any {
  if (obj instanceof Map) {
    const result: Record<string, any> = {};
    for (const [key, value] of obj.entries()) {
      result[key] = mapToObject(value);
    }
    return result;
  } else if (Array.isArray(obj)) {
    return obj.map(mapToObject);
  } else if (typeof obj === "object" && obj !== null) {
    const result: Record<string, any> = {};
    for (const key in obj) {
      result[key] = mapToObject(obj[key]);
    }
    return result;
  }
  return obj;
}

// Removed unused getUsableArtifacts function which relied on the old download flow
