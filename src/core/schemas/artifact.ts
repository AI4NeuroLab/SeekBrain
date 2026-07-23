import { Type, type Static } from "typebox";

export const ArtifactKindSchema = Type.Union([
  Type.Literal("code"),
  Type.Literal("figure"),
  Type.Literal("statistics"),
  Type.Literal("table"),
  Type.Literal("data"),
  Type.Literal("markdown"),
  Type.Literal("json"),
  Type.Literal("report"),
  Type.Literal("log"),
  Type.Literal("other"),
]);

export const ArtifactSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  path: Type.String({ minLength: 1 }),
  kind: ArtifactKindSchema,
  produced_by: Type.Optional(Type.String()),
  role: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  optional: Type.Optional(Type.Boolean()),
  content: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
}, { additionalProperties: true });

export type Artifact = Static<typeof ArtifactSchema>;
export type ArtifactKind = Static<typeof ArtifactKindSchema>;
