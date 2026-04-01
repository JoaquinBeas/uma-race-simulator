import { CourseData, CourseHelpers, Phase } from './CourseData';
import { HorseParameters } from './HorseTypes';
import { Region, RegionList } from './Region';
import { RaceState, DynamicCondition } from './RaceSolver';
import { ImmediatePolicy } from './ActivationSamplePolicy';

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

        // --- 1. EVALUACIÓN DE CONDICIONES ESTÁTICAS (GREEN SKILLS) ---
        const staticValues: Record<string, number> = {
            'weather': extra.weather,
            'season': extra.season,
            'ground_condition': extra.groundCondition,
            'ground_type': course.surface,
            'running_style': horse.strategy,
            'track_id': course.raceTrackId,
            'rotation': course.turn,
            'is_basis_distance': (course.distance % 400 === 0) ? 1 : 0,
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

        // --- 2. EVALUACIÓN DE CONDICIONES ESPACIALES ---
        if (name === 'phase') {
            const phaseStart = CourseHelpers.phaseStart(course.distance, arg as Phase);
            const phaseEnd = CourseHelpers.phaseEnd(course.distance, arg as Phase);
            const phaseRegion = new Region(phaseStart, phaseEnd);

            // Si la condición es igualdad, filtramos por esa fase. Si es gt/lt, ajustamos.
            return [regions.rmap(r => {
                if (opName === 'eq') return r.intersect(phaseRegion);
                if (opName === 'gt' || opName === 'gte') return r.intersect({ start: phaseStart, end: course.distance });
                if (opName === 'lt' || opName === 'lte') return r.intersect({ start: 0, end: phaseEnd });
                return r;
            }), (state) => true];
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
                // remain_distance <= 200 significa estar entre distance-200 y el final
                if (opName === 'lt' || opName === 'lte') return r.intersect({ start: pos, end: course.distance });
                if (opName === 'gt' || opName === 'gte') return r.intersect({ start: 0, end: pos });
                return r;
            }), (state) => true];
        }

        // --- 3. EVALUACIÓN DE CONDICIONES DINÁMICAS (PREDICATE) ---
        const predicate: DynamicCondition = (state: RaceState) => {
            let val: any;
            switch (name) {
                // --- DINÁMICAS BÁSICAS ---
                case 'order': val = state.order; break;
                case 'order_rate': val = (state.order / state.numUmas) * 100; break;
                case 'hp_per': val = state.hp.hpRatioRemaining() * 100; break;
                case 'accumulatetime': val = state.accumulatetime.t; break;
                case 'temptation_count': val = state.temptationCount; break;
                case 'is_temptation': val = state.isKakari ? 1 : 0; break;
                case 'is_lastspurt': val = state.isLastSpurt ? 1 : 0; break;

                // --- GEOMETRÍA Y POSICIÓN ---
                case 'corner': val = (state as any).currentCornerIdx; break;
                case 'corner_count': val = (state as any).cornerCount; break;
                case 'furlong': val = (state as any).furlong; break;
                case 'is_finalcorner': val = state.isFinalCorner ? 1 : 0; break;
                case 'is_last_straight': val = (state as any).isLastStraight ? 1 : 0; break;
                case 'straight_front_type': val = (state as any).currentStraightIdx; break; // Simplificado

                // --- TIMERS (CONTINUETIME) ---
                case 'blocked_front_continuetime': val = (state as any).blockedFrontTime; break;
                case 'infront_near_lane_time': val = (state as any).nearLaneTimeInfront; break;
                case 'behind_near_lane_time': val = (state as any).nearLaneTimeBehind; break;

                // --- MEMORIA (CONTINUE FLAGS) ---
                case 'order_rate_in20_continue': val = (state as any).orderRateIn20Continue ? 1 : 0; break;
                case 'order_rate_in40_continue': val = (state as any).orderRateIn40Continue ? 1 : 0; break;
                case 'order_rate_in50_continue': val = (state as any).orderRateIn50Continue ? 1 : 0; break;
                case 'order_rate_in80_continue': val = (state as any).orderRateIn80Continue ? 1 : 0; break;
                case 'order_rate_out20_continue': val = (state as any).orderRateOut20Continue ? 1 : 0; break;
                case 'order_rate_out40_continue': val = (state as any).orderRateOut40Continue ? 1 : 0; break;
                case 'order_rate_out50_continue': val = (state as any).orderRateOut50Continue ? 1 : 0; break;
                case 'order_rate_out70_continue': val = (state as any).orderRateOut70Continue ? 1 : 0; break;

                // --- STATS BASE ---
                case 'base_speed': val = state.horse.speed; break;
                case 'base_stamina': val = state.horse.stamina; break;
                case 'base_power': val = state.horse.power; break;
                case 'base_guts': val = state.horse.guts; break;
                case 'base_wiz': val = state.horse.wisdom; break;

                // --- COUNTERS DE ACTIVACIÓN ---
                case 'activate_count_start': val = state.activateCount[0]; break;
                case 'activate_count_middle': val = state.activateCount[1]; break;
                case 'activate_count_end_after': val = state.activateCount[2] + state.activateCount[3]; break;
                case 'activate_count_heal': val = state.activateCountHeal; break;

                // --- ADELANTAMIENTOS ---
                case 'change_order_up_middle': val = (state as any).overtakesInPhase[1]; break;
                case 'change_order_up_finalcorner_after': val = (state as any).overtakesInFinalCorner; break;

                // --- IGNORADOS (SIEMPRE TRUE) ---
                case 'fan_count':
                case 'visiblehorse':
                case 'is_abroad':
                case 'is_dirtgrade':
                case 'activate_count_all_team':
                case 'is_exist_chara_id':
                case 'is_exist_skill_id':
                case 'compete_fight_count':
                case 'near_count':
                case 'near_infront_count':
                case 'is_surrounded':
                case 'is_tight_track':
                    val = arg; // Forzamos que la comparación (val === arg) sea true
                    break;

                default:
                    return true;
            }

            // Lógica de comparación estándar (se mantiene igual)
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
    get: (target, name: string) => ({ name, samplePolicy: null })
});

export const random = (obj: any) => ({ ...obj, sample: () => [] });
export const immediate = (obj: any) => ({ ...obj, sample: () => [] });
export const noopRandom = { sample: () => [] };
