import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";

import { NotificationBridge } from "@/components/notification-bridge";
import { AlarmStoreProvider } from "@/context/alarm-store";

export default function RootLayout() {
  return (
    <AlarmStoreProvider>
      <NotificationBridge />
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
          animation: "slide_from_right",
        }}
      />
      <StatusBar style="auto" />
    </AlarmStoreProvider>
  );
}
