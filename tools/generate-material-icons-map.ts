import { glob } from "glob";
import fs from "node:fs";
import path from "node:path";

async function generateIconMap() {
  const categories = ["filled", "outlined", "round", "sharp", "two-tone"];
  const iconSet = new Set<string>();

  try {
    // Scan for all SVG files in the material-design-icons package
    for (const category of categories) {
      const pattern = `node_modules/material-design-icons/${category}/*/24px.svg`;
      const files = await glob(pattern);

      // Extract icon names from paths
      files.forEach(file => {
        const iconName = path.basename(path.dirname(file));
        iconSet.add(iconName);
      });
    }

    // Sort icon names alphabetically
    const sortedIcons = Array.from(iconSet).sort();

    // Generate TypeScript type definition
    const typeContent = `/**
 * Auto-generated Material Design Icons type definitions
 * Generated on: ${new Date().toISOString()}
 */

export type MaterialIconCategory =
  | "filled"
  | "outlined"
  | "round"
  | "sharp"
  | "two-tone";

export type MaterialIconName =
${sortedIcons.map(icon => `  | "${icon}"`).join("\n")};

export interface MaterialIconProps {
  name: MaterialIconName;
  category?: MaterialIconCategory;
  size?: number; // Will be used to set width/height in px (must be multiple of 4)
}
`;

    // Write the updated type definitions
    fs.writeFileSync("src/types/material-icons.ts", typeContent);
    console.log(`Updated MaterialIconName type with ${sortedIcons.length} icons`);
  } catch (error) {
    console.error("Error generating icon map:", error);
    process.exit(1);
  }
}

// Run the generator
generateIconMap();
