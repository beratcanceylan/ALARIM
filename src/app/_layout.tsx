import { Stack } from "expo-router/stack";
import { useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";

import { NotificationBridge } from "@/components/notification-bridge";
import { useAppColors } from "@/constants/theme";
import { AlarmStoreProvider } from "@/context/alarm-store";

export default function RootLayout() {
  const colors = useAppColors();
  const colorScheme = useColorScheme();

  return (
    <AlarmStoreProvider>
      <NotificationBridge />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text, fontWeight: "800" },
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
          animation: "slide_from_right",
        }}
      />
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </AlarmStoreProvider>
  );
}
