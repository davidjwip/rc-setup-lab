import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseCarModel } from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import { AnalysisView } from '../src/app.js';
import { HardpointEditor } from '../src/editor/HardpointEditor.js';
import {
  checkHardpointMm,
  cornerKeyForAxle,
  hardpointRowsForAxle,
} from '../src/editor/hardpoints.js';

function inputTag(html: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp(`<input[^>]*aria-label="${escaped}"[^>]*>`))?.[0] ?? '';
}

function referenceModel() {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

describe('hardpoint editor follows the selected axle', () => {
  it('shows the rear corner values and never the front values when Rear is selected', () => {
    const html = renderToStaticMarkup(createElement(AnalysisView, { initialAxle: 'rear' }));

    expect(inputTag(html, 'Upper link inner z in mm')).toContain('value="45"');
    expect(inputTag(html, 'Upper link inner z in mm')).not.toContain('value="38"');
    expect(inputTag(html, 'Lower arm inner (hinge point) z in mm')).toContain('value="9"');
    expect(inputTag(html, 'Lower ball joint offset y in mm')).toContain('value="-7"');
    expect(inputTag(html, 'Upper ball stud offset z in mm')).toContain('value="21"');
    expect(html).toContain('80.0 mm, 0.0 mm');
    expect(html).toContain('73.5 mm, 46.0 mm');
    expect(html).toContain('Rear-view drawing');
    expect(html).toContain('Hardpoints · rear-left');
  });

  it('renders the tie-rod rows at both ends', () => {
    const front = renderToStaticMarkup(createElement(AnalysisView));
    const rear = renderToStaticMarkup(createElement(AnalysisView, { initialAxle: 'rear' }));

    expect(inputTag(front, 'Tie rod inner y in mm')).not.toBe('');
    expect(inputTag(front, 'Tie rod outer offset z in mm')).not.toBe('');
    expect(inputTag(rear, 'Tie rod inner y in mm')).toContain('value="32"');
    expect(inputTag(rear, 'Tie rod outer offset z in mm')).toContain('value="-2"');
  });

  it('edits the damper mounts at both ends and shows the derived motion ratio beside them', () => {
    const front = renderToStaticMarkup(createElement(AnalysisView));
    const rear = renderToStaticMarkup(createElement(AnalysisView, { initialAxle: 'rear' }));

    expect(inputTag(front, 'Lower damper eye y in mm')).toContain('value="60"');
    expect(inputTag(front, 'Upper damper eye y in mm')).toContain('value="44"');
    expect(inputTag(front, 'Upper damper eye z in mm')).toContain('value="51"');
    expect(inputTag(rear, 'Lower damper eye y in mm')).toContain('value="68"');
    expect(inputTag(rear, 'Upper damper eye y in mm')).toContain('value="56"');

    expect(front).toContain('Derived damper motion ratio');
    expect(front).toContain('0.565');
    expect(front).toContain('motion-ratio-band');
    expect(rear).toContain('Derived damper motion ratio');
    expect(rear).toContain('0.689');
    expect(rear).toContain('spring installation ratio');
  });

  it('maps the axle selection onto the corner that receives an edit', () => {
    expect(cornerKeyForAxle('front')).toBe('LF');
    expect(cornerKeyForAxle('rear')).toBe('LR');
    expect(hardpointRowsForAxle('rear').some((row) => row.key === 'tie_in')).toBe(true);
    expect(hardpointRowsForAxle('front').some((row) => row.key === 'tie_in')).toBe(true);
  });

  it('marks an edited corner and offers a reset without pretending it was measured', () => {
    const model = referenceModel();
    const html = renderToStaticMarkup(
      createElement(HardpointEditor, {
        model,
        axle: 'rear',
        cornerKey: 'LR',
        edited: true,
        solverRefusal: null,
        onCommit: () => null,
        onReset: () => undefined,
      }),
    );

    expect(html).toContain('edited this session');
    expect(html).toContain('user-edited');
    expect(html).toContain('Reset this corner');
    expect(html).toContain('Provenance stays modelled');
  });

  it('refuses an out-of-range hardpoint and names the bound instead of clamping it', () => {
    const over = checkHardpointMm('3001');
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.message).toContain('3000');
    expect(over.message).toContain('-3000');

    const under = checkHardpointMm('-3001');
    expect(under.ok).toBe(false);

    expect(checkHardpointMm('3000')).toEqual({ ok: true, value: 3000 });
    expect(checkHardpointMm('52.5')).toEqual({ ok: true, value: 52.5 });
  });
});
