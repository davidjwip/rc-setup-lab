import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildFrontViewInput,
  chassisDatum,
  parseCarModel,
  updateChassisValue,
  updateWheelDiameter,
  type CarModelDocument,
} from '@setuplab/data';
import { buildFrontViewScene, solveFrontView } from '@setuplab/physics';
import rawModel from '../../assets/models/reference-touring-car.json';
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

function setWheelDiameter(
  model: CarModelDocument,
  axle: 'front' | 'rear',
  diameterMm: number,
): CarModelDocument {
  const edited = updateWheelDiameter(model, axle, diameterMm);
  if (!edited.ok) throw new Error(JSON.stringify(edited.errors));
  return edited.value;
}

function fieldText(html: string, field: string): string {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    html.match(new RegExp(`data-field="${escaped}"[^>]*>([^<]*)<`))?.[1] ?? ''
  );
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
  it('renders labelled, editable ride height and plate thickness', () => {
    const html = renderChassis(referenceModel());

    expect(html).toContain('>Chassis</h2>');
    const rideHeight = inputTag(html, 'Ride height in mm');
    const thickness = inputTag(html, 'Plate thickness in mm');
    expect(rideHeight).toContain('value="5"');
    expect(thickness).toContain('value="2"');
    expect(rideHeight).not.toContain('disabled');
    expect(thickness).not.toContain('disabled');
    expect(html).toContain('field-unit">mm');
  });

  it('shows labelled wheel-diameter inputs and the derived hub height for both axles', () => {
    const html = renderChassis(referenceModel());

    expect(inputTag(html, 'Front wheel diameter in mm')).toContain('value="64"');
    expect(inputTag(html, 'Rear wheel diameter in mm')).toContain('value="64"');
    expect(html).toContain('Front hub z (chassis frame)');
    expect(html).toContain('Rear hub z (chassis frame)');
    expect(html).toContain('Front wheel centre above ground');
    expect(html).toContain('Plate top above ground');
    expect(html).toContain('Ground plane z (chassis frame)');
    expect(html).not.toContain('inferred');
  });

  it('keeps the wheel-centre-above-ground readout equal to the radius at every ride height and diameter', () => {
    const base = referenceModel();
    const raised = update(base, 'ride_height', 6.0);
    const bigger = setWheelDiameter(base, 'front', 66.0);

    for (const model of [base, raised]) {
      const html = renderChassis(model);
      expect(fieldText(html, 'front_wheel_centre_height')).toBe('32.0 mm');
      expect(fieldText(html, 'rear_wheel_centre_height')).toBe('32.0 mm');
      expect(html).not.toContain('check the wheel centre height or the ride height');
    }

    const biggerHtml = renderChassis(bigger);
    expect(fieldText(biggerHtml, 'front_wheel_centre_height')).toBe('33.0 mm');
    expect(fieldText(biggerHtml, 'rear_wheel_centre_height')).toBe('32.0 mm');
  });

  it('renders the same per-vehicle panel from the same model', () => {
    const first = renderChassis(referenceModel());
    const second = renderChassis(referenceModel());

    expect(first).toBe(second);
    expect(first).toContain('>Chassis</h2>');
    expect(first).toContain('Front wheel diameter');
    expect(first).toContain('Rear wheel diameter');
    expect(inputTag(first, 'Ride height in mm')).toContain('value="5"');
    expect(inputTag(first, 'Plate thickness in mm')).toContain('value="2"');
  });

  it('keeps the road line fixed but rotates the arms and changes the roll centre when ride height changes', () => {
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
    expect(groundLineY(raisedHtml)).toBe(groundLineY(baseHtml));
    expect(contactPatchPath(baseHtml)).not.toBe('');
    expect(contactPatchPath(raisedHtml)).toBe(contactPatchPath(baseHtml));
    expect(baseHtml).toContain('9.97 mm');
    expect(raisedHtml).toContain('11.58 mm');
    expect(raisedHtml).toContain('ground (derived, z -8.0 mm)');
  });
});
