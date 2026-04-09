function assert(condition: any, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message || "Assertion failed");
	}
}

import { HorseParameters, Strategy, Aptitude } from './HorseTypes';
import { CourseData, CourseHelpers, DistanceType } from './CourseData';
import { Region, RegionList } from './Region';
import { PRNG, Rule30CARng } from './Random';
import { Conditions, random, immediate, noopRandom } from './ActivationConditions';
import { ActivationSamplePolicy, ImmediatePolicy } from './ActivationSamplePolicy';
import { getParser } from './ConditionParser';
import { RaceSolver, RaceState, PendingSkill, DynamicCondition, SkillType, SkillRarity, SkillEffect, Perspective } from './RaceSolver';
import { Mood, GroundCondition, Weather, Season, Time, Grade, RaceParameters } from './RaceParameters';
import { HpPolicy, GameHpPolicy, NoopHpPolicy } from './HpPolicy';

import skills from './data/skill_data.json';

export type PartialRaceParameters = Omit<{ -readonly [K in keyof RaceParameters]: RaceParameters[K] }, 'skillId'>;

export interface HorseDesc {
	speed: number
	stamina: number
	power: number
	guts: number
	wisdom: number
	strategy: string | Strategy
	distanceAptitude: string | Aptitude
	surfaceAptitude: string | Aptitude
	strategyAptitude: string | Aptitude
}

const GroundSpeedModifier = Object.freeze([
	null, // ground types started at 1
	[0, 0, 0, 0, -50],
	[0, 0, 0, 0, -50]
].map(o => Object.freeze(o)));

const GroundPowerModifier = Object.freeze([
	null,
	[0, 0, -50, -50, -50],
	[0, -100, -50, -100, -100]
].map(o => Object.freeze(o)));

const StrategyProficiencyModifier = Object.freeze([1.1, 1.0, 0.85, 0.75, 0.6, 0.4, 0.2, 0.1]);

namespace Asitame {
	export const StrategyDistanceCoefficient = Object.freeze([
		[],
		[0, 1.0, 0.7, 0.75, 0.7, 1.0],
		[0, 1.0, 0.8, 0.7, 0.75, 1.0],
		[0, 1.0, 0.9, 0.875, 0.86, 1.0],
		[0, 1.0, 0.9, 1.0, 0.9, 1.0]
	]);

	export const BaseModifier = 0.00875;

	export function calcApproximateModifier(power: number, strategy: Strategy, distance: DistanceType) {
		return BaseModifier * Math.sqrt(power - 1200) * StrategyDistanceCoefficient[distance][strategy];
	}
}

namespace StaminaSyoubu {
	export function distanceFactor(distance: number) {
		if (distance < 2101) return 0.0;
		else if (distance < 2201) return 0.5;
		else if (distance < 2401) return 1.0;
		else if (distance < 2601) return 1.2;
		else return 1.5;
	}

	export function calcApproximateModifier(stamina: number, distance: number) {
		const randomFactor = 1.0;
		return Math.sqrt(stamina - 1200) * 0.0085 * distanceFactor(distance) * randomFactor;
	}
}

export function parseStrategy(s: string | Strategy) {
	if (typeof s != 'string') {
		return s;
	}
	switch (s.toUpperCase()) {
		case 'NIGE': return Strategy.Nige;
		case 'SENKOU': return Strategy.Senkou;
		case 'SASI':
		case 'SASHI': return Strategy.Sasi;
		case 'OIKOMI': return Strategy.Oikomi;
		case 'OONIGE': return Strategy.Oonige;
		default: throw new Error('Invalid running strategy.');
	}
}

export function parseAptitude(a: string | Aptitude, type: string) {
	if (typeof a != 'string') {
		return a;
	}
	switch (a.toUpperCase()) {
		case 'S': return Aptitude.S;
		case 'A': return Aptitude.A;
		case 'B': return Aptitude.B;
		case 'C': return Aptitude.C;
		case 'D': return Aptitude.D;
		case 'E': return Aptitude.E;
		case 'F': return Aptitude.F;
		case 'G': return Aptitude.G;
		default: throw new Error('Invalid ' + type + ' aptitude.');
	}
}

