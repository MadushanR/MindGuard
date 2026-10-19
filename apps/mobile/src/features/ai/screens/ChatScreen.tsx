import { useRef, useState, type ComponentRef } from "react";
import { router } from "expo-router";
import { ScrollView, TextInput, View } from "react-native";
import { chatContent, screenCopy } from "@mindguard/fixtures";
import { useAI } from "../AIProvider";
import {
  Button,
  Card,
  Copy,
  Dialog,
  Field,
  Icon,
  Notice,
  ZenOrb,
} from "../../../shared/ui";
import { colors, styles } from "../../../shared/theme";
import { route } from "../../../shared/navigation";
export function ChatScreen() {
  const ai = useAI(),
    [draft, setDraft] = useState(""),
    [remembering, setRemembering] = useState(false),
    [detail, setDetail] = useState("");
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null),
    copy = screenCopy.chat,
    active = ai.model.active;
  const send = () => {
    if (!draft.trim() || ai.model.chatStatus !== "idle") return;
    ai.send(draft);
    setDraft("");
  };
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 26, paddingBottom: 12, gap: 6 }}>
        <View style={styles.spread}>
          <View
            style={[styles.row, { flex: 1, flexWrap: "nowrap", minWidth: 0 }]}
          >
            <ZenOrb compact />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Copy kind="heading">{copy.title}</Copy>
              <Copy kind="caption">{copy.subtitle}</Copy>
            </View>
          </View>
          <Button
            label="Voice"
            icon="mic"
            kind="text"
            onPress={() => router.push(route(7))}
          />
        </View>
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 26,
          paddingBottom: 20,
          gap: 17,
        }}
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({
            animated: false,
          })
        }
      >
        <View style={styles.row}>
          <Button
            label="History"
            kind="text"
            onPress={() => router.push(route(22))}
          />
          <Button
            label="New chat"
            kind="text"
            onPress={() => {
              ai.newConversation();
              setDraft("");
            }}
          />
          <Button
            label="Temporary chat"
            kind="text"
            onPress={() => {
              ai.newConversation(true);
              setDraft("");
            }}
          />
        </View>
        <Copy kind="caption">
          {active?.temporary
            ? "Temporary · clears when you leave · no observations or memories"
            : active?.saving
              ? "History on · this conversation is saved locally"
              : "History off · this conversation is not saved"}
        </Copy>
        {!active?.temporary ? (
          <Button
            label="Remember a detail"
            icon="leaf"
            kind="text"
            onPress={() => {
              if (!active) ai.newConversation();
              setRemembering(true);
            }}
          />
        ) : null}
        <View style={{ gap: 6 }}>
          <Copy kind="eyebrow">ZEN</Copy>
          <Card>
            <Copy>{chatContent.introduction}</Copy>
          </Card>
        </View>
        {(active?.messages ?? []).map((message) => (
          <View
            key={message.id}
            style={{
              gap: 6,
              alignSelf: message.role === "user" ? "flex-end" : "stretch",
              maxWidth: "95%",
            }}
          >
            <Copy kind="eyebrow">
              {message.role === "user" ? "YOU" : "ZEN"}
              {message.mode === "voice" ? " · SIMULATED VOICE" : ""}
            </Copy>
            <View
              style={[
                styles.card,
                message.role === "user" && {
                  backgroundColor: colors.sage,
                  borderBottomRightRadius: 5,
                },
              ]}
            >
              <Copy>{message.text}</Copy>
            </View>
          </View>
        ))}
        {ai.model.chatStatus === "processing" ? (
          <View accessibilityLiveRegion="polite">
            <Copy kind="muted">{copy.processing}</Copy>
          </View>
        ) : null}
        {ai.model.chatStatus === "error" ? (
          <>
            <Notice error>{copy.error}</Notice>
            <Button label="Retry reply" onPress={ai.retry} />
          </>
        ) : null}
        {!active?.messages.length && ai.model.chatStatus === "idle" ? (
          <View style={styles.stack}>
            <Copy kind="eyebrow">{copy.empty}</Copy>
            {chatContent.suggestedPrompts.map((prompt) => (
              <Button
                key={prompt}
                label={prompt}
                icon="moon"
                onPress={() => setDraft(prompt)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 19,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderColor: colors.line,
          gap: 8,
        }}
      >
        <View style={styles.row}>
          <Icon name="lock" size={14} />
          <Copy kind="caption">{screenCopy.common.synthetic}</Copy>
        </View>
        <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-end" }}>
          <TextInput
            accessibilityLabel="Message Zen"
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder={copy.placeholder}
            placeholderTextColor={colors.muted}
            style={[styles.field, { flex: 1, minWidth: 0, maxHeight: 120 }]}
          />
          <Button
            label="Send"
            icon="send"
            kind="primary"
            onPress={send}
            disabled={!draft.trim() || ai.model.chatStatus !== "idle"}
          />
        </View>
      </View>
      {remembering ? (
        <Dialog
          title="What should Zen remember?"
          onClose={() => setRemembering(false)}
        >
          <Copy>
            Write only the detail you explicitly want to keep on this device.
          </Copy>
          <Field
            label="Detail"
            multiline
            maxLength={300}
            value={detail}
            onChangeText={setDetail}
          />
          <Button
            label="Remember this detail"
            kind="primary"
            disabled={!detail.trim()}
            onPress={() => {
              ai.remember(detail);
              setDetail("");
              setRemembering(false);
            }}
          />
        </Dialog>
      ) : null}
    </View>
  );
}
