const names = [
  "chat",
  "voice",
  "recommendations",
  "conversations",
  "emotions",
  "remembered-details",
  "scenarios",
  "screen-copy",
  "wellness/wearable",
  "wellness/resources",
];
const schemas = {
  chat: require("./schemas/chat.schema.json"),
  voice: require("./schemas/voice.schema.json"),
  recommendations: require("./schemas/recommendations.schema.json"),
  conversations: require("./schemas/conversations.schema.json"),
  emotions: require("./schemas/emotions.schema.json"),
  "remembered-details": require("./schemas/remembered-details.schema.json"),
  scenarios: require("./schemas/scenarios.schema.json"),
  "screen-copy": require("./schemas/screen-copy.schema.json"),
  "wellness/wearable": require("./schemas/wellness-wearable.schema.json"),
  "wellness/resources": require("./schemas/wellness-resources.schema.json"),
};
function check(value, schema, root, field, errors) {
  if (schema.$ref)
    return check(
      value,
      root.$defs[schema.$ref.split("/").pop()],
      root,
      field,
      errors,
    );
  if (schema.enum && !schema.enum.includes(value))
    errors.push(`${field}: expected one of ${JSON.stringify(schema.enum)}`);
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${field}: expected an object`);
      return;
    }
    for (const key of schema.required || [])
      if (!(key in value)) errors.push(`${field}.${key}: required`);
    for (const key of Object.keys(value)) {
      if (!schema.properties[key])
        errors.push(`${field}.${key}: unknown field`);
      else
        check(
          value[key],
          schema.properties[key],
          root,
          `${field}.${key}`,
          errors,
        );
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${field}: expected an array`);
      return;
    }
    if (value.length < (schema.minItems || 0))
      errors.push(`${field}: add at least ${schema.minItems} item(s)`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      errors.push(`${field}: use at most ${schema.maxItems} item(s)`);
    value.forEach((item, i) =>
      check(item, schema.items, root, `${field}[${i}]`, errors),
    );
  } else if (schema.type) {
    if (typeof value !== schema.type) {
      errors.push(`${field}: expected ${schema.type}`);
      return;
    }
    if (schema.type === "string" && value.length < (schema.minLength || 0))
      errors.push(`${field}: cannot be empty`);
    if (
      schema.type === "number" &&
      (!Number.isFinite(value) ||
        value < (schema.minimum ?? -Infinity) ||
        value > (schema.maximum ?? Infinity))
    )
      errors.push(`${field}: number outside allowed range`);
  }
}
function validateBundle(bundle) {
  const errors = [];
  for (const name of names)
    check(bundle[name], schemas[name], schemas[name], `${name}.json`, errors);
  if (errors.length) return errors;
  const resourceIds = new Set();
  for (const resource of bundle["wellness/resources"].items) {
    if (resourceIds.has(resource.id)) errors.push(`wellness/resources.json: duplicate ID '${resource.id}'`);
    resourceIds.add(resource.id);
    for (const action of resource.actions) {
      if (!/^(https:\/\/[^\s]+|tel:\+?[\d-]+(?:\?[^\s]+)?|sms:\+?[\d-]+(?:\?[^\s]+)?)$/.test(action.url))
        errors.push(`wellness/resources.json: unsupported URL '${action.url}'`);
    }
  }
  if (
    bundle.scenarios.defaults.preferences.saveHistory &&
    bundle.scenarios.defaults.preferences.retentionDays === null
  )
    errors.push(
      "scenarios.json.defaults.preferences.retentionDays: choose a retention period when history is enabled",
    );
  if (
    bundle.scenarios.defaults.consent.tone &&
    !bundle.scenarios.defaults.consent.voice
  )
    errors.push(
      "scenarios.json.defaults.consent.tone: requires separate voice consent",
    );
  const groups = {
    chat: bundle.chat.scripts,
    voice: bundle.voice.scripts,
    recommendations: bundle.recommendations.cards,
    conversations: bundle.conversations.records,
    emotions: bundle.emotions.records,
    memories: bundle["remembered-details"].records,
    scenarios: bundle.scenarios.scenarios,
  };
  for (const [name, records] of Object.entries(groups)) {
    const ids = new Set();
    records.forEach((r, i) => {
      if (ids.has(r.id))
        errors.push(`${name}.json[${i}].id: duplicate ID '${r.id}'`);
      ids.add(r.id);
    });
  }
  const exists = (group, id, field) => {
    if (!groups[group].some((r) => r.id === id))
      errors.push(`${field}: unknown ${group} ID '${id}'`);
  };
  exists(
    "scenarios",
    bundle.scenarios.defaultScenarioId,
    "scenarios.json.defaultScenarioId",
  );
  for (const [i, s] of groups.scenarios.entries()) {
    const field = `scenarios.json.scenarios[${i}]`;
    exists("chat", s.chatScriptId, `${field}.chatScriptId`);
    exists("voice", s.voiceScriptId, `${field}.voiceScriptId`);
    for (const [key, group] of [
      ["conversationIds", "conversations"],
      ["observationIds", "emotions"],
      ["memoryIds", "memories"],
    ]) {
      if (new Set(s[key]).size !== s[key].length)
        errors.push(`${field}.${key}: duplicate reference`);
      s[key].forEach((id) => exists(group, id, `${field}.${key}`));
    }
    if (s.preferences.saveHistory && s.preferences.retentionDays === null)
      errors.push(
        `${field}.preferences.retentionDays: choose a retention period when history is enabled`,
      );
    if (s.consent.tone && !s.consent.voice)
      errors.push(`${field}.consent.tone: requires voice consent`);
    for (const [key, group] of [
      ["observationIds", "emotions"],
      ["memoryIds", "memories"],
    ])
      for (const id of s[key]) {
        const record = groups[group].find((r) => r.id === id);
        if (
          record?.conversationId &&
          !s.conversationIds.includes(record.conversationId)
        )
          errors.push(
            `${field}.${key}: '${id}' links to a conversation not loaded by this scenario`,
          );
      }
  }
  for (const [group, filename] of [
    ["emotions", "emotions"],
    ["memories", "remembered-details"],
  ])
    groups[group].forEach((r, i) => {
      if (r.conversationId)
        exists(
          "conversations",
          r.conversationId,
          `${filename}.json.records[${i}].conversationId`,
        );
      if (
        group === "emotions" &&
        (r.status === "Corrected") !== !!r.correctedLabel
      )
        errors.push(
          `${filename}.json.records[${i}].correctedLabel: must be present exactly when status is Corrected`,
        );
    });
  for (const [i, conversation] of groups.conversations.entries()) {
    if (
      new Set(conversation.messages.map((m) => m.id)).size !==
      conversation.messages.length
    )
      errors.push(
        `conversations.json.records[${i}].messages: duplicate message ID`,
      );
  }
  for (const [i, script] of groups.voice.entries())
    for (const [j, step] of script.steps.entries()) {
      if (
        ["listening", "processing", "speaking"].includes(step.state) &&
        step.durationMs === 0
      )
        errors.push(
          `voice.json.scripts[${i}].steps[${j}].durationMs: active states require a positive duration`,
        );
      if ((step.transcript || step.observation) && step.state !== "speaking")
        errors.push(
          `voice.json.scripts[${i}].steps[${j}]: transcript and observation belong on a speaking step`,
        );
      const previous = script.steps[j - 1];
      const transitions = {
        listening: ["processing", "reconnecting", "error", "stopped"],
        processing: ["speaking", "reconnecting", "error", "stopped"],
        speaking: ["listening", "reconnecting", "error", "stopped"],
        reconnecting: ["listening"],
        error: ["listening"],
        stopped: ["listening"],
      };
      if (
        (!previous && step.state !== "listening") ||
        (previous && !transitions[previous.state].includes(step.state)) ||
        (j === script.steps.length - 1 &&
          !["speaking", "stopped", "error"].includes(step.state))
      )
        errors.push(
          `voice.json.scripts[${i}].steps[${j}].state: invalid voice transition or terminal state`,
        );
    }
  return errors;
}
module.exports = { validateBundle };
