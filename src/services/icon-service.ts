/**
 * Service for dynamically importing Material Design icons
 */
export async function loadIcon(iconName: string, category: string = "filled"): Promise<string> {
  try {
    // Use dynamic import to load the SVG file
    const baseUrl = new URL("../../node_modules/material-design-icons", import.meta.url);
    const iconPath = new URL(`${category}/${iconName}/24px.svg`, baseUrl);

    const response = await fetch(iconPath);
    if (!response.ok) {
      throw new Error(`Failed to load icon: ${iconName}`);
    }

    return await response.text();
  } catch (error) {
    console.error(`Error loading icon ${iconName}:`, error);
    return ""; // Return empty string on error
  }
}

/**
 * Pre-load an icon to ensure it's in the browser cache
 */
export function preloadIcon(iconName: string, category: string = "filled"): void {
  loadIcon(iconName, category).catch(() => {
    // Silently fail for preloads
  });
}
