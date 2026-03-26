import { CourseData } from '../uma-skill-tools/CourseData';
import { Region, RegionList } from '../uma-skill-tools/Region';
import { RaceParameters } from '../uma-skill-tools/RaceParameters';
import { RaceSolver } from '../uma-skill-tools/RaceSolver';
import { RaceSolverBuilder, Perspective } from '../uma-skill-tools/RaceSolverBuilder';
import type { GameHpPolicy } from '../uma-skill-tools/HpPolicy';
import { PRNG, Rule30CARng } from '../uma-skill-tools/Random';
import { ActivationSamplePolicy, ImmediatePolicy, RandomPolicy, LogNormalRandomPolicy, ErlangRandomPolicy, StraightRandomPolicy, AllCornerRandomPolicy } from '../uma-skill-tools/ActivationSamplePolicy';

import { HorseState, SamplePolicyDesc, uniqueSkillForUma } from '../components/HorseDefTypes';

import skillmeta from '../uma-skill-tools/data/skill_meta.json';

class FixedDistancePolicy {
	constructor(readonly pos: number) {}
	sample(_0: RegionList, nsamples: number, _1: PRNG) { return Array.from({length: nsamples}, _ => new Region(this.pos, this.pos + 10)); }

	reconcile(other: ActivationSamplePolicy) { console.assert(false); return this; }
	reconcileImmediate(other: ActivationSamplePolicy) { console.assert(false); return this; }
	reconcileDistributionRandom(other: ActivationSamplePolicy) { console.assert(false); return this; }
	reconcileRandom(other: ActivationSamplePolicy) { console.assert(false); return this; }
	reconcileStraightRandom(other: ActivationSamplePolicy) { console.assert(false); return this; }
	reconcileAllCornerRandom(other: ActivationSamplePolicy) { console.assert(false); return this; }
}

export function instantiateSamplePolicy(desc: SamplePolicyDesc | undefined): ActivationSamplePolicy | undefined {
	if (desc == null) return undefined;
	switch (desc.policy) {
		case 'immediate': return ImmediatePolicy;
		case 'random': return RandomPolicy;
		case 'straight-random': return StraightRandomPolicy;
		case 'all-corner-random': return AllCornerRandomPolicy;
		case 'log-normal': return new LogNormalRandomPolicy(desc.mu, desc.sigma);
		case 'erlang': return new ErlangRandomPolicy(desc.k, desc.lambda);
		case 'fixed': return new FixedDistancePolicy(desc.pos);
	}
}

export function getActivator(selfSet: Map<string, any>, otherSet: Map<string, any> | null) {
	return function (s: RaceSolver, id: string, persp: Perspective) {
		const skillSet = persp == Perspective.Self ? selfSet : otherSet;
		if (skillSet == null) return;
		if (id == 'downhill') {
			if (!skillSet.has('downhill')) skillSet.set('downhill', 0);
			skillSet.set('downhill', skillSet.get('downhill') - s.accumulatetime.t);
		} else if (id != 'asitame' && id != 'staminasyoubu') {
			if (!skillSet.has(id)) skillSet.set(id, []);
			skillSet.get(id).push([s.pos, -1]);
		}
	};
}
export function getDeactivator(selfSet: Map<string, any>, otherSet: Map<string, any> | null, course: CourseData) {
	return function (s: RaceSolver, id: string, persp: Perspective) {
		const skillSet = persp == Perspective.Self ? selfSet : otherSet;
		if (skillSet == null) return;
		if (id == 'downhill') {
			skillSet.set('downhill', skillSet.get('downhill') + s.accumulatetime.t);
		} else if (id != 'asitame' && id != 'staminasyoubu') {
			const ar = skillSet.get(id);
			const r = ar.find((x: any) => x[1] == -1);
			if (r != null) r[1] = Math.min(s.pos, course.distance);
		}
	};
}

// CC_GLOBAL is defined in vite.config.ts and declared in global.d.ts
const CC_GLOBAL_VAL = typeof CC_GLOBAL !== 'undefined' ? CC_GLOBAL : false;

