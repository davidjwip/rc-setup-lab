import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildFrontViewInput,
  chassisDatum,
  parseCarModel,
  updateChassisValue,
  updateCornerPointMm,
  type CarModelDocument,
} from '@setuplab/data';
import { buildFrontViewScene, solveFrontView } from '@setuplab/physics';
import rawModel from '../../assets/models/reference-touring-car.json';
import { AnalysisView } from '../src/app.js';
import { ChassisEditor } from '../src/editor/ChassisEditor.js';
import { FrontViewScene } from '../src/scene/FrontViewScene.js';
import { buildSceneLabels } from '../src/view/endSummary.js';

function referenceModel(): CarModelDocument {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function update(
  model: CarModelDocument,
  field: 'ride_height' | 'thickness',
  valueMm: number,
): CarModelDocument {
  const edited = updateChassisValue(model, field, valueMm);
  if (!edited.ok) throw new Error(JSON.stringify(edited.errors));
  return edited.value;
}

function moveWheelCentre(model: CarModelDocument, zMm: number): CarModelDocument {
  const edited = updateCornerPointMm(model, 'LF', 'wc', 2, zMm);
  if (!edited.ok) throw new Error(JSON.stringify(edited.errors));
  return edited.value;
}

function inputTag(html: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp(`<input[^>]*aria-label="${escaped}"[^>]*>`))?.[0] ?? '';
}

function renderChassis(model: CarModelDocument, edited = false): string {
  return renderToStaticMarkup(
    createElement(ChassisEditor, {
      model,
      edited,
      onCommit: () => null,
    }),
  );
}

function renderFrontScene(model: CarModelDocument, groundLabel: string): string {
  const input = buildFrontViewInput(model, 'LF');
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  const result = solveFrontView(input.value);
  const scene = buildFrontViewScene(input.value, result);
  const labels = buildSceneLabels(model, 'front', scene, result, false);
  return renderToStaticMarkup(
    createElement(FrontViewScene, { scene, labels, groundLabel }),
  );
}

function groundLineY(html: string): string {
  const line = html.match(/<line[^>]*class="scene-ground"[^>]*>/)?.[0] ?? '';
  return line.match(/y1="([^"]+)"/)?.[1] ?? '';
}

function contactPatchPath(html: string): string {
  return html.match(/data-field="contact_patch"[\s\S]*?d="([^"]+)"/)?.[1] ?? '';
}

describe('chassis panel', () => {
  it('sits above the hardpoint editor with labelled, editable ride height and plate thickness', () => {
    const html = renderToStaticMarkup(createElement(AnalysisView));

    const chassisHeading = html.indexOf('>Chassis</h2>');
    const hardpointHeading = html.indexOf('Hardpoints · front-left');
    expect(chassisHeading).toBeGreaterThan(-1);
    expect(hardpointHeading).toBeGreaterThan(-1);
    expect(chassisHeading).toBeLessThan(hardpointHeading);

    const rideHeight = inputTag(html, 'Ride height in mm');
    const thickness = inputTag(html, 'Plate thickness in mm');
    expect(rideHeight).toContain('value="5"');
    expect(thickness).toContain('value="2"');
    expect(rideHeight).not.toContain('disabled');
    expect(thickness).not.toContain('disabled');
    expect(html).toContain('field-unit">mm');
  });

  it('shows both axles inferred wheel diameters with an inferred badge and no diameter input', () => {
    const html = renderChassis(referenceModel());

    expect(html).toContain('Front wheel diameter');
    expect(html).toContain('Rear wheel diameter');
    expect(html).toContain('inferred');
    expect(html).toContain('64.0 mm');
    expect(html).toContain('Plate top above ground');
    expect(html).toContain('Ground plane z (chassis frame)');
    expect(html).not.toMatch(/<input[^>]*(diameter|wheel diameter)/i);
  });

  it('shows the quiet consistency note above 0.5 mm and hides it below', () => {
    const base = referenceModel();
    expect(renderChassis(base)).not.toContain(
      'check the wheel centre height or the ride height',
    );

    const above = renderChassis(moveWheelCentre(base, 26.0));
    expect(above).toContain('66.0 mm across');
    expect(above).toContain('records 64.0 mm');
    expect(above).toContain('check the wheel centre height or the ride height');

    const below = renderChassis(moveWheelCentre(base, 25.4));
    expect(below).not.toContain('check the wheel centre height or the ride height');
  });

  it('renders the same per-vehicle panel in Front, Rear and Both', () => {
    const front = renderToStaticMarkup(createElement(AnalysisView));
    const rear = renderToStaticMarkup(createElement(AnalysisView, { initialAxle: 'rear' }));
    const both = renderToStaticMarkup(createElement(AnalysisView, { initialMode: 'both' }));

    for (const html of [front, rear, both]) {
      expect(html).toContain('>Chassis</h2>');
      expect(html).toContain('Front wheel diameter');
      expect(html).toContain('Rear wheel diameter');
      expect(inputTag(html, 'Ride height in mm')).toContain('value="5"');
      expect(inputTag(html, 'Plate thickness in mm')).toContain('value="2"');
    }
  });

  it('moves the drawing ground line and its accessible roll-centre value when ride height changes', () => {
    const base = referenceModel();
    const raised = update(base, 'ride_height', 6.0);
    const baseDatum = chassisDatum(base);
    const raisedDatum = chassisDatum(raised);
    if (baseDatum === null || raisedDatum === null) throw new Error('datum missing');

    const baseHtml = renderFrontScene(
      base,
      `ground (derived, z ${baseDatum.groundPlaneMm.toFixed(1)} mm)`,
    );
    const raisedHtml = renderFrontScene(
      raised,
      `ground (derived, z ${raisedDatum.groundPlaneMm.toFixed(1)} mm)`,
    );

    expect(groundLineY(baseHtml)).not.toBe('');
    expect(groundLineY(baseHtml)).not.toBe(groundLineY(raisedHtml));
    expect(contactPatchPath(baseHtml)).not.toBe('');
    expect(contactPatchPath(baseHtml)).not.toBe(contactPatchPath(raisedHtml));
    expect(baseHtml).toContain('9.97 mm');
    expect(raisedHtml).toContain('10.97 mm');
    expect(raisedHtml).toContain('ground (derived, z -8.0 mm)');
  });
});
