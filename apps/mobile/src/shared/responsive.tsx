import { Children, isValidElement, type PropsWithChildren } from "react";
import { Platform, useWindowDimensions, View } from "react-native";

/** Browser presentation only: native layouts never enter desktop mode. */
export function useBrowserLayout() {
  const { width } = useWindowDimensions();
  return {
    desktop: Platform.OS === "web" && width >= 900,
    columns: Platform.OS === "web" && width >= 1100 ? 2 : 1,
    browser: Platform.OS === "web",
  };
}

export function ResponsiveGrid({ children }: PropsWithChildren) {
  const { columns } = useBrowserLayout();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
      {Children.toArray(children).map((child, index) => (
        <View
          key={isValidElement(child) ? child.key : index}
          style={{ width: columns === 2 ? "48%" : "100%", flexGrow: 1 }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
