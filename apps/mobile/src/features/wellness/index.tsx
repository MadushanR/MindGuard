import type { ScreenId } from "@mindguard/contracts";
import {
  HomeScreen,
  TrendsScreen,
  SourcesScreen,
  ResourcesScreen,
  ShareScreen,
  SettingsScreen,
  WatchScreen,
  RecipientScreen,
} from "./screens";
export { WellnessProvider } from "./state";
export function WellnessScreen({ id }: { id: ScreenId }) {
  const Screen = {
    5: HomeScreen,
    9: TrendsScreen,
    10: SourcesScreen,
    11: ResourcesScreen,
    13: ShareScreen,
    18: SettingsScreen,
    19: WatchScreen,
    20: RecipientScreen,
  }[id as 5 | 9 | 10 | 11 | 13 | 18 | 19 | 20];
  return <Screen />;
}
