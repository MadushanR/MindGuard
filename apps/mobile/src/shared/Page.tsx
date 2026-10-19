import type { PropsWithChildren } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useBrowserLayout } from "./responsive";
export function Page({
  children,
  scroll = true,
  wide = false,
}: PropsWithChildren<{ scroll?: boolean; wide?: boolean }>) {
  const { width } = useWindowDimensions();
  const { desktop } = useBrowserLayout();
  const style = {
    paddingHorizontal: desktop ? 40 : width <= 350 ? 19 : 26,
    paddingTop: desktop ? 40 : 26,
    paddingBottom: desktop ? 48 : 28,
    gap: 18,
  };
  const content = desktop ? (
    <View
      style={{
        width: "100%",
        maxWidth: wide ? 1120 : 760,
        alignSelf: "center",
        gap: 18,
      }}
    >
      {children}
    </View>
  ) : (
    children
  );
  return scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={style}
    >
      {content}
    </ScrollView>
  ) : (
    <View style={[style, { flex: 1 }]}>{content}</View>
  );
}
