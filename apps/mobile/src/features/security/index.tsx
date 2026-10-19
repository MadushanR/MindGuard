import type { ScreenId } from "@mindguard/contracts";
import { PlaceholderScreen } from "../../shared/PlaceholderScreen";
/** Munsif replaces these screen exports; shared navigation and AI internals stay untouched. */
export function SecurityScreen({ id }: { id: ScreenId }) {
  return <PlaceholderScreen id={id} />;
}
