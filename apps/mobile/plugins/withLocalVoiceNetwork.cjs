const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

// Permit the local Docker relay through adb reverse without allowing remote cleartext traffic.
module.exports = function withLocalVoiceNetwork(config) {
  config = withAndroidManifest(config, (result) => {
    const application = result.modResults.manifest.application?.[0];
    if (!application) throw new Error("Android application configuration is missing.");
    application.$["android:networkSecurityConfig"] = "@xml/mindguard_voice_network";
    return result;
  });
  return withDangerousMod(config, ["android", async (result) => {
    const directory = path.join(result.modRequest.platformProjectRoot, "app/src/main/res/xml");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "mindguard_voice_network.xml"), `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">localhost</domain>
    <domain includeSubdomains="false">127.0.0.1</domain>
  </domain-config>
</network-security-config>
`, "utf8");
    return result;
  }]);
};