export function parseGroundCondition(g: string | GroundCondition) {
	if (typeof g != 'string') {
		return g;
	}
	switch (g.toUpperCase()) {
		case 'GOOD': return GroundCondition.Good;
		case 'YIELDING': return GroundCondition.Yielding;
		case 'SOFT': return GroundCondition.Soft;
		case 'HEAVY': return GroundCondition.Heavy;
		default: throw new Error('Invalid ground condition.');
	}
}

export function parseWeather(w: string | Weather) {
	if (typeof w != 'string') {
		return w;
	}
	switch (w.toUpperCase()) {
		case 'SUNNY': return Weather.Sunny;
		case 'CLOUDY': return Weather.Cloudy;
		case 'RAINY': return Weather.Rainy;
		case 'SNOWY': return Weather.Snowy;
		default: throw new Error('Invalid weather.');
	}
}

export function parseSeason(s: string | Season) {
	if (typeof s != 'string') {
		return s;
	}
	switch (s.toUpperCase()) {
		case 'SPRING': return Season.Spring;
		case 'SUMMER': return Season.Summer;
		case 'AUTUMN': return Season.Autumn;
		case 'WINTER': return Season.Winter;
		case 'SAKURA': return Season.Sakura;
		default: throw new Error('Invalid season.');
	}
}

export function parseTime(t: string | Time) {
	if (typeof t != 'string') {
		return t;
	}
	switch (t.toUpperCase()) {
		case 'NONE': case 'NOTIME': return Time.NoTime;
		case 'MORNING': return Time.Morning;
		case 'MIDDAY': return Time.Midday;
		case 'EVENING': return Time.Evening;
		case 'NIGHT': return Time.Night;
		default: throw new Error('Invalid race time.');
	}
}

export function parseGrade(g: string | Grade) {
	if (typeof g != 'string') {
		return g;
	}
	switch (g.toUpperCase()) {
		case 'G1': return Grade.G1;
		case 'G2': return Grade.G2;
		case 'G3': return Grade.G3;
		case 'OP': return Grade.OP;
		case 'PRE-OP': case 'PREOP': return Grade.PreOP;
		case 'MAIDEN': return Grade.Maiden;
		case 'DEBUT': return Grade.Debut;
		case 'DAILY': return Grade.Daily;
		default: throw new Error('Invalid race grade.');
	}
}

function adjustOvercap(stat: number) {
	return stat > 1200 ? 1200 + Math.floor((stat - 1200) / 2) : stat;
}

export function buildBaseStats(horseDesc: HorseDesc, mood: Mood) {
	const motivCoef = 1 + 0.02 * mood;

	return Object.freeze({
		speed: adjustOvercap(horseDesc.speed) * motivCoef,
		stamina: adjustOvercap(horseDesc.stamina) * motivCoef,
		power: adjustOvercap(horseDesc.power) * motivCoef,
		guts: adjustOvercap(horseDesc.guts) * motivCoef,
		wisdom: adjustOvercap(horseDesc.wisdom) * motivCoef,
		strategy: parseStrategy(horseDesc.strategy),
		distanceAptitude: parseAptitude(horseDesc.distanceAptitude, 'distance'),
		surfaceAptitude: parseAptitude(horseDesc.surfaceAptitude, 'surface'),
		strategyAptitude: parseAptitude(horseDesc.strategyAptitude, 'strategy'),
		rawStamina: horseDesc.stamina * motivCoef
	});
}

export function buildAdjustedStats(baseStats: HorseParameters, course: CourseData, ground: GroundCondition) {
	const raceCourseModifier = CourseHelpers.courseSpeedModifier(course, baseStats);

	return Object.freeze({
		speed: Math.max(baseStats.speed * raceCourseModifier + GroundSpeedModifier[course.surface][ground], 1),
		stamina: baseStats.stamina,
		power: Math.max(baseStats.power + GroundPowerModifier[course.surface][ground], 1),
		guts: baseStats.guts,
		wisdom: baseStats.wisdom * StrategyProficiencyModifier[baseStats.strategyAptitude],
		strategy: baseStats.strategy,
		distanceAptitude: baseStats.distanceAptitude,
		surfaceAptitude: baseStats.surfaceAptitude,
		strategyAptitude: baseStats.strategyAptitude,
		rawStamina: baseStats.rawStamina
	});
}

