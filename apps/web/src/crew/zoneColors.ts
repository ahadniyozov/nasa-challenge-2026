import type { TargetKind } from '../game2d/missions';
/** one colour per kind of target, used on the crew radar */
export const ZONE_COLOR: Record<TargetKind, string> = { star: '#e9edf1', fire: '#ff7a45', ice: '#9fe6ff', storm: '#d6e6ff', particle: '#9fffc8', city: '#ffd28a' };
