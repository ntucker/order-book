import type { ScenarioPosture } from './types';

export const POSTURE_LABEL: Record<ScenarioPosture, string> = {
  lock: 'Lock',
  record: 'Record',
  option: 'Option',
};

export const POSTURE_HINT: Record<ScenarioPosture, string> = {
  lock: 'Invariant already true on this path — assert it.',
  record: 'Scripted timing. Diamonds record what happened, not a green lock.',
  option: 'Bucket 3 choice. Compare routes; do not treat completion as a pass.',
};
