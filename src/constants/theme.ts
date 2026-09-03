import { useColorScheme } from "react-native";

export const lightColors = {
  background: "#F8F7FC",
  surface: "#FFFFFF",
  surfaceMuted: "#F0EFF7",
  border: "#E3E1EC",
  text: "#1C1B20",
  textMuted: "#6C6978",
  primary: "#5C4FD6",
  primarySoft: "#E9E5FF",
  onPrimary: "#FFFFFF",
  danger: "#B3261E",
  dangerSoft: "#FCE8E6",
  success: "#247A50",
  shadow: "rgba(31, 24, 66, 0.10)",
};

export const darkColors = {
  background: "#121116",
  surface: "#1D1B22",
  surfaceMuted: "#282630",
  border: "#3A3744",
  text: "#F2F0F7",
  textMuted: "#B8B4C2",
  primary: "#B7A9FF",
  primarySoft: "#393264",
  onPrimary: "#211A4D",
  danger: "#FFB4AB",
  dangerSoft: "#5A201C",
  success: "#8BD5AC",
  shadow: "rgba(0, 0, 0, 0.35)",
};

export type AppColors = typeof lightColors;

export function useAppColors(): AppColors {
  return useColorScheme() === "dark" ? darkColors : lightColors;
}

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};
