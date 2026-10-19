import type { PropsWithChildren } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
export function Page({
  children,
  scroll = true,
}: PropsWithChildren<{ scroll?: boolean }>) {
  const { width } = useWindowDimensions();
  const style = {
    paddingHorizontal: width <= 350 ? 19 : 26,
    paddingTop: 26,
    paddingBottom: 28,
    gap: 18,
  };
  return scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={style}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[style, { flex: 1 }]}>{children}</View>
  );
}