export enum SkillTarget {
	Self = 1,
	All = 2,
	InFov = 4,
	AheadOfPosition = 7,
	AheadOfSelf = 9,
	BehindSelf = 10,
	AllAllies = 11,
	EnemyStrategy = 18,
	KakariAhead = 19,
	KakariBehind = 20,
	KakariStrategy = 21,
	UmaId = 22,
	UsedRecovery = 23
}

export { Perspective } from './RaceSolver';

export interface SkillData {
	skillId: string
	perspective?: Perspective
	rarity: SkillRarity
	wisdomCheck: boolean
	samplePolicy: ActivationSamplePolicy
	regions: RegionList
	extraCondition: DynamicCondition
	effects: SkillEffect[]
}

function isTarget(self: Perspective, targetType: SkillTarget) {
	return targetType == SkillTarget.All || self == Perspective.Any || ((self == Perspective.Self) == (targetType == SkillTarget.Self));
}

function buildSkillEffects(skill, perspective: Perspective) {
	return skill.effects.map(ef => ({
		type: (ef.type in SkillType) && isTarget(perspective, ef.target) ? ef.type : SkillType.Noop,
		baseDuration: skill.baseDuration / 10000,
		modifier: ef.modifier / 10000
	}));
}

export function buildSkillData(horse: HorseParameters, raceParams: PartialRaceParameters, course: CourseData, wholeCourse: RegionList, parser: { parse: any, tokenize: any }, skillId: string, perspective: Perspective, ignoreNullEffects: boolean = false) {
	if (!(skillId in skills)) {
		throw new Error('bad skill ID ' + skillId);
	}
	const extra = Object.assign({ skillId }, raceParams);
	const alternatives = skills[skillId].alternatives;
	const triggers = [];
	for (let i = 0; i < alternatives.length; ++i) {
		const skill = alternatives[i];
		let full = new RegionList();
		wholeCourse.forEach(r => full.push(r));
		if (skill.precondition) {
			const pre = parser.parse(parser.tokenize(skill.precondition));
			const preRegions = pre.apply(wholeCourse, course, horse, extra)[0];
			if (preRegions.length == 0) {
				continue;
			} else {
				const bounds = new Region(preRegions[0].start, wholeCourse[wholeCourse.length - 1].end);
				full = full.rmap(r => r.intersect(bounds));
			}
		}

		const op = parser.parse(parser.tokenize(skill.condition));
		const [regions, extraCondition] = op.apply(full, course, horse, extra);
		if (regions.length == 0) {
			continue;
		}
		if (triggers.length > 0 && !/is_activate_other_skill_detail|is_used_skill_id/.test(skill.condition)) {
			continue;
		}
		const effects = buildSkillEffects(skill, perspective);
		if (effects.length > 0 || ignoreNullEffects) {
			const rarity = skills[skillId].rarity;
			triggers.push({
				skillId: skillId,
				perspective: perspective,
				rarity: rarity >= 3 && rarity <= 5 ? 3 : rarity,
				wisdomCheck: skills[skillId].wisdomCheck,
				samplePolicy: op.samplePolicy,
				regions: regions,
				extraCondition: extraCondition,
				effects: effects
			});
		}
	}
	if (triggers.length > 0) return triggers;
	const effects = buildSkillEffects(alternatives[0], perspective);
	if (effects.length == 0 && !ignoreNullEffects) {
		return [];
	} else {
		const rarity = skills[skillId].rarity;
		const afterEnd = new RegionList();
		afterEnd.push(new Region(9999, 9999));
		return [{
			skillId: skillId,
			perspective: perspective,
			rarity: rarity >= 3 && rarity <= 5 ? 3 : rarity,
			wisdomCheck: skills[skillId].wisdomCheck,
			samplePolicy: ImmediatePolicy,
			regions: afterEnd,
			extraCondition: (_) => false,
			effects: effects
		}];
	}
}