export function runComparison(nsamples: number, course: CourseData, racedef: any, uma1: HorseState, uma2: HorseState, seed: [number,number], options: any) {
	const standard = new RaceSolverBuilder(nsamples)
		.seed(...seed)
		.course(course)
		.ground(racedef.groundCondition)
		.weather(racedef.weather)
		.season(racedef.season)
		.time(racedef.time);
	if (racedef.orderRange != null) {
		standard
			.order(racedef.orderRange[0], racedef.orderRange[1])
			.numUmas(racedef.numUmas);
	}
	const compare = standard.fork();
	standard.horse(uma1 as any).pacer(uma2 as any); // using pacer for otherHorse
	compare.horse(uma2 as any).pacer(uma1 as any);
	const wisdomSeeds = new Map<string, [number,number]>();
	const wisdomRng = new Rule30CARng(...seed);
	for (let i = 0; i < 20; ++i) wisdomRng.pair();
	
	const common = Array.from(new Set([...uma1.skills.keys()].filter(x => uma2.skills.has(x)))).sort((a,b) => +a - +b);
	const commonIdx = (id: string) => { let i = common.indexOf((skillmeta as any)[id]?.groupId || id); return i > -1 ? i : common.length; };
	const sort = (a: string, b: string) => commonIdx(a) - commonIdx(b) || +a - +b;
	const u1id = uniqueSkillForUma(uma1.outfitId, uma1.starCount);
	const u2id = uniqueSkillForUma(uma2.outfitId, uma2.starCount);
	Array.from(uma1.skills.values()).sort(sort).forEach(id => {
		wisdomSeeds.set(id, wisdomRng.pair() as [number, number]);
		standard.addSkill(id, Perspective.Self, instantiateSamplePolicy(uma1.samplePolicies.get(id)));
	});
	Array.from(uma2.skills.values()).sort(sort).forEach(id => {
		wisdomSeeds.set(id, wisdomRng.pair() as [number, number]);
		compare.addSkill(id, Perspective.Self, instantiateSamplePolicy(uma2.samplePolicies.get(id)));
	});
	
	uma1.skills.forEach(id => compare.addSkill(id, Perspective.Other, instantiateSamplePolicy(uma1.samplePolicies.get(id))));
	uma2.skills.forEach(id => standard.addSkill(id, Perspective.Other, instantiateSamplePolicy(uma2.samplePolicies.get(id))));
	if (!CC_GLOBAL_VAL) {
		standard.withAsiwotameru().withStaminaSyoubu();
		compare.withAsiwotameru().withStaminaSyoubu();
	}
	if (options.usePosKeep) {
		standard.useDefaultPacer(); compare.useDefaultPacer();
	}
	if (options.useIntChecks) {
		standard.withWisdomChecks(wisdomSeeds);
		compare.withWisdomChecks(wisdomSeeds);
	}
	const skillPos1 = new Map(), skillPos2 = new Map();
	standard.onSkillActivate(getActivator(skillPos1, null));
	standard.onSkillDeactivate(getDeactivator(skillPos1, null, course));
	compare.onSkillActivate(getActivator(skillPos2, null));
	compare.onSkillDeactivate(getDeactivator(skillPos2, null, course));
	let a = standard.build(), b = compare.build();
	let ai = 1, bi = 0;
	let sign = 1;
	const diff: number[] = [];
	let min = Infinity, max = -Infinity, estMean = 0, estMedian = 0, bestMeanDiff = Infinity, bestMedianDiff = Infinity;
	let minrun: any, maxrun: any, meanrun: any, medianrun: any;
	let nspurt = [0,0];
	const sampleCutoff = Math.max(Math.floor(nsamples * 0.8), nsamples - 200);
	let retry = false;
	for (let i = 0; i < nsamples; ++i) {
		const s1 = a.next(retry).value as RaceSolver;
		const s2 = b.next(retry).value as RaceSolver;
		const data = {t: [[], []] as number[][], p: [[], []] as number[][], v: [[], []] as number[][], hp: [[], []] as number[][], sk: [null,null] as any[], sdly: [0,0], dh: [0,0]};

		while (s2.pos < course.distance) {
			s2.step(1/15);
			data.t[ai].push(s2.accumulatetime.t);
			data.p[ai].push(s2.pos);
			data.v[ai].push(s2.currentSpeed + (s2.modifiers.currentSpeed.acc + s2.modifiers.currentSpeed.err));
			data.hp[ai].push((s2.hp as GameHpPolicy).hp);
		}
		data.sdly[ai] = s2.startDelay;

		while (s1.accumulatetime.t < s2.accumulatetime.t) {
			s1.step(1/15);
			data.t[bi].push(s1.accumulatetime.t);
			data.p[bi].push(s1.pos);
			data.v[bi].push(s1.currentSpeed + (s1.modifiers.currentSpeed.acc + s1.modifiers.currentSpeed.err));
			data.hp[bi].push((s1.hp as GameHpPolicy).hp);
		}
		const pos1 = s1.pos;
		while (s1.pos < course.distance) {
			s1.step(1/15);
			data.t[bi].push(s1.accumulatetime.t);
			data.p[bi].push(s1.pos);
			data.v[bi].push(s1.currentSpeed + (s1.modifiers.currentSpeed.acc + s1.modifiers.currentSpeed.err));
			data.hp[bi].push((s1.hp as GameHpPolicy).hp);
		}
		data.sdly[bi] = s1.startDelay;

		s2.cleanup();
		s1.cleanup();

		data.dh[1] = skillPos2.get('downhill') || 0; skillPos2.delete('downhill');
		data.dh[0] = skillPos1.get('downhill') || 0; skillPos1.delete('downhill');
		data.sk[1] = new Map(skillPos2);
		skillPos2.clear();
		data.sk[0] = new Map(skillPos1);
		skillPos1.clear();

		if (s2.pos < pos1 || isNaN(pos1)) {
			[b,a] = [a,b];
			[bi,ai] = [ai,bi];
			sign *= -1;
			--i;
			retry = true;
		} else {
			retry = false;
			nspurt[bi] += +(s1.isLastSpurt && s1.lastSpurtTransition == -1);
			nspurt[ai] += +(s2.isLastSpurt && s2.lastSpurtTransition == -1);
			const basinn = sign * (s2.pos - pos1) / 2.5;
			diff.push(basinn);
			if (basinn < min) {
				min = basinn;
				minrun = data;
			}
			if (basinn > max) {
				max = basinn;
				maxrun = data;
			}
			if (i == sampleCutoff) {
				diff.sort((a,b) => a - b);
				estMean = diff.reduce((a,b) => a + b) / diff.length;
				const mid = Math.floor(diff.length / 2);
				estMedian = mid > 0 && diff.length % 2 == 0 ? (diff[mid-1] + diff[mid]) / 2 : diff[mid];
			}
			if (i >= sampleCutoff) {
				const meanDiff = Math.abs(basinn - estMean), medianDiff = Math.abs(basinn - estMedian);
				if (meanDiff < bestMeanDiff) {
					bestMeanDiff = meanDiff;
					meanrun = data;
				}
				if (medianDiff < bestMedianDiff) {
					bestMedianDiff = medianDiff;
					medianrun = data;
				}
			}
		}
	}
	diff.sort((a,b) => a - b);
	return {results: diff, runData: {nspurt, minrun, maxrun, meanrun, medianrun}};
}
