import { useLocalSearchParams } from "expo-router";
import { SavedInformationExportPreview } from "../features/security";
import { WellnessScreen } from "../features/wellness";
export default function Screen() {
  const { origin, categories } = useLocalSearchParams<{ origin?: string; categories?: string }>();
  if (origin === "saved-information") return <SavedInformationExportPreview categories={categories} />;
  return <WellnessScreen id={13} />;
}