export const conditionsWithActivateCountsAsRandom = Object.freeze(Object.assign({}, Conditions, {
	activate_count_all: random({
		filterGte(regions: RegionList, n: number, course: CourseData, _1: HorseParameters, extra: RaceParameters) {
			if (n == 7) {
				const rl = new RegionList();
				regions.forEach(r => rl.push(new Region(r.start, r.start + 11)));
				return rl;
			}
			const bounds = new Region(Math.min(n / 23.0 - 0.2, 0.6) * course.distance, Math.min(n / 23.0 + 0.2, 1.0) * course.distance);
			return regions.rmap(r => r.intersect(bounds));
		},
		filterLte(regions: RegionList, n: number, course: CourseData, _1: HorseParameters, extra: RaceParameters) {
			return new RegionList();
		}
	}),
	activate_count_end_after: random({
		filterGte(regions: RegionList, _0: number, course: CourseData, _1: HorseParameters, extra: RaceParameters) {
			const bounds = new Region(CourseHelpers.phaseStart(course.distance, 2), CourseHelpers.phaseEnd(course.distance, 3));
			return regions.rmap(r => r.intersect(bounds));
		}
	}),
	activate_count_heal: noopRandom,
	activate_count_later_half: random({
		filterGte(regions: RegionList, _0: number, course: CourseData, _1: HorseParameters, extra: RaceParameters) {
			const bounds = new Region(course.distance / 2, course.distance);
			return regions.rmap(r => r.intersect(bounds));
		}
	}),
	activate_count_middle: random({
		filterGte(regions: RegionList, n: number, course: CourseData, _1: HorseParameters, extra: RaceParameters) {
			const start = CourseHelpers.phaseStart(course.distance, 1), end = CourseHelpers.phaseEnd(course.distance, 1);
			const bounds = new Region(start, start + n / 10 * (end - start));
			return regions.rmap(r => r.intersect(bounds));
		}
	}),
	activate_count_start: immediate({
		filterGte(regions: RegionList, _0: number, course: CourseData, _1: HorseParameters, extra: RaceParameters) {
			const bounds = new Region(CourseHelpers.phaseStart(course.distance, 0), CourseHelpers.phaseEnd(course.distance, 0));
			return regions.rmap(r => r.intersect(bounds));
		}
	})
}));

const defaultParser = getParser();
const acrParser = getParser(conditionsWithActivateCountsAsRandom);

export class RaceSolverBuilder {
	_course: CourseData | null
	_raceParams: PartialRaceParameters
	_horse: HorseDesc | null
	_pacer: HorseDesc | null
	_pacerSkills: PendingSkill[]
	_rng: Rule30CARng
	_parser: { parse: any, tokenize: any }
	_skills: { id: string, p: Perspective }[]
	_wisdomSeeds: Map<string, [number, number]>
	_useWisdomChecks: boolean
	_forceFullSpurt: boolean
	_forceInnateSkillActivation: boolean
	_otherRawWisdom: number
	_otherMood: Mood
	_hpPolicyFactory: (course: CourseData, params: PartialRaceParameters, rng: PRNG) => HpPolicy
	_samplePolicyOverride: Map<string, ActivationSamplePolicy>[]
	_extraSkillHooks: ((skilldata: SkillData[], horse: HorseParameters, course: CourseData) => void)[]
	_onSkillActivate: (state: RaceSolver, skillId: string, perspective: Perspective) => void
	_onSkillDeactivate: (state: RaceSolver, skillId: string, perspective: Perspective) => void

	constructor(readonly nsamples: number) {
		this._course = null;
		this._raceParams = {
			mood: 2,
			groundCondition: GroundCondition.Good,
			weather: Weather.Sunny,
			season: Season.Spring,
			time: Time.Midday,
			grade: Grade.G1,
			popularity: 1
		};
		this._horse = null;
		this._pacer = null;
		this._pacerSkills = [];
		this._rng = new Rule30CARng(Math.floor(Math.random() * (-1 >>> 0)) >>> 0);
		this._parser = defaultParser;
		this._skills = [];
		this._wisdomSeeds = new Map();
		this._useWisdomChecks = false;
		this._forceFullSpurt = false;
		this._forceInnateSkillActivation = false;
		this._otherRawWisdom = 2000;
		this._otherMood = 2;
		this._hpPolicyFactory = (course, params, rng) => new GameHpPolicy(course, params.groundCondition, rng);
		this._samplePolicyOverride = [null, new Map(), new Map(), new Map()];
		this._extraSkillHooks = [];
		this._onSkillActivate = null;
		this._onSkillDeactivate = null;
	}

