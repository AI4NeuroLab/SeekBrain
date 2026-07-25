import { Type } from "typebox";

export function seekbrainReportFinalizeSchema() {
  return Type.Object({
    report_markdown: Type.String(),
    title: Type.String(),
    abstract: Type.String(),
    sections: Type.Array(Type.Object({ heading: Type.String(), body: Type.String() })),
    figure_legends: Type.Array(Type.Object({
      figure_id: Type.String(),
      figure_number: Type.Number(),
      title: Type.String(),
      caption: Type.String(),
      panels: Type.Array(Type.Object({ label: Type.String(), description: Type.String() })),
    })),
    key_claims: Type.Array(Type.Object({
      claim: Type.String(),
      evidence_ids: Type.Array(Type.String(), { minItems: 1 }),
      figure_refs: Type.Array(Type.Object({
        figure_id: Type.String(),
        panels: Type.Array(Type.String()),
      })),
      data_source: Type.String(),
      reasoning: Type.String(),
    })),
    limitations: Type.Array(Type.String()),
  });
}

