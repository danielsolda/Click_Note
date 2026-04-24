export function calculatePriority({ impacto, urgencia, risco }) {
  const i = Number(impacto ?? 0);
  const u = Number(urgencia ?? 0);
  const r = Number(risco ?? 0);

  if ([i, u, r].some((value) => Number.isNaN(value) || value < 0 || value > 5)) {
    throw new Error('Impacto, urgência e risco devem ser números entre 0 e 5');
  }

  const score = i * 0.5 + u * 0.3 + r * 0.2;
  return Number(score.toFixed(2));
}

export function sortBacklogByPriority(items) {
  return [...items].sort((a, b) => {
    const scoreA = calculatePriority(a);
    const scoreB = calculatePriority(b);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    return (a.titulo ?? '').localeCompare(b.titulo ?? '', 'pt-BR');
  });
}