	seed(lo: number, hi: number = 0) {
		this._rng = new Rule30CARng(lo, hi);
		return this;
	}

	course(course: number | string | CourseData) {
		if (typeof course == 'number' || typeof course == 'string') {
			this._course = CourseHelpers.getCourse(course);
		} else {
			this._course = course;
		}
		return this;
	}

	mood(mood: Mood) {
		this._raceParams.mood = mood;
		return this;
	}

	ground(ground: string | GroundCondition) {
		this._raceParams.groundCondition = parseGroundCondition(ground);
		return this;
	}

	weather(weather: string | Weather) {
		this._raceParams.weather = parseWeather(weather);
		return this;
	}

	season(season: string | Season) {
		this._raceParams.season = parseSeason(season);
		return this;
	}

	time(time: string | Time) {
		this._raceParams.time = parseTime(time);
		return this;
	}

	grade(grade: string | Grade) {
		this._raceParams.grade = parseGrade(grade);
		return this;
	}

	popularity(popularity: number) {
		this._raceParams.popularity = popularity;
		return this;
	}

	order(start: number, end: number) {
		this._raceParams.orderRange = [start, end];
		return this;
	}

	numUmas(n: number) {
		this._raceParams.numUmas = n;
		return this;
	}

	horse(horse: HorseDesc) {
		this._horse = horse;
		return this;
	}

	pacer(horse: HorseDesc) {
		this._pacer = horse;
		return this;
	}

	_isNige() {
		if (typeof this._horse.strategy == 'string') {
			return this._horse.strategy.toUpperCase() == 'NIGE' || this._horse.strategy.toUpperCase() == 'OONIGE';
		} else {
			return this._horse.strategy == Strategy.Nige || this._horse.strategy == Strategy.Oonige;
		}
	}

	useDefaultPacer(openingLegAccel: boolean = true) {
		if (this._isNige()) {
			return this;
		}

		this._pacer = Object.assign({}, this._horse, { strategy: 'Nige' });
		if (openingLegAccel) {
			this._pacerSkills = [{
				skillId: '201601',
				perspective: Perspective.Self,
				rarity: SkillRarity.White,
				trigger: new Region(0, 100),
				extraCondition: (s: RaceState) => s.activateCount[0] >= 3 && s.pos > 0,
				effects: [{ type: SkillType.Accel, baseDuration: 3.0, modifier: 0.2 }]
			}, {
				skillId: '200532',
				perspective: Perspective.Self,
				rarity: SkillRarity.White,
				trigger: new Region(1, 100),
				extraCondition: (s: RaceState) => s.horse.strategy == Strategy.Nige && s.phase == 0 && s.pos > 0,
				effects: [{ type: SkillType.Accel, baseDuration: 1.2, modifier: 0.2 }]
			}];
		}
		return this;
	}

	hpPolicyFactory(fn: (course: CourseData, params: PartialRaceParameters, rng: PRNG) => HpPolicy) {
		this._hpPolicyFactory = fn;
		return this;
	}

	withActivateCountsAsRandom() {
		this._parser = acrParser;
		return this;
	}

	withAsiwotameru() {
		const baseDisplayedPower = this._horse.power * (1 + 0.02 * this._raceParams.mood);
		this._extraSkillHooks.push((skilldata, horse, course) => {
			const power = skilldata.reduce((acc, sd) => {
				const powerUp = sd.effects.find(ef => ef.type == SkillType.PowerUp);
				if (powerUp && sd.regions.length > 0 && sd.regions[0].start < 9999) {
					return acc + powerUp.modifier;
				} else {
					return acc;
				}
			}, baseDisplayedPower);

			if (power > 1200) {
				const spurtStart = new RegionList();
				spurtStart.push(new Region(CourseHelpers.phaseStart(course.distance, 2), course.distance));
				skilldata.push({
					skillId: 'asitame',
					perspective: Perspective.Self,
					rarity: SkillRarity.White,
					wisdomCheck: false,
					regions: spurtStart,
					samplePolicy: ImmediatePolicy,
					extraCondition: (_) => true,
					effects: [{
						type: SkillType.Accel,
						baseDuration: 3.0 / (course.distance / 1000.0),
						modifier: Asitame.calcApproximateModifier(power, horse.strategy, course.distanceType)
					}]
				});
			}
		});
		return this;
	}

