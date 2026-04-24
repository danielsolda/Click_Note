import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePriority, sortBacklogByPriority } from '../src/domain/prioritization.js';

test('calculatePriority aplica pesos corretos', () => {
  const score = calculatePriority({ impacto: 5, urgencia: 3, risco: 2 });
  assert.equal(score, 3.8);
});

test('calculatePriority valida range de entrada', () => {
  assert.throws(() => calculatePriority({ impacto: 6, urgencia: 2, risco: 1 }), {
    message: 'Impacto, urgência e risco devem ser números entre 0 e 5',
  });
});

test('sortBacklogByPriority ordena maior score primeiro', () => {
  const sorted = sortBacklogByPriority([
    { titulo: 'Item B', impacto: 3, urgencia: 2, risco: 2 },
    { titulo: 'Item A', impacto: 5, urgencia: 4, risco: 4 },
  ]);

  assert.equal(sorted[0].titulo, 'Item A');
  assert.equal(sorted[1].titulo, 'Item B');
});
