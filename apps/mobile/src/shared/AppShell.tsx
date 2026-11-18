import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { demoScenarios, fixtureErrors, screenCopy } from "@mindguard/fixtures";
import { useAI } from "../features/ai/AIProvider";
import { useSecuritySession } from "../features/security/SecuritySessionProvider";
import { destinations, route } from "./navigation";
import { createThemedStyles, useTheme } from "./theme";
import {
  Button,
  Card,
  Copy,
  Dialog,
  Icon,
  MenuRow,
  Notice,
  Toggle,
  type IconName,
} from "./ui";
import { ObservationCard } from "../features/ai/ObservationCard";
import { DesktopNavigation } from "./DesktopNavigation";
import { useBrowserLayout } from "./responsive";
import { useWellness } from "../features/wellness/state";
import { useSharedInformation } from "../features/security";

export function AppShell({ children }: PropsWithChildren) {
  const { colors, mode, setMode } = useTheme();
  const shell = shellStyles[mode];
  const nextMode = mode === "light" ? "dark" : "light";
  const modeLabel = nextMode === "dark" ? "Dark" : "Light";
  const { clearShareSession } = useSharedInformation();
  const wellness = useWellness();
  const { desktop, browser } = useBrowserLayout();
  const { identity } = useSecuritySession();
  const signedIn = !!identity;
  const insets = useSafeAreaInsets();
  const ai = useAI(),
    path = usePathname(),
    previous = useRef(path);
  const [review, setReview] = useState(false),
    [scenario, setScenario] = useState<string | null>(null),
    [reset, setReset] = useState(false);
  const focused = path === "/voice",
    accountPage = [
      "/",
      "/create-account",
      "/sign-in",
      "/account-recovery",
    ].includes(path);
  const showNavigation = browser ? signedIn && !accountPage : !accountPage;
  const showReview = __DEV__ && !browser;
  const webResources = browser && path === "/resources";
  const publicPage = webResources || (browser && !signedIn);
  const showPage = publicPage || (ai.ready && !fixtureErrors.length);
  const showBrand = publicPage || ["/", "/home", "/for-you", "/trends", "/chat"].includes(path);
  const { leave, stopVoice } = ai;
  useEffect(() => {
    const before = previous.current;
    previous.current = path;
    if (
      ["/chat", "/voice"].includes(before) &&
      !["/chat", "/voice"].includes(path)
    )
      leave();
    else if (before === "/voice" && path !== "/voice") stopVoice();
  }, [path, leave, stopVoice]);
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(route(1));
  };
  const closeReview = () => {
    setReview(false);
    setScenario(null);
    setReset(false);
  };
  const headerButton = (
    label: string,
    icon: IconName,
    action: () => void,
    accessibilityLabel = label,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={action}
      style={({ pressed }) => [
        shell.headerAction,
        desktop && { flexDirection: "row", gap: 8, paddingHorizontal: 12 },
        pressed && { backgroundColor: colors.sage },
      ]}
    >
      <Icon name={icon} size={19} />
      <Text
        style={[shell.headerLabel, desktop && { fontSize: 12, lineHeight: 20 }]}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={shell.stage}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <SafeAreaView
        style={[
          shell.frame,
          browser && { maxWidth: "100%" },
          desktop && { flexDirection: "row" },
        ]}
        edges={["top", "bottom"]}
      >
        {desktop && showNavigation ? <DesktopNavigation path={path} /> : null}
        <KeyboardAvoidingView
          style={{ flex: 1, minWidth: 0 }}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : Platform.OS === "android"
                ? "height"
                : undefined
          }
          keyboardVerticalOffset={Platform.OS === "web" ? 0 : insets.top}
        >
          <View style={[shell.header, desktop && shell.desktopHeader]}>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              {desktop && showNavigation ? (
                <>
                  {headerButton("Back", "back", back)}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Copy kind="caption">
                      {destinations.find((d) => d.route === path)?.title ??
                        "MindGuard"}
                    </Copy>
                  </View>
                </>
              ) : showBrand ? (
                <>
                  <View style={shell.brand}>
                    <Icon name="leaf" color={colors["brand-mark"]} size={19} />
                  </View>
                  <Text numberOfLines={1} style={shell.brandText}>MindGuard</Text>
                </>
              ) : (
                <>
                  {headerButton("Back", "back", back)}
                  <Copy kind="caption">
                    {focused ? "Talk with Zen" : "MindGuard"}
                  </Copy>
                </>
              )}
            </View>
            {!webResources
              ? headerButton(
                  desktop ? "Support Resources" : "Resources",
                  "book",
                  () => router.push(route(11)),
                  browser ? "Support Resources" : "Resources",
                )
              : null}
            {webResources && !signedIn
              ? headerButton("Sign in", "lock", () => router.push(route(3)))
              : null}
            {showNavigation
              ? headerButton("Settings", "settings", () =>
                  router.push(route(18)),
                )
              : null}
            {showReview
              ? headerButton("Explore", "spark", () => setReview(true))
              : null}
            {headerButton(
              desktop ? `${modeLabel} mode` : modeLabel,
              nextMode === "dark" ? "moon" : "sun",
              () => setMode(nextMode),
              `Switch to ${nextMode} mode`,
            )}
          </View>
          {!publicPage && fixtureErrors.length ? (
            <ScrollView contentContainerStyle={{ padding: 26, gap: 16 }}>
              <Copy kind="heading">
                {screenCopy?.common?.fixtureError ??
                  "Check the demo JSON files."}
              </Copy>
              {fixtureErrors.map((error, i) => (
                <Copy key={i}>{error}</Copy>
              ))}
            </ScrollView>
          ) : !publicPage && !ai.ready ? (
            <View style={{ padding: 26, gap: 16 }}>
              <Copy>
                {ai.readError
                  ? screenCopy.common.storageReadError
                  : screenCopy.common.loading}
              </Copy>
              {ai.readError ? (
                <>
                  <Copy kind="caption">{ai.readError}</Copy>
                  <Button
                    label="Retry opening saved data"
                    onPress={() => void ai.restore()}
                  />
                  {showReview ? <Button
                    label="Reset local demo data"
                    kind="danger"
                    onPress={() => {
                      setReview(true);
                      setReset(true);
                    }}
                  /> : null}
                </>
              ) : null}
            </View>
          ) : null}
              {!publicPage && showPage && ai.writeError ? (
                <View style={{ padding: 12, gap: 8 }}>
                  <Notice error>{screenCopy.common.storageWriteError}</Notice>
                  <Button label="Retry saving" onPress={ai.retryStorage} />
                </View>
              ) : null}
              {/* Keep Expo's navigator mounted while an account cache loads. */}
              <View style={{ flex: 1, minHeight: 0, display: showPage ? "flex" : "none" }}>{children}</View>
              {showPage && !desktop && showNavigation && !focused ? (
                <View style={shell.nav}>
                  {(
                    [
                      [5, "home", "Home"],
                      [21, "spark", "For you"],
                      [9, "trend", "Trends"],
                    ] as const
                  ).map(([id, icon, label]) => (
                    <Pressable
                      key={id}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: path === route(id) }}
                      onPress={() => router.navigate(route(id))}
                      style={shell.navItem}
                    >
                      <View
                        style={[
                          shell.navIcon,
                          path === route(id) && {
                            backgroundColor: colors["nav-active"],
                          },
                        ]}
                      >
                        <Icon name={icon} />
                      </View>
                      <Text style={shell.headerLabel}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
          {review && showReview ? (
            <Dialog
              title={
                reset
                  ? "Reset local demo data?"
                  : scenario
                    ? "Load this demo scenario?"
                    : "Explore MindGuard"
              }
              onClose={closeReview}
            >
              {reset ? (
                <>
                  <Copy>
                    This removes locally saved demo conversations, observations,
                    memories, preferences, the wellness session, and simulated
                    share history. Persistent trusted contacts and JSON files stay intact.
                  </Copy>
                  <Button
                    label="Reset demo data"
                    kind="danger"
                    onPress={() => {
                      void ai.resetLocalData();
                      wellness.reset();
                      clearShareSession();
                      closeReview();
                      router.replace(route(1));
                    }}
                  />
                </>
              ) : scenario ? (
                <>
                  <Copy>
                    Loading replaces current local demo records and preferences
                    with the selected JSON scenario. Temporary and unsaved
                    conversations are cleared.
                  </Copy>
                  <Copy kind="heading">
                    {demoScenarios.find((s) => s.id === scenario)?.name}
                  </Copy>
                  <Button
                    label="Load scenario"
                    kind="primary"
                    onPress={() => {
                      ai.loadScenario(scenario);
                      closeReview();
                      router.push(route(6));
                    }}
                  />
                </>
              ) : (
                <>
                  <Notice>{screenCopy.common.synthetic}</Notice>
                  <Copy kind="heading">Screens and ownership</Copy>
                  {destinations
                    .map((d) => (
                      <MenuRow
                        key={d.id}
                        label={`${String(d.id).padStart(2, "0")} ${d.title}`}
                        description={d.owner}
                        onPress={() => {
                          closeReview();
                          router.push(route(d.id));
                        }}
                      />
                    ))}
                  <Copy kind="heading">JSON scenarios</Copy>
                  {demoScenarios.map((s) => (
                    <MenuRow
                      key={s.id}
                      label={s.name}
                      description={s.description}
                      onPress={() => setScenario(s.id)}
                    />
                  ))}
                  <Copy kind="heading">Demo consent and accessibility</Copy>
                  <Toggle
                    label="Voice processing permission"
                    value={ai.consent.voice}
                    onChange={(v) => ai.setConsent("voice", v)}
                  />
                  <Toggle
                    label="Chat emotion observations"
                    value={ai.consent.chatObservations}
                    onChange={(v) => ai.setConsent("chatObservations", v)}
                  />
                  <Toggle
                    label="Reduced motion"
                    value={ai.model.saved.preferences.reducedMotion}
                    onChange={(v) =>
                      ai.savePreferences({
                        ...ai.model.saved.preferences,
                        reducedMotion: v,
                      })
                    }
                  />
                  <Toggle
                    label="Larger text"
                    value={ai.model.saved.preferences.largerText}
                    onChange={(v) =>
                      ai.savePreferences({
                        ...ai.model.saved.preferences,
                        largerText: v,
                      })
                    }
                  />
                  <Copy kind="heading">Observation inspector</Copy>
                  <Copy kind="caption">
                    Development tools for testing the shared Trends integration.
                  </Copy>
                  {ai.observations
                    .filter((o) => !o.dismissed)
                    .map((o) => (
                      <ObservationCard key={o.id} observation={o} />
                    ))}
                  <Card>
                    <Copy kind="caption">
                      Storage:{" "}
                      {ai.writeError
                        ? "Save failed"
                        : ai.saving
                          ? "Saving…"
                          : "Up to date"}
                    </Copy>
                    <Button
                      label="Reset local demo data"
                      kind="danger"
                      onPress={() => setReset(true)}
                    />
                  </Card>
                </>
              )}
            </Dialog>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
const shellStyles = createThemedStyles(({ colors, styles }) => StyleSheet.create({
  stage: { flex: 1, backgroundColor: colors.stage, alignItems: "center" },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: 414,
    backgroundColor: colors.paper,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 18,
    gap: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  desktopHeader: {
    minHeight: 88,
    paddingHorizontal: 32,
    gap: 18,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  brand: {
    width: 29,
    height: 29,
    backgroundColor: colors.teal,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  brandText: {
    ...styles.body,
    flexShrink: 1,
    fontWeight: "600",
    fontSize: 17,
    letterSpacing: -0.6,
  },
  headerAction: {
    minWidth: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 10,
  },
  headerLabel: { fontSize: 9, lineHeight: 14, color: colors.teal },
  nav: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: colors.paper,
  },
  navItem: {
    minHeight: 50,
    minWidth: 75,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navIcon: { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 16 },
}));
