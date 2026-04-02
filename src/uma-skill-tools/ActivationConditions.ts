import { CourseData, CourseHelpers, Phase } from './CourseData';
import { HorseParameters } from './HorseTypes';
import { Region, RegionList } from './Region';
import { RaceState, DynamicCondition } from './RaceSolver';
import { ImmediatePolicy, RandomPolicy, StraightRandomPolicy, AllCornerRandomPolicy } from './ActivationSamplePolicy';

export interface Condition {
    name: string;
    samplePolicy: any;
}

export abstract class Operator {
    abstract apply(regions: RegionList, course: CourseData, horse: HorseParameters, extra: any): [RegionList, DynamicCondition];
    get samplePolicy(): any { return ImmediatePolicy; }
}

export class CmpOperator extends Operator {
    constructor(readonly condition: Condition, readonly argument: number) {
        super();
    }

    get samplePolicy(): any {
        return this.condition.samplePolicy || ImmediatePolicy;
    }

    apply(regions: RegionList, course: CourseData, horse: HorseParameters, extra: any): [RegionList, DynamicCondition] {
        const name = this.condition.name;
        const arg = this.argument;
        const opName = this.constructor.name.replace('Operator', '').toLowerCase();

        // --- 1. FILTROS ESTÁTICOS (Green Skills / Passives) ---
        // Estos se mantienen en 0m porque son pasivos.
        const staticValues: Record<string, number> = {
            'weather': extra.weather,
            'season': extra.season,
            'ground_condition': extra.groundCondition,
            'ground_type': course.surface,
            'running_style': horse.strategy,
            'track_id': course.raceTrackId,
            'rotation': course.turn,
            'is_basis_distance': (course.distance % 400 === 0) ? 1 : 0,
            'fan_count': arg,
            'visiblehorse': arg,
            'is_abroad': arg,
            'is_dirtgrade': arg,
            'activate_count_all_team': arg,
            'is_exist_chara_id': arg,
            'is_exist_skill_id': arg,
            'compete_fight_count': arg,
            'is_tight_track': arg
        };

        if (name in staticValues) {
            const val = staticValues[name];
            let isMatch = false;
            switch (opName) {
                case 'eq': isMatch = val === arg; break;
                case 'neq': isMatch = val !== arg; break;
                case 'lt': isMatch = val < arg; break;
                case 'lte': isMatch = val <= arg; break;
                case 'gt': isMatch = val > arg; break;
                case 'gte': isMatch = val >= arg; break;
            }
            if (!isMatch) return [new RegionList(), (state) => false];
            return [regions, (state) => true];
        }

        // --- 2. FILTROS GEOGRÁFICOS Y ALEATORIOS (Corrige el error de 0m) ---

        // Variante: RANDOM EN FASES (phase_random, phase_laterhalf_random, etc.)
        if (name.includes('phase') && name.includes('random')) {
            const phase = arg;
            const pStart = CourseHelpers.phaseStart(course.distance, phase as Phase);
            const pEnd = CourseHelpers.phaseEnd(course.distance, phase as Phase);
            let bounds = { start: pStart, end: pEnd };

            if (name.includes('laterhalf')) bounds.start = pStart + (pEnd - pStart) / 2;
            if (name.includes('firsthalf')) bounds.end = pStart + (pEnd - pStart) / 2;

            return [regions.rmap(r => r.intersect(bounds)), (state) => true];
        }

        // Variante: RANDOM EN CURVAS (corner_random, all_corner_random)
        if (name === 'corner_random' || name === 'all_corner_random' || name === 'corner') {
            let targetRegions: Region[] = [];
            const isCornerNeq0 = name === 'corner' && opName === 'neq' && arg === 0;
            const isCornerEq0 = name === 'corner' && opName === 'eq' && arg === 0;

            if (name === 'all_corner_random' || isCornerNeq0) {
                targetRegions = course.corners.map(c => new Region(c.start, c.start + c.length));
            } else if (isCornerEq0) {
                targetRegions = course.straights.map(s => new Region(s.start, s.end));
            } else if (arg > 0) {
                const c = course.corners[arg - 1];
                if (c) targetRegions = [new Region(c.start, c.start + c.length)];
            }

            return [regions.rmap(r => targetRegions.map(tr => r.intersect(tr))),
            (state) => {
                if (name === 'all_corner_random' || isCornerNeq0) return state.currentCornerIdx !== 0;
                if (isCornerEq0) return state.currentCornerIdx === 0;
                return state.currentCornerIdx === arg;
            }];
        }

        // Variante: RANDOM EN RECTAS (straight_random, last_straight_random)
        if (name === 'straight_random' || name === 'last_straight_random' || name === 'is_last_straight') {
            let targetRegions: Region[] = [];
            if (name === 'last_straight_random' || name === 'is_last_straight') {
                const ls = course.straights[course.straights.length - 1];
                if (ls) targetRegions = [new Region(ls.start, ls.end)];
            } else {
                targetRegions = course.straights.map(s => new Region(s.start, s.end));
            }

            return [regions.rmap(r => targetRegions.map(tr => r.intersect(tr))),
            (state) => (name === 'is_last_straight' ? state.isLastStraight : state.currentCornerIdx === 0)];
        }

        // Variante: RANDOM EN CUESTAS (up_slope_random, down_slope_random)
        if (name === 'up_slope_random' || name === 'down_slope_random') {
            const isUp = name.startsWith('up');
            const slopes = course.slopes.filter(s => isUp ? s.slope > 0 : s.slope < 0);
            const targetRegions = slopes.map(s => new Region(s.start, s.start + s.length));

            return [regions.rmap(r => targetRegions.map(tr => r.intersect(tr))), (state) => true];
        }

        // Variante: FINAL CORNER
        if (name === 'is_finalcorner' || name === 'is_finalcorner_laterhalf') {
            const lastCorner = course.corners[course.corners.length - 1];
            if (!lastCorner) return [new RegionList(), (state) => false];
            
            let start = lastCorner.start;
            let end = lastCorner.start + lastCorner.length;
            
            if (name === 'is_finalcorner_laterhalf') {
                start = start + (end - start) / 2;
            }
            
            const targetRegion = new Region(start, end);
            
            if (opName === 'eq' && arg === 1) {
                return [regions.rmap(r => r.intersect(targetRegion)), (state) => (name === 'is_finalcorner' ? state.isFinalCorner : state.isFinalCornerLaterHalf)];
            } else if (opName === 'eq' && arg === 0) {
                // Si es == 0, significa que NO debe estar en la curva final.
                // Esto es más complejo de representar en regiones si queremos ser exactos, 
                // pero por ahora lo dejamos como un predicado dinámico.
                return [regions, (state) => !(name === 'is_finalcorner' ? state.isFinalCorner : state.isFinalCornerLaterHalf)];
            }
        }

        // Variante: RANDOM DESPUÉS DE X% (distance_rate_after_random)
        if (name === 'distance_rate_after_random') {
            const pos = (arg / 100) * course.distance;
            return [regions.rmap(r => r.intersect({ start: pos, end: course.distance })), (state) => true];
        }

        // --- 3. FILTROS ESPACIALES ESTÁNDAR ---
        if (name === 'phase') {
            const phaseStart = CourseHelpers.phaseStart(course.distance, arg as Phase);
            const phaseEnd = CourseHelpers.phaseEnd(course.distance, arg as Phase);
            return [regions.rmap(r => {
                if (opName === 'eq') return r.intersect({ start: phaseStart, end: phaseEnd });
                if (opName === 'gt' || opName === 'gte') return r.intersect({ start: phaseStart, end: course.distance });
                if (opName === 'lt' || opName === 'lte') return r.intersect({ start: 0, end: phaseEnd });
                return r;
            }), (state) => state.phase === arg];
        }

        if (name === 'distance_rate') {
            const pos = (arg / 100) * course.distance;
            return [regions.rmap(r => {
                if (opName === 'gt' || opName === 'gte') return r.intersect({ start: pos, end: course.distance });
                if (opName === 'lt' || opName === 'lte') return r.intersect({ start: 0, end: pos });
                return r;
            }), (state) => true];
        }

        if (name === 'remain_distance') {
            const pos = course.distance - arg;
            return [regions.rmap(r => {
                if (opName === 'lt' || opName === 'lte') return r.intersect({ start: pos, end: course.distance });
                if (opName === 'gt' || opName === 'gte') return r.intersect({ start: 0, end: pos });
                return r;
            }), (state) => true];
        }

        if (name === 'accumulatetime' && (opName === 'gte' || opName === 'gt')) {
            const t = arg;
            const baseSpeed = 20.0 - (course.distance - 2000) / 1000.0;
            const allowedRegion = new Region(0.85 * baseSpeed * t, course.distance);
            regions = regions.rmap(r => r.intersect(allowedRegion));
        }

        // --- 4. PREDICADO DINÁMICO (Evaluación por frame) ---
        const predicate: DynamicCondition = (state: RaceState) => {
            let val: any;
            switch (name) {
                case 'order': val = state.order; break;
                case 'order_rate': val = ((state.order - 1) / Math.max(1, state.numUmas - 1)) * 100; break;
                case 'hp_per': val = state.hp.hpRatioRemaining() * 100; break;
                case 'accumulatetime': val = state.accumulatetime.t; break;
                case 'temptation_count': val = state.temptationCount; break;
                case 'is_temptation': val = state.isKakari ? 1 : 0; break;
                case 'is_lastspurt': val = state.isLastSpurt ? 1 : 0; break;
                case 'is_finalcorner': val = state.isFinalCorner ? 1 : 0; break;
                case 'is_finalcorner_laterhalf': val = state.isFinalCornerLaterHalf ? 1 : 0; break;
                case 'is_last_straight': val = state.isLastStraight ? 1 : 0; break;
                case 'furlong': val = (state as any).furlong; break;
                case 'bashin_diff_infront': val = state.bashinDiffInfront / 2.5; break;
                case 'bashin_diff_behind': val = state.bashinDiffBehind / 2.5; break;
                case 'change_order_onetime': val = state.changeOrderLastFrame; break;
                case 'blocked_front_continuetime': val = (state as any).blockedFrontTime; break;
                case 'infront_near_lane_time': val = (state as any).nearLaneTimeInfront; break;
                case 'behind_near_lane_time': val = (state as any).nearLaneTimeBehind; break;
                case 'order_rate_in20_continue': val = (state as any).orderRateIn20Continue ? 1 : 0; break;
                case 'order_rate_in40_continue': val = (state as any).orderRateIn40Continue ? 1 : 0; break;
                case 'order_rate_in50_continue': val = (state as any).orderRateIn50Continue ? 1 : 0; break;
                case 'order_rate_in80_continue': val = (state as any).orderRateIn80Continue ? 1 : 0; break;
                case 'order_rate_out20_continue': val = (state as any).orderRateOut20Continue ? 1 : 0; break;
                case 'order_rate_out40_continue': val = (state as any).orderRateOut40Continue ? 1 : 0; break;
                case 'order_rate_out50_continue': val = (state as any).orderRateOut50Continue ? 1 : 0; break;
                case 'order_rate_out70_continue': val = (state as any).orderRateOut70Continue ? 1 : 0; break;
                case 'base_speed': val = state.horse.speed; break;
                case 'base_stamina': val = state.horse.stamina; break;
                case 'base_power': val = state.horse.power; break;
                case 'base_guts': val = state.horse.guts; break;
                case 'base_wiz': val = state.horse.wisdom; break;
                case 'change_order_up_middle': val = (state as any).overtakesInPhase[1]; break;
                case 'change_order_up_finalcorner_after': val = (state as any).overtakesInFinalCorner; break;
                case 'activate_count_heal': val = state.activateCountHeal; break;
                default: return true;
            }

            switch (opName) {
                case 'eq': return val === arg;
                case 'neq': return val !== arg;
                case 'lt': return val < arg;
                case 'lte': return val <= arg;
                case 'gt': return val > arg;
                case 'gte': return val >= arg;
                default: return true;
            }
        };

        return [regions, predicate];
    }
}

