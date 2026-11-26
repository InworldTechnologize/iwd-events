/** Server-side state machines. Every transition is checked here and logged by the command. */
export type Machine<S extends string> = Readonly<Record<S, readonly S[]>>;

export function canTransition<S extends string>(m: Machine<S>, from: S, to: S): boolean {
  return from === to ? false : (m[from] ?? []).includes(to);
}

/** Enquiry flow (DM's stages), with "lost" reachable from any open stage. */
export const ENQUIRY_FLOW: Machine<'new' | 'contacted' | 'site_visit' | 'quoted' | 'confirmed' | 'completed' | 'lost'> = {
  new: ['contacted', 'site_visit', 'quoted', 'lost'],
  contacted: ['site_visit', 'quoted', 'lost'],
  site_visit: ['quoted', 'lost'],
  quoted: ['confirmed', 'lost'],
  confirmed: ['completed', 'lost'],
  completed: [],
  lost: ['new'],
};
