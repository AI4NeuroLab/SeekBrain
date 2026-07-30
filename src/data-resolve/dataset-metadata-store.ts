import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

type Json = Record<string, any>;

export interface DatasetIdentity {
  datasetId: string;
  canonicalRoot: string;
  cacheDir: string;
  metadataPath: string;
  manifestPath: string;
  workDir: string;
  device: number;
  inode: number;
}

export interface CachedDatasetMetadata {
  identity: DatasetIdentity;
  metadata: Json;
  manifest: Json;
}

function safeSlug(value: string) {
  const slug = value.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 48) || "dataset";
}

async function atomicJson(path: string, value: unknown) {
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, path);
}

export class DatasetMetadataStore {
  static readonly SCHEMA_VERSION = 7;
  readonly root: string;

  constructor(root = process.env.SEEKBRAIN_DATASET_CACHE_ROOT || join(homedir(), ".seekbrain", "datasets")) {
    const expanded = root === "~" ? homedir() : root.startsWith("~/") ? join(homedir(), root.slice(2)) : root;
    this.root = resolve(expanded);
  }

  async identify(dataDir: string): Promise<DatasetIdentity> {
    const requested = resolve(dataDir);
    const canonicalRoot = await realpath(requested).catch(() => requested);
    const info = await stat(canonicalRoot).catch(() => undefined);
    if (!info?.isDirectory()) throw new Error(`data_dir is not a directory: ${dataDir}`);
    const digest = createHash("sha256").update(canonicalRoot).digest("hex").slice(0, 16);
    const datasetId = `${safeSlug(basename(canonicalRoot))}-${digest}`;
    const cacheDir = join(this.root, datasetId);
    return {
      datasetId,
      canonicalRoot,
      cacheDir,
      metadataPath: join(cacheDir, "metadata.json"),
      manifestPath: join(cacheDir, "manifest.json"),
      workDir: join(cacheDir, "work"),
      device: Number(info.dev),
      inode: Number(info.ino),
    };
  }

  async load(identity: DatasetIdentity): Promise<CachedDatasetMetadata | undefined> {
    if (!existsSync(identity.metadataPath) || !existsSync(identity.manifestPath)) return undefined;
    try {
      const metadata = JSON.parse(await readFile(identity.metadataPath, "utf8"));
      const manifest = JSON.parse(await readFile(identity.manifestPath, "utf8"));
      const sameRoot = resolve(String(metadata.root_dir || "")) === identity.canonicalRoot
        && resolve(String(manifest.canonical_root || "")) === identity.canonicalRoot;
      const sameIdentity = Number(manifest.device) === identity.device && Number(manifest.inode) === identity.inode;
      if (!sameRoot || !sameIdentity || Number(manifest.schema_version) !== DatasetMetadataStore.SCHEMA_VERSION) return undefined;
      return { identity, metadata, manifest };
    } catch {
      return undefined;
    }
  }

  async prepare(identity: DatasetIdentity) {
    await mkdir(identity.workDir, { recursive: true });
  }

  async save(identity: DatasetIdentity, metadata: Json, provenance: Json = {}): Promise<CachedDatasetMetadata> {
    const rootDir = resolve(String(metadata.root_dir || ""));
    if (rootDir !== identity.canonicalRoot) {
      throw new Error(`resolved metadata root_dir must equal DATA_DIR (${identity.canonicalRoot})`);
    }
    await this.prepare(identity);
    const now = new Date().toISOString();
    const prior = await this.load(identity);
    const manifest = {
      schema_version: DatasetMetadataStore.SCHEMA_VERSION,
      dataset_id: identity.datasetId,
      canonical_root: identity.canonicalRoot,
      device: identity.device,
      inode: identity.inode,
      created_at: prior?.manifest.created_at || now,
      updated_at: now,
      source: "seekbrain_data_resolve",
      ...provenance,
    };
    await atomicJson(identity.metadataPath, metadata);
    await atomicJson(identity.manifestPath, manifest);
    return { identity, metadata, manifest };
  }
}
