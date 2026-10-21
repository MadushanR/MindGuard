import type { ScreenId } from "@mindguard/contracts";
import { PlaceholderScreen } from "../../shared/PlaceholderScreen";
export {
  SharedInformationProvider,
  useSharedInformation,
  type SharedInformationContextValue,
} from "./SharedInformationProvider";
export type { ShareInput, SharedInformationRecord } from "./sharedInformation";
export {
  RecipientsProvider,
  useRecipients,
  type RecipientsContextValue,
} from "./RecipientsProvider";
export type {
  RecipientInput,
  RecipientRelationship,
  TrustedRecipient,
} from "./recipients";
/** Munsif replaces these screen exports; shared navigation and AI internals stay untouched. */
export function SecurityScreen({ id }: { id: ScreenId }) {
  return <PlaceholderScreen id={id} />;
}
