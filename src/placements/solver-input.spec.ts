import {
  buildSolverDocument,
  eventDistanceMeters,
  originDistanceKm,
  parseCheckpointAssignments,
  parseFinalAssignments,
} from './solver-input';

describe('placement solver input', () => {
  it('parses a checkpoint keyed by reservation uuid', () => {
    const groupId = '11111111-1111-4111-8111-111111111111';
    const placeId = '22222222-2222-4222-8222-222222222222';
    expect(parseCheckpointAssignments({ [`${groupId}:men`]: placeId })).toEqual([
      { groupId, gender: 'men', placeId },
    ]);
  });

  it('parses the final assignment list', () => {
    expect(
      parseFinalAssignments([
        { gender: 'women', place_id: 'place-1', group_id: 'group-1' },
        { gender: 'other', place_id: 'place-1', group_id: 'group-1' },
      ]),
    ).toEqual([{ groupId: 'group-1', gender: 'women', placeId: 'place-1' }]);
  });

  it('turns stored shrine kilometers into meters', () => {
    expect(eventDistanceMeters(36.27, 59.67, 5.671)).toBe(5671);
  });

  it('keeps a missing origin distance at one kilometer', () => {
    expect(originDistanceKm(null, null)).toBe(1);
  });

  it('puts the checkpoint path and time limit in the solver document', () => {
    const doc = buildSolverDocument({
      groups: [],
      places: [],
      timeLimitSeconds: 1800,
      checkpointPath: 'D:/runs/last_solution.json',
    });
    expect(doc.options).toEqual({
      time_limit_seconds: 1800,
      checkpoint_path: 'D:/runs/last_solution.json',
    });
    expect(doc.city_conflicts).toEqual([]);
  });
});
