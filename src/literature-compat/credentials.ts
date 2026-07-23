import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

type Json = Record<string, any>;

export interface LiteratureCredentialInput {
  provider: "semantic_scholar" | "pubmed";
  credentialRef?: string;
  credentialStore?: string;
}

export interface ResolvedLiteratureCredential {
  apiKey?: string;
  identity: string;
}

const ENV_NAMES = {
  semantic_scholar: "SEMANTIC_SCHOLAR_API_KEY",
  pubmed: "NCBI_API_KEY",
} as const;

async function credentialFile(path: string): Promise<Json> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error(`Unable to read literature credential store: ${String(error)}`, { cause: error });
  }
}

export async function resolveLiteratureCredential(
  input: LiteratureCredentialInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResolvedLiteratureCredential> {
  const providerEnv = ENV_NAMES[input.provider];
  const explicit = String(env[providerEnv] || "").trim();
  if (explicit) return { apiKey: explicit, identity: `${input.provider}:env:${providerEnv}` };

  const reference = String(input.credentialRef || "").trim();
  if (reference.startsWith("env:")) {
    const envName = reference.slice(4).trim();
    const apiKey = String(env[envName] || "").trim();
    return { ...(apiKey ? { apiKey } : {}), identity: `${input.provider}:env:${envName || "missing"}` };
  }

  if (reference) {
    const path = input.credentialStore || env.SEEKBRAIN_LITERATURE_CREDENTIALS
      || join(homedir(), ".config", "seekbrain", "literature-credentials.json");
    const stored = await credentialFile(path);
    const apiKey = String(stored.credentials?.[reference]?.api_key || "").trim();
    return { ...(apiKey ? { apiKey } : {}), identity: `${input.provider}:store:${reference}` };
  }

  return { identity: `${input.provider}:anonymous` };
}
