export function createKioskState({ idleMs = 150_000, presentationMs = 90_000 } = {}) {
  return {
    view: 'home',
    pathwayId: null,
    presentationEndsAt: null,
    lastActivityAt: 0,
    idleMs,
    presentationMs,
    revision: 0,
  };
}

function toHome(state, now) {
  return {
    ...state,
    view: 'home',
    pathwayId: null,
    presentationEndsAt: null,
    lastActivityAt: now,
    revision: state.revision + 1,
  };
}

export function reduceKioskState(state, event) {
  const now = Number.isFinite(event.now) ? event.now : Date.now();

  switch (event.type) {
    case 'SELECT_PATHWAY':
      return {
        ...state,
        view: 'presenting',
        pathwayId: event.pathwayId,
        presentationEndsAt: now + state.presentationMs,
        lastActivityAt: now,
        revision: state.revision + 1,
      };
    case 'RETURN_HOME':
      return toHome(state, now);
    case 'MARK_ACTIVITY':
      return { ...state, lastActivityAt: now };
    case 'TICK':
      if (state.view === 'presenting' && now >= state.presentationEndsAt) return toHome(state, now);
      if (state.view === 'home' && now - state.lastActivityAt >= state.idleMs) return toHome(state, now);
      return state;
    default:
      return state;
  }
}
