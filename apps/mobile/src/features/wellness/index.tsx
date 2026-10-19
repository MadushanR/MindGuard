import type { ScreenId } from "@mindguard/contracts";
import { PlaceholderScreen } from "../../shared/PlaceholderScreen";
/** Zain replaces these screen exports; shared navigation and AI internals stay untouched. */
export function WellnessScreen({ id }: { id: ScreenId }) {
  return <PlaceholderScreen id={id} />;
}
