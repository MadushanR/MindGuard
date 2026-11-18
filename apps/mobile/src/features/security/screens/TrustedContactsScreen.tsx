import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import copy from "../../../../../../packages/fixtures/security/trusted-contacts.json";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Icon, Intro, Notice } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { ResponsiveGrid } from "../../../shared/responsive";
import { createThemedStyles, useTheme } from "../../../shared/theme";
import { useRecipients } from "../RecipientsProvider";
import { recipientRelationshipLabel } from "../recipients";
import { useSecuritySessionOptional } from "../SecuritySessionProvider";

export function TrustedContactsScreen() {
  const account = useSecuritySessionOptional();
  const { mode } = useTheme();
  const local = screenStyles[mode];
  const { recipients, ready, readError, writeError, saving, restoreRecipients } =
    useRecipients();
  return (
    <Page wide>
      <Intro {...copy} />
      {account ? <Notice>{account.identity ? "Contacts are saved to your signed-in account. Adding a contact grants neither sharing access nor alert permission." : "Sign in to open your account's contacts. Existing synthetic device contacts stay separate."}</Notice> : null}
      {account && !account.identity ? <Button label="Sign in" onPress={() => router.push(route(3))} /> : null}
      <Button
        label="Add recipient"
        kind="primary"
        icon="user"
        disabled={!!account && !account.identity}
        onPress={() => router.push({
          pathname: route(20) as "/add-recipient",
          params: { origin: "trusted-contacts" },
        })}
      />
      {readError ? (
        <Card>
          <Notice error>{copy.readError}</Notice>
          <Button
            label="Retry opening contacts"
            onPress={() => void restoreRecipients()}
          />
        </Card>
      ) : !ready ? (
        <Notice>{copy.loading}</Notice>
      ) : recipients.length ? (
        <ResponsiveGrid>
          {recipients.map((recipient) => (
            <Card key={recipient.id}>
              <View style={local.person}>
                <Icon name="user" size={26} />
              </View>
              <Copy kind="heading">{recipient.name}</Copy>
              <Copy kind="muted">
                {recipientRelationshipLabel(recipient.relationship)}
              </Copy>
            </Card>
          ))}
        </ResponsiveGrid>
      ) : (
        <Card>
          <View style={local.empty}>
            <View style={local.person}>
              <Icon name="user" size={32} />
            </View>
            <Copy kind="heading" center>
              {copy.emptyTitle}
            </Copy>
            <Copy kind="muted" center>
              {copy.emptyDescription}
            </Copy>
          </View>
        </Card>
      )}
      {saving ? <Notice>{copy.saving}</Notice> : null}
      {writeError ? <Notice error>{copy.writeError}</Notice> : null}
      <Button
        label="Manage sharing permissions"
        kind="text"
        onPress={() => router.push(route(14))}
      />
    </Page>
  );
}
const screenStyles = createThemedStyles(({ colors }) => StyleSheet.create({
  empty: { alignItems: "center", gap: 16, paddingVertical: 16 },
  person: {
    alignSelf: "center",
    padding: 18,
    borderRadius: 50,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
  },
}));
