import { useColorScheme } from "react-native";

export const lightColors = {
  background: "#F7F5F2",
  surface: "#FFFFFF",
  surfaceMuted: "#F0EEF8",
  surfaceStrong: "#E7E3F2",
  border: "#E3DFEA",
  text: "#1B1920",
  textMuted: "#706B7B",
  primary: "#6254D8",
  primarySoft: "#EAE6FF",
  onPrimary: "#FFFFFF",
  accent: "#E58C67",
  accentSoft: "#FBE9DF",
  danger: "#B3261E",
  dangerSoft: "#FCE8E6",
  warning: "#8B5A12",
  warningSoft: "#FFF1D5",
  success: "#247A50",
  shadow: "rgba(36, 27, 75, 0.14)",
};

export const darkColors = {
  background: "#121116",
  surface: "#1C1A21",
  surfaceMuted: "#292633",
  surfaceStrong: "#363143",
  border: "#3E3A49",
  text: "#F6F2FA",
  textMuted: "#BDB7C7",
  primary: "#B9ACFF",
  primarySoft: "#393262",
  onPrimary: "#211A4D",
  accent: "#FFB18A",
  accentSoft: "#573B32",
  danger: "#FFB4AB",
  dangerSoft: "#5A201C",
  warning: "#FFD38B",
  warningSoft: "#4D3B1D",
  success: "#8BD5AC",
  shadow: "rgba(0, 0, 0, 0.36)",
};

export type AppColors = typeof lightColors;

export function useAppColors(): AppColors {
  return useColorScheme() === "dark" ? darkColors : lightColors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const radii = {
  sm: 14,
  md: 20,
  lg: 28,
  pill: 999,
};
