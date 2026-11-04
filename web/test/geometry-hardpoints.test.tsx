import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseCarModel } from "@setuplab/data";
import rawModel from "../../assets/models/reference-touring-car.json";
import { commitHardpointText } from "../src/editor/hardpointCommit.js";
import { GeometryPage } from "../src/pages/GeometryPage.js";
import { routeFromHash } from "../src/route.js";
import {
  createSetupStore,
  serialiseDocument,
  type SetupStore,
  type StorageLike,
} from "../src/state/setupStore.js";

function reference() {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function makeStore(): SetupStore {
  return createSetupStore({ baseline: reference(), storage: memoryStorage() });
}

function renderGeometry(store: SetupStore): string {
  return renderToStaticMarkup(createElement(GeometryPage, { store }));
}

function columnHtml(html: string, axle: "front" | "rear"): string {
  const start = html.indexOf(`data-axle="${axle}"`);
  if (start < 0) return "";
  if (axle === "front") {
    const end = html.indexOf('data-axle="rear"');
    return end < 0 ? html.slice(start) : html.slice(start, end);
  }
  return html.slice(start);
}

function inputs(html: string): readonly string[] {
  return [...html.matchAll(/<input\b[^>]*>/g)].map((match) => match[0]);
}

function inputFor(html: string, label: string): string {
  return (
    inputs(html).find((tag) => tag.includes(`aria-label="${label}"`)) ?? ""
  );
}

function valueText(html: string, name: string): string {
  const at = html.indexOf(`data-accessible-name="${name}"`);
  if (at < 0) return "";
  return (
    /class="value-number[^"]*"[^>]*>([^<]*)</.exec(html.slice(at))?.[1] ?? ""
  );
}

function rearSnapshot(model: ReturnType<typeof reference>): string {
  return JSON.stringify({
    LR: model.corners.LR,
    RR: model.corners.RR,
    rear: model.axles.rear,
  });
}

