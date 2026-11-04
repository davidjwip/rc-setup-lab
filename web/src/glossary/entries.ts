export interface GlossaryEntry {
  readonly id: string;
  readonly term: string;
  readonly oneLiner: string;
  readonly racerSentence: string;
  readonly where: string;
  readonly related?: readonly string[];
}

export const glossaryEntries: readonly GlossaryEntry[] = [
  {
    id: 'instant-centre',
    term: 'Instant centre',
    oneLiner: 'Where the two suspension links would cross if you extended both in front view.',
    racerSentence:
      'The wheel does not travel straight up when it bumps — it swings around that point, and the further away the point sits the flatter that swing, which is why a long-link car gains so little camber and a short one gains a lot. It is instantaneous: it moves as the suspension moves, so the app recomputes it at every bump rather than treating it as a fixed point on the car. The line from the contact patch to the instant centre is what decides the roll centre, which is why moving one camber link changes both at once.',
    where:
      'the drawing — the crossing point of the two extended links — and behind every roll-centre and camber-gain number. Reference car: 435.7 mm inboard of the wheel and 60.5 mm above the road.',
    related: ['roll-centre', 'camber-gain'],
  },
  {
    id: 'roll-centre',
    term: 'Roll centre',
    oneLiner:
      'The height the car rolls about at one end, found by extending the suspension links until they meet in front view.',
    racerSentence:
      'Raise it and that end rolls less but takes more of the weight transfer — which is why raising the front roll centre puts more weight on the front, not less.',
    where: 'Analysis card 3, measure groups Front and Rear, concept "Roll centre".',
    related: ['instant-centre', 'load-transfer', 'droop'],
  },
  {
    id: 'camber-gain',
    term: 'Camber gain',
    oneLiner:
      'How much camber the wheel picks up as the suspension compresses — normally quoted per 10 mm of bump, and it is what keeps the tyre flat as the chassis rolls.',
    racerSentence:
      'More gain keeps the outside tyre flatter in a corner but makes the car more sensitive to ride height and roll.',
    where: 'Analysis card 4, front geometry measurement, concept "Camber and camber gain".',
    related: ['instant-centre', 'roll-centre'],
  },
  {
    id: 'bump-steer',
    term: 'Bump steer',
    oneLiner:
      "Toe change as the wheel moves up and down, caused by the tie rod swinging through an arc that does not match the suspension's arc.",
    racerSentence:
      'A car with bump steer steers itself over bumps and curbs, so the driver feels it as a car that will not hold a line.',
    where: 'Analysis card 5, steering measurements, concept "Toe, bump steer and Ackermann".',
    related: ['camber-gain'],
  },
  {
    id: 'wheel-rate',
    term: 'Wheel rate',
    oneLiner:
      'The spring rate the tyre actually feels, after the linkage has moved the spring less than the wheel.',
    racerSentence:
      'It is the number to compare when you change shock position, because a stiffer spring in a worse position can be softer at the wheel.',
    where: 'Analysis card 6, spring and damper measurements, concept "Springs, bars and roll stiffness".',
    related: ['motion-ratio', 'damping-ratio'],
  },
  {
    id: 'motion-ratio',
    term: 'Motion ratio',
    oneLiner:
      'How far the spring or shock moves for each millimetre the wheel moves: a motion ratio of 0.65 means 0.65 mm of shock travel per 1 mm of wheel travel.',
    racerSentence:
      'Wheel rate is spring rate multiplied by the motion ratio squared, which is why small geometry changes bite harder than they look.',
    where: 'inside Analysis card 6, and the optional ruler check in the damper group.',
    related: ['wheel-rate'],
  },
  {
    id: 'load-transfer',
    term: 'Load transfer',
    oneLiner: 'The weight that moves from the inside wheels to the outside wheels in a corner.',
    racerSentence:
      "The total is fixed by the car's mass, its centre of gravity height, its track width and how hard it is cornering — the setup does not change it. What you tune is how much of it the front takes, which is what racers call balance.",
    where: 'Analysis card 1, concept "Load transfer and balance".',
    related: ['roll-centre', 'droop'],
  },
  {
    id: 'damping-ratio',
    term: 'Damping ratio',
    oneLiner:
      'How well the shock controls the spring, as a fraction of the damping that would stop it oscillating at all.',
    racerSentence:
      'Under about 0.3 the car keeps bouncing after a bump; around 0.6–0.7 it settles in one movement; well over 1 it feels dead and skips over the surface.',
    where: 'Analysis card 7, damper group, concept "Dampers and damping ratio".',
    related: ['wheel-rate'],
  },
  {
    id: 'droop',
    term: 'Droop',
    oneLiner:
      'How far the suspension hangs down from ride height when the car is lifted, before it hits the droop screw or a limiter in the shock.',
    racerSentence:
      'Run out of droop and the inside wheel stops extending, so that corner lifts and the car rolls onto the outside tyre sooner — droop is a roll control you can feel but cannot see.',
    where: 'Setup values §1, Bench measurement group, concept "Roll stiffness".',
    related: ['roll-centre', 'load-transfer'],
  },
];

export const entries = glossaryEntries;

export function filterEntries(
  entries: readonly GlossaryEntry[],
  query: string,
): readonly GlossaryEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === '') return entries;
  return entries.filter((entry) =>
    [entry.term, entry.oneLiner, entry.racerSentence, entry.where]
      .join(' ')
      .toLocaleLowerCase()
      .includes(needle),
  );
}
