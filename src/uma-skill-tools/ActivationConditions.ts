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

        // Spatial conditions that filter regions
        if (name === 'phase') {
            return [regions.rmap(r => {
                const phase = arg as Phase;
                const phaseRegion = new Region(CourseHelpers.phaseStart(course.distance, phase), CourseHelpers.phaseEnd(course.distance, phase));
                return r.intersect(phaseRegion);
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
                if (opName === 'gt' || opName === 'gte') return r.intersect({ start: 0, end: pos });
                if (opName === 'lt' || opName === 'lte') return r.intersect({ start: pos, end: course.distance });
                return r;
            }), (state) => true];
        }

        // Dynamic conditions that return a predicate
        const predicate: DynamicCondition = (state: RaceState) => {
            let val: number;
            switch (name) {
                case 'order': val = state.order; break;
                case 'order_rate': val = (state.order / state.numUmas) * 100; break;
                case 'hp_per': val = state.hp.hpRatioRemaining() * 100; break;
                case 'phase': val = state.phase; break;
                case 'activate_count_heal': val = state.activateCountHeal; break;
                case 'activate_count_start': val = state.activateCount[0]; break;
                case 'activate_count_middle': val = state.activateCount[1]; break;
                case 'activate_count_end': val = state.activateCount[2]; break;
                case 'activate_count_end_after': val = state.activateCount[2]; break;
                case 'activate_count_all': val = state.activateCount[0] + state.activateCount[1] + state.activateCount[2]; break;
                case 'is_kakari': return state.isKakari;
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

export class EqOperator extends CmpOperator {}
export class NeqOperator extends CmpOperator {}
export class LtOperator extends CmpOperator {}
export class LteOperator extends CmpOperator {}
export class GtOperator extends CmpOperator {}
export class GteOperator extends CmpOperator {}

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
        const leftRes = this.left.apply(regions, course, horse, extra);
        const rightRes = this.right.apply(regions, course, horse, extra);

        if (!Array.isArray(leftRes) || !Array.isArray(rightRes)) {
            return [regions, (state) => true];
        }

        const [leftRegions, leftCond] = leftRes;
        const [rightRegions, rightCond] = rightRes;

        if (this instanceof AndOperator) {
            // For AND, we intersect regions and combine conditions
            return [leftRegions.union(rightRegions), (state) => leftCond(state) && rightCond(state)];
        } else {
            // For OR, we union regions and combine conditions
            return [leftRegions.union(rightRegions), (state) => leftCond(state) || rightCond(state)];
        }
    }
}

export class AndOperator extends LogicalOperator {}
export class OrOperator extends LogicalOperator {}

export const Conditions: {[key: string]: Condition} = new Proxy({}, {
    get: (target, name: string) => ({ name, samplePolicy: null })
});

export const random = (obj: any) => ({ ...obj, sample: () => [] });
export const immediate = (obj: any) => ({ ...obj, sample: () => [] });
export const noopRandom = { sample: () => [] };
