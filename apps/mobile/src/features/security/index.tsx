import type { ScreenId } from "@mindguard/contracts";
import { PlaceholderScreen } from "../../shared/PlaceholderScreen";
export { SavedInformationExportPreview } from "./SavedInformationExportPreview";
export { SavedInformationProvider, useSavedInformation, type SavedInformationContextValue } from "./SavedInformationProvider";
export type { SavedCategoryId, SavedInformationCategory } from "./savedInformation";
export {
  SharedInformationProvider,
  useSharedInformation,
  type SharedInformationContextValue,
  type ShareSubmitResult,
  type RevokeResult,
} from "./SharedInformationProvider";
export type { ShareInput, SharedInformationRecord, RevocationState } from "./sharedInformation";
export {
  createSimulatedSharingService,
  type SharingService,
  type SimulatedSharingService,
  type ShareErrorCode,
  type ShareServiceRequest,
  type ShareServiceResult,
  type RevokeServiceResult,
} from "./sharingService";
export { readSharingConsent } from "./sharingConsent";
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
