import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const versionPath = resolve(process.cwd(), "../relay-agent/VERSION");
const outputPath = resolve(process.cwd(), "src/generated-agent-version.ts");
const raw = readFileSync(versionPath, "utf8").trim();
if (!/^\d+$/.test(raw)) throw new Error("relay-agent/VERSION must be numeric");
const build = Number(raw);
const tag = `relay-agent-v${build}`;
const source = `// Generated from ../relay-agent/VERSION. Do not edit manually.
export const AGENT_BUILD = ${build};
export const AGENT_RELEASE_TAG = "${tag}";
export const AGENT_RELEASE_URL = "https://github.com/tamnv2/supra-inventory/releases/tag/${tag}";
export const AGENT_DOWNLOAD_URL = "https://github.com/tamnv2/supra-inventory/releases/download/${tag}/Agent.Auto.Confirm.Pick.Pack.exe";
`;
writeFileSync(outputPath, source, "utf8");
console.log(`Generated Agent Web metadata for ${tag}`);
