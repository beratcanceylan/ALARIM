import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";

type IconName =
  | "arrow.left"
  | "arrow.right"
  | "bell.fill"
  | "camera.fill"
  | "calendar"
  | "checkmark"
  | "chevron.down"
  | "chevron.up"
  | "clock.fill"
  | "ellipsis.circle"
  | "music.note"
  | "pencil"
  | "photo"
  | "plus"
  | "play.fill"
  | "trash"
  | "xmark";

type Props = {
  name: IconName;
  color: string;
  size?: number;
};

const materialIconNames: Record<IconName, keyof typeof MaterialCommunityIcons.glyphMap> = {
  "arrow.left": "arrow-left",
  "arrow.right": "arrow-right",
  "bell.fill": "bell",
  "camera.fill": "camera",
  calendar: "calendar-month-outline",
  checkmark: "check",
  "chevron.down": "chevron-down",
  "chevron.up": "chevron-up",
  "clock.fill": "clock-outline",
  "ellipsis.circle": "dots-horizontal-circle-outline",
  "music.note": "music-note",
  pencil: "pencil-outline",
  photo: "image-outline",
  plus: "plus",
  "play.fill": "play",
  "trash": "trash-can-outline",
  xmark: "close",
};

export function AppIcon({ name, color, size = 20 }: Props) {
  if (process.env.EXPO_OS === "ios") {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={`sf:${name}`}
        contentFit="contain"
        style={{ width: size, height: size, tintColor: color }}
      />
    );
  }

  return <MaterialCommunityIcons name={materialIconNames[name]} color={color} size={size} />;
}
