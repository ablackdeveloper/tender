import type { ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

type TabIconProps = {
  name: "today" | "memories" | "care" | "together";
  color: ColorValue;
  size: number;
  focused: boolean;
};

// Local vector shapes render without an icon font or a network asset.
// The parent tab supplies the accessible name and selected state.
export function TabIcon({ name, color, size, focused }: TabIconProps) {
  return (
    <Svg
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={focused ? 2.25 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "today" ? (
        <>
          <Circle cx={12} cy={12} r={4} />
          <Path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </>
      ) : null}
      {name === "memories" ? (
        <Path d="M12 6C9 4 6 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1v14" />
      ) : null}
      {name === "care" ? (
        <Path d="M12 20 4.5 12.5C.5 8.5 3 3 7 4c2 .4 3.5 1.5 5 3 1.5-1.5 3-2.6 5-3 4-1 6.5 4.5 2.5 8.5L12 20Z" />
      ) : null}
      {name === "together" ? (
        <>
          <Circle cx={8} cy={8} r={3} />
          <Circle cx={17} cy={9} r={2.5} />
          <Path d="M2 20v-2c0-3 2.5-5 6-5s6 2 6 5v2M16 14c3.5 0 6 2 6 5v1" />
        </>
      ) : null}
    </Svg>
  );
}
