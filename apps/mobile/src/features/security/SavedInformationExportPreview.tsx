import { useState } from "react";
import { router } from "expo-router";
import copy from "../../../../../packages/fixtures/security/saved-information.json";
import { Page } from "../../shared/Page";
import { Button, Card, Copy, Dialog, MenuRow, Notice } from "../../shared/ui";
import { route } from "../../shared/navigation";
import { useSavedInformation } from "./SavedInformationProvider";
import { parseSavedCategories, selectedSavedInformation } from "./savedInformation";

/** Screen 13's export-only entry for Screen 17; ordinary wearable sharing is unchanged. */
export function SavedInformationExportPreview({ categories }: { categories: unknown }) {
  const { records } = useSavedInformation();
  const [reviewing, setReviewing] = useState(false);
  const [done, setDone] = useState(false);
  const ids = parseSavedCategories(categories);
  const selected = selectedSavedInformation(records, ids);
  const valid = selected.length > 0;
  const content = selected.map((record) => <Card key={record.id}>
    <Copy kind="heading">{record.label}</Copy>
    <Copy kind="caption">{record.weekLabel}</Copy>
    {record.content.map((line, index) => <Copy key={index}>{line}</Copy>)}
  </Card>);
  return (
    <Page>
      <Copy kind="title">Export and share</Copy>
      <Copy kind="muted">{copy.exportDescription}</Copy>
      <Notice>{copy.exportNotice}</Notice>
      <Copy kind="heading">Demo export preview (no file download)</Copy>
      {valid ? content : <Notice error>{copy.invalidSelection}</Notice>}
      <Button label="Preview selected content" kind="primary" disabled={!valid} onPress={() => {
        if (!valid) return;
        setDone(false);
        setReviewing(true);
      }} />
      {done ? <Notice>{copy.exportDone}</Notice> : null}
      <MenuRow label="Back to saved information" onPress={() => router.push(route(17))} />
      {reviewing ? <Dialog title="Review exact demo content" onClose={() => setReviewing(false)}>
        <Copy kind="heading">Demo export preview (no file download)</Copy>
        {valid ? content : <Notice error>{copy.invalidSelection}</Notice>}
        <Notice>{copy.exportNotice}</Notice>
        <Button label="Confirm simulated action" kind="primary" disabled={!valid} onPress={() => {
          if (!valid) return;
          setReviewing(false);
          setDone(true);
        }} />
      </Dialog> : null}
    </Page>
  );
}
