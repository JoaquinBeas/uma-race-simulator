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

export function runComparison(nsamples: number, course: CourseData, racedef: any, umas: HorseState[], seed: [number,number], options: any) {
    const baseBuilder = new RaceSolverBuilder(nsamples)
        .seed(...seed)
        .course(course)
        .ground(racedef.groundCondition)
        .weather(racedef.weather)
        .season(racedef.season)
        .time(racedef.time);
    if (racedef.orderRange != null) {
        baseBuilder
            .order(racedef.orderRange[0], racedef.orderRange[1])
            .numUmas(racedef.numUmas);
    }
    
    const builders = umas.map(() => baseBuilder.fork());
    
    for (let i = 0; i < umas.length; i++) {
        const uma = umas[i];
        const pacerUma = umas[(i + 1) % umas.length];
        
        const getAptitudes = (u: any) => {
            const stratIdx = ['Nige', 'Senkou', 'Sasi', 'Oikomi'].indexOf(u.strategy === 'Oonige' ? 'Nige' : u.strategy);
            return {
                ...u,
                distanceAptitude: u.aptitudes[course.distanceType - 1],
                surfaceAptitude: u.aptitudes[course.surface + 7],
                strategyAptitude: u.aptitudes[stratIdx !== -1 ? stratIdx + 4 : 4]
            };
        };

        builders[i].horse(getAptitudes(uma) as any).pacer(getAptitudes(pacerUma) as any).mood(uma.mood).popularity(uma.popularity);
        builders[i].otherRawWisdom(pacerUma.wisdom, pacerUma.mood);
    }
    
    const wisdomSeeds = new Map<string, [number,number]>();
    const wisdomRng = new Rule30CARng(...seed);
    for (let i = 0; i < 20; ++i) wisdomRng.pair();
    
    const allSkills = new Set<string>();
    umas.forEach(uma => uma.skills.forEach(id => allSkills.add(id)));
    const common = Array.from(allSkills).sort((a,b) => +a - +b);
    const commonIdx = (id: string) => { let i = common.indexOf((skillmeta as any)[id]?.groupId || id); return i > -1 ? i : common.length; };
    const sort = (a: string, b: string) => commonIdx(a) - commonIdx(b) || +a - +b;
    
    umas.forEach((uma, i) => {
        Array.from(uma.skills.values()).sort(sort).forEach(id => {
            if (!wisdomSeeds.has(id)) {
                wisdomSeeds.set(id, wisdomRng.pair() as [number, number]);
            }
            builders[i].addSkill(id, Perspective.Self, instantiateSamplePolicy(uma.samplePolicies.get(id)));
        });
        
        umas.forEach((otherUma, j) => {
            if (i !== j) {
                otherUma.skills.forEach(id => {
                    builders[i].addSkill(id, Perspective.Other, instantiateSamplePolicy(otherUma.samplePolicies.get(id)));
                });
            }
        });
    });
    
    builders.forEach(builder => {
        if (!CC_GLOBAL_VAL) {
            builder.withAsiwotameru().withStaminaSyoubu();
        }
        if (options.usePosKeep) {
            builder.useDefaultPacer();
        }
        if (options.useIntChecks) {
            builder.withWisdomChecks(wisdomSeeds);
        }
        if (options.forceFullSpurt) {
            builder.withForceFullSpurt();
        }
        if (options.forceInnateSkillActivation) {
            builder.withForceInnateSkillActivation();
        }
    });

    const skillPosMaps = umas.map(() => new Map());
    builders.forEach((builder, i) => {
        builder.onSkillActivate(getActivator(skillPosMaps[i], null));
        builder.onSkillDeactivate(getDeactivator(skillPosMaps[i], null, course));
    });

    const generators = builders.map(b => b.build());
    
    let min = Infinity, max = -Infinity, estMean = 0, estMedian = 0, bestMeanDiff = Infinity, bestMedianDiff = Infinity;
    let minrun: any, maxrun: any, meanrun: any, medianrun: any;
    let nspurt = new Array(umas.length).fill(0);
    let wins = new Array(umas.length).fill(0);
    let tiesCount = 0;
    
    const aggregateStats = {
        finalHp: umas.map(() => [] as number[]),
        startDelays: umas.map(() => [] as number[]),
        topSpeeds: umas.map(() => [] as number[]),
        lengths: umas.map(() => [] as number[]),
        skillStats: umas.map(() => new Map<string, {count: number, posSum: number}>()),
        overtakes: umas.map(() => 0)
    };
    
    const sampleCutoff = Math.max(Math.floor(nsamples * 0.8), nsamples - 200);
    let retry = false;
    const diff: number[] = [];

    for (let i = 0; i < nsamples; ++i) {
        const solvers = generators.map(g => g.next(retry).value as RaceSolver);
        const data = {
            t: umas.map(() => [] as number[]),
            p: umas.map(() => [] as number[]),
            v: umas.map(() => [] as number[]),
            hp: umas.map(() => [] as number[]),
            sk: umas.map(() => null as any),
            sdly: umas.map(() => 0),
            dh: umas.map(() => 0)
        };

        // Step all solvers until they finish
        let allFinished = false;
        while (!allFinished) {
            allFinished = true;
            for (let j = 0; j < solvers.length; j++) {
                const s = solvers[j];
                if (s.pos < course.distance) {
                    allFinished = false;
                    s.step(1/15);
                    data.t[j].push(s.accumulatetime.t);
                    data.p[j].push(s.pos);
                    data.v[j].push(s.currentSpeed + (s.modifiers.currentSpeed.acc + s.modifiers.currentSpeed.err));
                    data.hp[j].push((s.hp as GameHpPolicy).hp);
                }
            }
        }

        for (let j = 0; j < solvers.length; j++) {
            const s = solvers[j];
            data.sdly[j] = s.startDelay;
            s.cleanup();
            
            data.dh[j] = skillPosMaps[j].get('downhill') || 0; 
            skillPosMaps[j].delete('downhill');
            data.sk[j] = new Map(skillPosMaps[j]);
            skillPosMaps[j].clear();

            aggregateStats.finalHp[j].push(data.hp[j][data.hp[j].length - 1]);
            aggregateStats.startDelays[j].push(data.sdly[j]);
            aggregateStats.topSpeeds[j].push(Math.max(...data.v[j]));

            data.sk[j].forEach((val: any, id: string) => {
                if (id === 'downhill') return;
                const stats = aggregateStats.skillStats[j].get(id) || {count: 0, posSum: 0};
                stats.count++;
                if (Array.isArray(val) && val.length > 0) {
                    stats.posSum += val[0][0];
                }
                aggregateStats.skillStats[j].set(id, stats);
            });
        }

        const openingLegEnd = course.distance / 6;
        const numUmas = solvers.length;
        const minLen = Math.min(...data.p.map(p => p.length));
        
        // Track relative positions: isAhead[j][m] is true if j is ahead of m
        const isAhead = Array.from({ length: numUmas }, () => new Uint8Array(numUmas));
        for (let j = 0; j < numUmas; j++) {
            for (let m = 0; m < numUmas; m++) {
                if (j !== m && data.p[j][0] > data.p[m][0]) {
                    isAhead[j][m] = 1;
                }
            }
        }

        for (let k = 1; k < minLen; k++) {
            for (let j = 0; j < numUmas; j++) {
                const posJ = data.p[j][k];
                for (let m = j + 1; m < numUmas; m++) {
                    const posM = data.p[m][k];
                    const currentlyAhead = posJ > posM;
                    
                    if (currentlyAhead !== !!isAhead[j][m]) {
                        // A change in relative position occurred
                        if (posJ >= openingLegEnd || posM >= openingLegEnd) {
                            if (currentlyAhead) {
                                // j overtook m
                                aggregateStats.overtakes[j]++;
                            } else {
                                // m overtook j
                                aggregateStats.overtakes[m]++;
                            }
                        }
                        isAhead[j][m] = currentlyAhead ? 1 : 0;
                        isAhead[m][j] = currentlyAhead ? 0 : 1;
                    }
                }
            }
        }

        // Check if any solver failed to complete properly
        let anyFailed = false;
        for (let j = 0; j < solvers.length; j++) {
            if (isNaN(data.p[j][data.p[j].length - 1])) {
                anyFailed = true;
                break;
            }
        }

        if (anyFailed) {
            --i;
            retry = true;
        } else {
            retry = false;
            for (let j = 0; j < solvers.length; j++) {
                nspurt[j] += +(solvers[j].isLastSpurt && solvers[j].lastSpurtTransition == -1);
            }
            
            // Find the winner (minimum time)
            const finishTimes = data.t.map(tArr => tArr[tArr.length - 1]);
            const sortedTimes = [...finishTimes].sort((a, b) => a - b);
            const minTime = sortedTimes[0];
            const secondMinTime = sortedTimes.length > 1 ? sortedTimes[1] : minTime;

            for (let j = 0; j < solvers.length; j++) {
                let lengthVal = 0;
                if (finishTimes[j] === minTime) {
                    lengthVal = (secondMinTime - minTime) * 8;
                } else {
                    lengthVal = (minTime - finishTimes[j]) * 8;
                }
                aggregateStats.lengths[j].push(lengthVal);
            }
            
            const tiedWinners = [];
            for (let j = 0; j < solvers.length; j++) {
                if (Math.abs(finishTimes[j] - minTime) <= 0.001) {
                    tiedWinners.push(j);
                }
            }
            
            if (tiedWinners.length > 1) {
                tiesCount++;
                for (const winnerIdx of tiedWinners) {
                    wins[winnerIdx]++;
                }
            } else if (tiedWinners.length === 1) {
                wins[tiedWinners[0]]++;
            }

            // Calculate basinn for the first two umas for backwards compatibility of the diff array
            let basinn = 0;
            if (solvers.length >= 2) {
                const timeDiff = data.t[1][data.t[1].length - 1] - data.t[0][data.t[0].length - 1];
                basinn = (timeDiff * 20) / 2.5;
            }
            
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
    return {
        results: diff,
        wins,
        ties: tiesCount,
        runData: {nspurt, minrun, maxrun, meanrun, medianrun},
        aggregateStats: {
            ...aggregateStats,
            fullSpurtRate: nspurt.map(n => n / nsamples),
            overtakes: aggregateStats.overtakes.map(o => o / nsamples)
        }
    };
}