describe("Geometry hardpoint settings", () => {
  it("restores every inner and outboard row for both axles", () => {
    const html = renderGeometry(makeStore());

    for (const axle of ["front", "rear"] as const) {
      const column = columnHtml(html, axle);
      expect(column).toContain('data-block="inner-pivots"');
      expect(column).toContain('data-block="outboard-points"');
      expect(column).toContain('data-block="hub"');
      expect(column.indexOf('data-block="inner-pivots"')).toBeLessThan(
        column.indexOf('data-block="outboard-points"'),
      );
      expect(column.indexOf('data-block="outboard-points"')).toBeLessThan(
        column.indexOf('data-block="hub"'),
      );

      for (const label of [
        "Lower-arm inner a",
        "Lower-arm inner b",
        "Upper link inner",
        "Tie-rod inner",
        "Upper damper eye",
        "Lower ball stud",
        "Upper ball stud",
        "Tie-rod outer",
        "Lower damper eye",
      ]) {
        expect(column).toContain(label);
      }

      expect(inputs(column)).toHaveLength(19);
    }

    expect(inputs(html)).toHaveLength(38);
    expect(inputs(html).some((tag) => /wheel centre|hub/i.test(tag))).toBe(
      false,
    );
  });

  it("keeps the hub read-only and states its derivation", () => {
    const html = renderGeometry(makeStore());

    for (const axle of ["front", "rear"] as const) {
      const column = columnHtml(html, axle);
      const hub = column.slice(column.indexOf('data-block="hub"'));
      expect(hub).toContain("Wheel centre / hub");
      expect(hub).toMatch(/read-only/i);
      expect(hub).toMatch(/ride height/i);
      expect(hub).toMatch(/plate thickness/i);
      expect(hub).toMatch(/wheel diameter/i);
      expect(hub).toContain("data-value");
      expect(hub).not.toContain("<input");
    }

    const front = columnHtml(html, "front");
    expect(front).toContain("86.0");
    expect(front).toContain("25.0");
  });

  it("shows the outboard shim direction and the composed absolute point", () => {
    const store = makeStore();
    const html = renderGeometry(store);
    const front = columnHtml(html, "front");

    expect(inputFor(front, "Front Upper ball stud shim y in mm")).not.toBe("");
    expect(inputFor(front, "Front Upper ball stud shim z in mm")).not.toBe("");
    expect(front).toMatch(/outboard/i);
    expect(front).toMatch(/inboard/i);
    expect(front).toMatch(/composed/i);
    expect(front).toContain("Front Upper ball stud composed y");
  });

  it("moves camber when the upper ball stud gets a +0.5 mm shim, and says which way", () => {
    const store = makeStore();
    const baseline = store.getSnapshot().baseline;
    const before = columnHtml(renderGeometry(store), "front");
    const rearBefore = rearSnapshot(store.getSnapshot().model);
    const baseZ = baseline.corners.LF?.points.uca_out?.value[2];
    if (baseZ === undefined) throw new Error("missing upper ball stud");

    const target = store.getSnapshot().model.corners.LF?.points.uca_out;
    if (target === undefined) throw new Error("missing upper ball stud");
    expect(store.commitHardpoint("LF", "uca_out", 2, baseZ + 0.5)).toBeNull();

    const afterModel = store.getSnapshot().model;
    expect(afterModel.corners.LF?.points.uca_out?.value[2]).toBeCloseTo(
      baseZ + 0.5,
      12,
    );
    expect(rearSnapshot(afterModel)).toBe(rearBefore);

    const after = columnHtml(renderGeometry(store), "front");
    expect(after).not.toBe(before);
    expect(after).toMatch(/edited this session/);
    expect(after).toMatch(/\+ is up/i);
    expect(after).toMatch(/more negative/i);

    const beforeCamber = Number(valueText(before, "Front camber gain"));
    const afterCamber = Number(valueText(after, "Front camber gain"));
    expect(beforeCamber).toBeCloseTo(-0.11, 2);
    expect(afterCamber).toBeLessThan(beforeCamber);
  });

  it("edits an inner pivot on one axle without touching the other", () => {
    const store = makeStore();
    const rearBefore = rearSnapshot(store.getSnapshot().model);

    expect(store.commitHardpoint("LF", "uca_in", 2, 39)).toBeNull();

    const model = store.getSnapshot().model;
    expect(model.corners.LF?.points.uca_in?.value[2]).toBe(39);
    expect(rearSnapshot(model)).toBe(rearBefore);

    const html = renderGeometry(store);
    expect(
      inputFor(columnHtml(html, "front"), "Front Upper link inner z in mm"),
    ).toContain('value="39"');
    expect(columnHtml(html, "front")).toMatch(/edited this session/);
  });

  it("uses anti-dive copy under Front and anti-squat copy under Rear", () => {
    const html = renderGeometry(makeStore());
    const front = columnHtml(html, "front");
    const rear = columnHtml(html, "rear");

    expect(front).toMatch(/anti-dive/i);
    expect(front).not.toMatch(/anti-squat/i);
    expect(rear).toMatch(/anti-squat/i);
    expect(rear).not.toMatch(/anti-dive/i);

    expect(front).toContain("Shim · anti-dive");
    expect(rear).toContain("Shim · anti-squat");
  });

  it("keeps a hardpoint edit through Geometry -> Glossary -> Back (B1)", () => {
    const store = makeStore();
    const baseline = store.getSnapshot().baseline;
    const baseZ = baseline.corners.LF?.points.uca_out?.value[2];
    if (baseZ === undefined) throw new Error("missing upper ball stud");

    const input = new EventTarget();
    let refusal: string | null = "not committed";
    input.addEventListener("keydown", (event) => {
      const key = (event as Event & { readonly key?: string }).key;
      if (key !== "Enter") return;
      refusal = commitHardpointText(
        store,
        { cornerKey: "LF", pointKey: "uca_out", axis: 2, baseMm: baseZ, shim: true },
        "0.5",
      );
    });
    const enter = new Event("keydown");
    Object.defineProperty(enter, "key", { value: "Enter" });
    input.dispatchEvent(enter);

    expect(refusal).toBeNull();
    const edited = serialiseDocument(store.getSnapshot().model);

    expect(routeFromHash("#glossary").view).toBe("glossary");
    const back = routeFromHash("#geometry");
    expect(back.view).toBe("page");

    expect(serialiseDocument(store.getSnapshot().model)).toBe(edited);
    expect(
      store.getSnapshot().model.corners.LF?.points.uca_out?.value[2],
    ).toBeCloseTo(baseZ + 0.5, 12);

    const html = renderGeometry(store);
    expect(
      inputFor(columnHtml(html, "front"), "Front Upper ball stud shim z in mm"),
    ).toContain('value="0.5"');
  });
});