	withStaminaSyoubu() {
		this._extraSkillHooks.push((skilldata, horse, course) => {
			const stamina = skilldata.reduce((acc, sd) => {
				const staminaUp = sd.effects.find(ef => ef.type == SkillType.StaminaUp);
				if (staminaUp && sd.regions.length > 0 && sd.regions[0].start < 9999) {
					return acc + staminaUp.modifier;
				} else {
					return acc;
				}
			}, horse.rawStamina);

			if (stamina > 1200) {
				const spurtStart = new RegionList();
				spurtStart.push(new Region(CourseHelpers.phaseStart(course.distance, 2), course.distance));
				skilldata.push({
					skillId: 'staminasyoubu',
					perspective: Perspective.Self,
					rarity: SkillRarity.White,
					wisdomCheck: false,
					regions: spurtStart,
					samplePolicy: ImmediatePolicy,
					extraCondition: (s: RaceState) => s.currentSpeed >= s.lastSpurtSpeed,
					effects: [{
						type: SkillType.TargetSpeed,
						baseDuration: 9999.0,
						modifier: StaminaSyoubu.calcApproximateModifier(stamina, course.distance)
					}]
				});
			}
		});
		return this;
	}

	withWisdomChecks(seeds: ReadonlyMap<string, [number, number]>) {
		this._useWisdomChecks = true;
		seeds.forEach((seed, id) => this._wisdomSeeds.set(id, seed));
		return this;
	}

	withForceFullSpurt() {
		this._forceFullSpurt = true;
		return this;
	}

	withForceInnateSkillActivation() {
		this._forceInnateSkillActivation = true;
		return this;
	}

	otherRawWisdom(wisdom: number, mood?: Mood) {
		this._otherRawWisdom = wisdom;
		this._otherMood = mood != null ? mood : this._raceParams.mood;
		return this;
	}

	addSkill(skillId: string, perspective: Perspective = Perspective.Self, samplePolicy?: ActivationSamplePolicy) {
		this._skills.push({ id: skillId, p: perspective });
		if (samplePolicy != null) {
			this._samplePolicyOverride[perspective].set(skillId, samplePolicy);
		}
		return this;
	}

	onSkillActivate(cb: (state: RaceSolver, skillId: string, perspective: Perspective) => void) {
		this._onSkillActivate = cb;
		return this;
	}

	onSkillDeactivate(cb: (state: RaceSolver, skillId: string, perspective: Perspective) => void) {
		this._onSkillDeactivate = cb;
		return this;
	}

	fork() {
		const clone = new RaceSolverBuilder(this.nsamples);
		clone._course = this._course;
		clone._raceParams = Object.assign({}, this._raceParams);
		clone._horse = this._horse;
		clone._pacer = this._pacer;
		clone._pacerSkills = this._pacerSkills.slice();
		clone._rng = new Rule30CARng(this._rng.lo, this._rng.hi);
		clone._parser = this._parser;
		clone._skills = this._skills.slice();
		clone._useWisdomChecks = this._useWisdomChecks;
		clone._forceFullSpurt = this._forceFullSpurt;
		clone._forceInnateSkillActivation = this._forceInnateSkillActivation;
		clone._wisdomSeeds = new Map(this._wisdomSeeds.entries());
		clone._otherRawWisdom = this._otherRawWisdom;
		clone._otherMood = this._otherMood;
		clone._hpPolicyFactory = this._hpPolicyFactory;
		clone._samplePolicyOverride = this._samplePolicyOverride.map(m => m == null ? null : new Map(m.entries()));
		clone._onSkillActivate = this._onSkillActivate;
		clone._onSkillDeactivate = this._onSkillDeactivate;

		clone._extraSkillHooks = this._extraSkillHooks.slice();
		return clone;
	}

