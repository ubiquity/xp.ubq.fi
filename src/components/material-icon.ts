import { loadIcon, preloadIcon } from "../services/icon-service";
import type { MaterialIconCategory, MaterialIconName, MaterialIconProps } from "../types/material-icons";

/**
 * Material Icon Web Component
 * Usage:
 * <material-icon name="add" category="filled" size="24"></material-icon>
 */
export class MaterialIcon extends HTMLElement {
  static observedAttributes = ["name", "category", "size"];

  /**
   * Preload commonly used icons to improve performance
   */
  static preloadCommonIcons() {
    const commonIcons: MaterialIconName[] = ["add", "close", "menu", "search"];
    commonIcons.forEach(icon => preloadIcon(icon));
  }

  private async updateIcon() {
    const name = this.getAttribute("name") as MaterialIconName;
    const category = (this.getAttribute("category") || "filled") as MaterialIconCategory;
    const size = Number(this.getAttribute("size")) || 24;

    if (!name) {
      console.error("Material icon name is required");
      return;
    }

    // Ensure size is a multiple of 4 as per project requirements
    const adjustedSize = Math.round(size / 4) * 4;

    try {
      const svg = await loadIcon(name, category);
      if (svg) {
        this.innerHTML = svg;
        const svgElement = this.querySelector("svg");
        if (svgElement) {
          svgElement.style.width = `${adjustedSize}px`;
          svgElement.style.height = `${adjustedSize}px`;
          // Ensure SVG inherits the current text color
          svgElement.style.fill = "currentColor";
        }
      }
    } catch (error) {
      console.error(`Failed to load icon: ${name}`, error);
    }
  }

  connectedCallback() {
    this.updateIcon();
  }

  attributeChangedCallback() {
    this.updateIcon();
  }
}

// Register the web component
if (!customElements.get("material-icon")) {
  customElements.define("material-icon", MaterialIcon);
  // Preload common icons when the component is first defined
  MaterialIcon.preloadCommonIcons();
}
