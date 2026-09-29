import { getServiceAccountAccessToken } from "./hr-source";
import { uploadAgentRuntimeLogText } from "./runtime-logs";

interface AgentLogDrainEnv {
  FIREBASE_PROJECT_ID: string;
  GOOGLE_RUNTIME_SA_JSON?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
  LOGS_FOLDER_ID?: string;
}

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
};

type FirestoreDoc = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

type AgentUploadPart = {
  ref: string;
  uploadId: string;
  index: number;
  count: number;
  filename: string;
  content: string;
  generatedAtMs: number;
  crash: boolean;
};

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const COLLECTION = "relay_agent_log_uploads";

function fieldString(fields: Record<string, FirestoreValue> | undefined, key: string): string {
  return String(fields?.[key]?.stringValue || "");
}

function fieldInt(fields: Record<string, FirestoreValue> | undefined, key: string): number {
  const value = Number(fields?.[key]?.integerValue || 0);
  return Number.isFinite(value) ? value : 0;
}

function fieldBool(fields: Record<string, FirestoreValue> | undefined, key: string): boolean {
  return fields?.[key]?.booleanValue === true;
}

async function listPendingParts(env: AgentLogDrainEnv, accessToken: string): Promise<AgentUploadPart[]> {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: COLLECTION }],
          where: {
            fieldFilter: {
              field: { fieldPath: "status" },
              op: "IN",
              value: {
                arrayValue: {
                  values: [
                    { stringValue: "PENDING" },
                    { stringValue: "WORKER_FALLBACK" },
                  ],
                },
              },
            },
          },
          limit: 1000,
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`AGENT_LOG_FIRESTORE_QUERY_HTTP_${response.status}`);

  const rows = (await response.json()) as Array<{ document?: FirestoreDoc }>;
  const parts: AgentUploadPart[] = [];
  for (const row of rows) {
    const doc = row.document;
    const fields = doc?.fields;
    if (!doc?.name || fieldString(fields, "source") !== "AGENT") continue;
    const uploadId = fieldString(fields, "upload_id");
    const index = fieldInt(fields, "part_index");
    const count = fieldInt(fields, "part_count");
    const filename = fieldString(fields, "filename");
    const content = fieldString(fields, "content");
    if (!uploadId || index < 0 || count < 1 || count > 64 || index >= count || !filename || !content) continue;
    parts.push({
      ref: doc.name,
      uploadId,
      index,
      count,
      filename,
      content,
      generatedAtMs: fieldInt(fields, "generated_at_ms"),
      crash: fieldBool(fields, "crash"),
    });
  }
  return parts;
}

async function deleteRefs(accessToken: string, refs: string[]): Promise<number> {
  let deleted = 0;
  for (let offset = 0; offset < refs.length; offset += 20) {
    const chunk = refs.slice(offset, offset + 20);
    const results = await Promise.all(chunk.map(async (ref) => {
      const response = await fetch(`https://firestore.googleapis.com/v1/${ref}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok && response.status !== 404) throw new Error(`AGENT_LOG_FIRESTORE_DELETE_HTTP_${response.status}`);
      return 1;
    }));
    deleted += results.reduce((sum, value) => sum + value, 0);
  }
  return deleted;
}

export async function drainAgentLogUploads(env: AgentLogDrainEnv): Promise<{
  pending_parts: number;
  complete_uploads: number;
  uploaded: number;
  deleted_parts: number;
}> {
  if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("GOOGLE_RUNTIME_NOT_CONFIGURED");
  const access = await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON, FIRESTORE_SCOPE);
  const parts = await listPendingParts(env, access.accessToken);
  const groups = new Map<string, AgentUploadPart[]>();
  for (const part of parts) {
    const group = groups.get(part.uploadId) || [];
    group.push(part);
    groups.set(part.uploadId, group);
  }

  let complete = 0;
  let uploaded = 0;
  let deletedParts = 0;
  for (const group of [...groups.values()].slice(0, 20)) {
    group.sort((a, b) => a.index - b.index);
    const expected = group[0]?.count || 0;
    if (!expected || group.length !== expected) continue;
    if (group.some((part, index) => part.index !== index || part.count !== expected || part.filename !== group[0].filename)) continue;

    complete += 1;
    const content = group.map((part) => part.content).join("");
    await uploadAgentRuntimeLogText(env, group[0].filename, content);
    uploaded += 1;
    deletedParts += await deleteRefs(access.accessToken, group.map((part) => part.ref));
  }

  return {
    pending_parts: parts.length,
    complete_uploads: complete,
    uploaded,
    deleted_parts: deletedParts,
  };
}