	*build() {
		let horse = buildBaseStats(this._horse, this._raceParams.mood);
		let solverRng = new Rule30CARng(this._rng.int32());
		let pacerRng = new Rule30CARng(this._rng.int32());

		const pacerHorse = this._pacer ? buildAdjustedStats(buildBaseStats(this._pacer, this._raceParams.mood), this._course, this._raceParams.groundCondition) : null;

		const wholeCourse = new RegionList();
		wholeCourse.push(new Region(0, this._course.distance));
		Object.freeze(wholeCourse);

		const otherBaseWisdom = adjustOvercap(this._otherRawWisdom) * (1 + 0.02 * this._otherMood);
		const skillActivationChance = [0.0, Math.max(1 - 90 / horse.wisdom, 0.2), Math.max(1 - 90 / otherBaseWisdom, 0.2), 1.0];
		const extraContext = {
			mood: this._raceParams.mood,
			weather: this._raceParams.weather,
			season: this._raceParams.season,
			groundCondition: this._raceParams.groundCondition,
			grade: this._raceParams.grade,
			popularity: this._raceParams.popularity,
			orderRange: this._raceParams.orderRange,
			numUmas: this._raceParams.numUmas
		};
		const makeSkill = buildSkillData.bind(null, horse, this._raceParams, this._course, wholeCourse, this._parser);
		const skilldata = this._skills.flatMap(({ id, p }) => makeSkill(id, p));
		this._extraSkillHooks.forEach(h => h(skilldata, horse, this._course));
		const triggers = skilldata.map(sd => {
			const sp = this._samplePolicyOverride[sd.perspective].get(sd.skillId) || sd.samplePolicy;
			return sp.sample(sd.regions, this.nsamples, this._rng)
		});
		const wisdomRngs = new Map(Array.from(this._wisdomSeeds.entries()).map(([id, seed]) => [id, new Rule30CARng(...seed)]));

		horse = buildAdjustedStats(horse, this._course, this._raceParams.groundCondition);

		let lastskills = null;
		for (let i = 0; i < this.nsamples; ++i) {
			let skills;
			if (lastskills != null) {
				skills = lastskills;
				lastskills = null;
			} else {
				skills = skilldata.map((sd, sdi) => ({
					skillId: sd.skillId,
					perspective: sd.perspective,
					rarity: sd.rarity,
					wisdomCheck: sd.wisdomCheck,
					trigger: triggers[sdi].length > 0 ? triggers[sdi][i % triggers[sdi].length] : new Region(9999, 9999),
					extraCondition: sd.extraCondition,
					effects: sd.effects
				})).filter(sd => !this._useWisdomChecks || !sd.wisdomCheck || wisdomRngs.get(sd.skillId).random() < skillActivationChance[sd.perspective]);
			}

			const backupPacerRng = new Rule30CARng(pacerRng.lo, pacerRng.hi);
			const backupSolverRng = new Rule30CARng(solverRng.lo, solverRng.hi);

			const [start, end] = this._raceParams.orderRange || [1, 1];
			const order = Math.floor(solverRng.random() * (end - start + 1)) + start;
			const numUmas = this._raceParams.numUmas || 9;

			const pacer = pacerHorse ? new RaceSolver({
				horse: pacerHorse,
				course: this._course,
				hp: NoopHpPolicy,
				skills: this._pacerSkills,
				rng: pacerRng,
				forceFullSpurt: this._forceFullSpurt,
				forceInnateSkillActivation: this._forceInnateSkillActivation,
				isPacer: true
			}) : null;

			const redo: boolean = yield new RaceSolver({
				horse,
				course: this._course,
				skills,
				pacer,
				hp: this._hpPolicyFactory(this._course, this._raceParams, new Rule30CARng(solverRng.int32())),
				rng: solverRng,
				forceFullSpurt: this._forceFullSpurt,
				forceInnateSkillActivation: this._forceInnateSkillActivation,
				order,
				numUmas,
				onSkillActivate: this._onSkillActivate,
				onSkillDeactivate: this._onSkillDeactivate,
				isPacer: false
			});

			if (redo) {
				--i;
				pacerRng = backupPacerRng;
				solverRng = backupSolverRng;
				lastskills = skills;
			}
		}
	}
}
