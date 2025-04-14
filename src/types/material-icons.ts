/**
 * Type definitions for Material Design Icons
 */

export type MaterialIconCategory =
  | "filled"
  | "outlined"
  | "round"
  | "sharp"
  | "two-tone";

// This is a subset of commonly used icons
// Use the generate-material-icons-map.ts script to generate a complete list
export type MaterialIconName =
  | "account_circle"
  | "add"
  | "arrow_back"
  | "arrow_forward"
  | "check"
  | "close"
  | "delete"
  | "download"
  | "edit"
  | "error"
  | "favorite"
  | "help"
  | "home"
  | "info"
  | "menu"
  | "more_vert"
  | "notification"
  | "person"
  | "refresh"
  | "search"
  | "settings"
  | "warning";

export interface MaterialIconProps {
  name: MaterialIconName;
  category?: MaterialIconCategory;
  size?: number; // Will be used to set width/height in px (must be multiple of 4)
}