export class EqOperator extends CmpOperator { }
export class NeqOperator extends CmpOperator { }
export class LtOperator extends CmpOperator { }
export class LteOperator extends CmpOperator { }
export class GtOperator extends CmpOperator { }
export class GteOperator extends CmpOperator { }

export class LogicalOperator extends Operator {
    constructor(readonly left: Operator, readonly right: Operator) {
        super();
    }

    get samplePolicy(): any {
        const leftPolicy = this.left.samplePolicy;
        const rightPolicy = this.right.samplePolicy;
        if (leftPolicy && rightPolicy) {
            return leftPolicy.reconcile(rightPolicy);
        }
        return leftPolicy || rightPolicy || ImmediatePolicy;
    }

    apply(regions: RegionList, course: CourseData, horse: HorseParameters, extra: any): [RegionList, DynamicCondition] {
        const [leftRegions, leftCond] = this.left.apply(regions, course, horse, extra);
        const [rightRegions, rightCond] = this.right.apply(regions, course, horse, extra);

        if (this instanceof AndOperator) {
            // CORRECCIÓN: Intersección para AND
            const intersectedRegions = leftRegions.rmap(lr => {
                return rightRegions.map(rr => lr.intersect(rr)).filter(r => r.start !== -1);
            }).flat();

            const resultList = new RegionList();
            intersectedRegions.forEach(r => resultList.push(r));

            return [resultList, (state) => leftCond(state) && rightCond(state)];
        } else {
            // Unión para OR (@)
            return [leftRegions.union(rightRegions), (state) => leftCond(state) || rightCond(state)];
        }
    }
}

export class AndOperator extends LogicalOperator { }
export class OrOperator extends LogicalOperator { }

export const Conditions: { [key: string]: Condition } = new Proxy({}, {
    get: (target, name: string) => {
        let policy = ImmediatePolicy;
        if (name === 'straight_random' || name === 'last_straight_random' || name === 'phase_straight_random') {
            policy = StraightRandomPolicy;
        } else if (name === 'all_corner_random') {
            policy = AllCornerRandomPolicy;
        } else if (name.includes('random')) {
            policy = RandomPolicy;
        }
        return { name, samplePolicy: policy };
    }
});

export const random = (obj: any) => ({ ...obj, sample: () => [] });
export const immediate = (obj: any) => ({ ...obj, sample: () => [] });
export const noopRandom = { sample: () => [] };
