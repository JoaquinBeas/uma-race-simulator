import { CourseData, CourseHelpers, Phase } from './CourseData';
import { HorseParameters, Strategy, StrategyHelpers } from './HorseTypes';
import { Region, RegionList } from './Region';
import { PRNG, Rule30CARng } from './Random';
import type { HpPolicy } from './HpPolicy';

namespace Speed {
	export const StrategyPhaseCoefficient = Object.freeze([
		[], // strategies start numbered at 1
		[1.0, 0.98, 0.962],
		[0.978, 0.991, 0.975],
		[0.938, 0.998, 0.994],
		[0.931, 1.0, 1.0],
		[1.063, 0.962, 0.95]
	].map(a => Object.freeze(a)));
	export const DistanceProficiencyModifier = Object.freeze([1.05, 1.0, 0.9, 0.8, 0.6, 0.4, 0.2, 0.1]);
}

function baseSpeed(course: CourseData) {
	return 20.0 - (course.distance - 2000) / 1000.0;
}

function baseTargetSpeed(horse: HorseParameters, course: CourseData, phase: Phase) {
	return baseSpeed(course) * Speed.StrategyPhaseCoefficient[horse.strategy][phase] +
		+(phase == 2) * Math.sqrt(500.0 * horse.speed) *
		Speed.DistanceProficiencyModifier[horse.distanceAptitude] *
		0.002;
}

function lastSpurtSpeed(horse: HorseParameters, course: CourseData) {
	let v = (baseTargetSpeed(horse, course, 2) + 0.01 * baseSpeed(course)) * 1.05 +
		Math.sqrt(500.0 * horse.speed) * Speed.DistanceProficiencyModifier[horse.distanceAptitude] * 0.002 +
		Math.pow(450.0 * horse.guts, 0.597) * 0.0001;
	return v;
}

namespace Acceleration {
	export const StrategyPhaseCoefficient = Object.freeze([
		[],
		[1.0, 1.0, 0.996],
		[0.985, 1.0, 0.996],
		[0.975, 1.0, 1.0],
		[0.945, 1.0, 0.997],
		[1.17, 0.94, 0.956]
	].map(a => Object.freeze(a)));
	export const GroundTypeProficiencyModifier = Object.freeze([1.05, 1.0, 0.9, 0.8, 0.7, 0.5, 0.3, 0.1]);
	export const DistanceProficiencyModifier = Object.freeze([1.0, 1.0, 1.0, 1.0, 1.0, 0.6, 0.5, 0.4]);
}

const BaseAccel = 0.0006;
const UphillBaseAccel = 0.0004;

function baseAccel(baseAccel: number, horse: HorseParameters, phase: Phase) {
	return baseAccel * Math.sqrt(500.0 * horse.power) *
		Acceleration.StrategyPhaseCoefficient[horse.strategy][phase] *
		Acceleration.GroundTypeProficiencyModifier[horse.surfaceAptitude] *
		Acceleration.DistanceProficiencyModifier[horse.distanceAptitude];
}

const PhaseDeceleration = [-1.2, -0.8, -1.0];

namespace PositionKeep {
	export const BaseMinimumThreshold = Object.freeze([0, 0, 3.0, 6.5, 7.5, 0]);
	export const BaseMaximumThreshold = Object.freeze([0, 0, 5.0, 7.0, 8.0, 0]);

	export function courseFactor(distance: number) {
		return 0.0008 * (distance - 1000) + 1.0;
	}

	export function minThreshold(strategy: Strategy, distance: number) {
		return BaseMinimumThreshold[strategy] * (strategy == Strategy.Senkou ? 1.0 : courseFactor(distance));
	}

	export function maxThreshold(strategy: Strategy, distance: number) {
		return BaseMaximumThreshold[strategy] * courseFactor(distance);
	}
}

export class Timer {
	constructor(public t: number) { }
}

export class CompensatedAccumulator {
	constructor(public acc: number, public err: number = 0.0) { }

	add(n: number) {
		const t = this.acc + n;
		if (Math.abs(this.acc) >= Math.abs(n)) {
			this.err += (this.acc - t) + n;
		} else {
			this.err += (n - t) + this.acc;
		}
		this.acc = t;
	}
}

export interface RaceState {
	readonly accumulatetime: Readonly<Timer>
	readonly activateCount: readonly number[]
	readonly activateCountHeal: number
	readonly activateCountLastFrame: number
	readonly currentSpeed: number
	readonly isLastSpurt: boolean
	readonly lastSpurtSpeed: number
	readonly lastSpurtTransition: number
	readonly isDownhillMode: boolean
	readonly isPaceDown: boolean
	readonly isKakari: boolean
	readonly temptationCount: number
	readonly phase: Phase
	readonly pos: number
	readonly hp: Readonly<HpPolicy>
	readonly randomLot: number
	readonly startDelay: number
	readonly gateRoll: number
	readonly usedSkills: ReadonlySet<string>
	readonly order: number
	readonly numUmas: number
	readonly horse: HorseParameters;
	readonly course: CourseData;
	// --- Datos extendidos para condiciones ---
	readonly isFinalCorner: boolean;
	readonly isFinalCornerLaterHalf: boolean;
	readonly currentCornerIdx: number;
	readonly currentStraightIdx: number;
	readonly isLastStraight: boolean;
	readonly furlong: number;
	readonly bashinDiffInfront: number;
	readonly bashinDiffBehind: number;
	readonly isOvertake: boolean;
	readonly changeOrderLastFrame: number;
	readonly overtakesInPhase: number[];
	readonly overtakesInFinalCorner: number;
	readonly blockedFrontTime: number;
	readonly nearLaneTimeInfront: number;
	readonly nearLaneTimeBehind: number;
	readonly orderRateIn20Continue: boolean;
	readonly orderRateIn40Continue: boolean;
	readonly orderRateIn50Continue: boolean;
	readonly orderRateIn80Continue: boolean;
	readonly orderRateOut20Continue: boolean;
	readonly orderRateOut40Continue: boolean;
	readonly orderRateOut50Continue: boolean;
	readonly orderRateOut70Continue: boolean;
}

export type DynamicCondition = (state: RaceState) => boolean;

export enum Perspective {
	Self = 1,
	Other = 2,
	Any = 3
}

export enum SkillType {
	Noop = 0,
	SpeedUp = 1,
	StaminaUp = 2,
	PowerUp = 3,
	GutsUp = 4,
	WisdomUp = 5,
	Recovery = 9,
	MultiplyStartDelay = 10,
	ExtendKakari = 13,
	SetStartDelay = 14,
	CurrentSpeed = 21,
	CurrentSpeedWithNaturalDeceleration = 22,
	TargetSpeed = 27,
	ModifyKakariChance = 29,
	Accel = 31,
	ActivateRandomGold = 37,
	ExtendEvolvedDuration = 42
}

export enum SkillRarity { White = 1, Gold, Unique, Evolution = 6 }

export interface SkillEffect {
	type: SkillType
	baseDuration: number
	modifier: number
}

export interface PendingSkill {
	skillId: string
	perspective?: Perspective
	rarity: SkillRarity
	trigger: Region
	extraCondition: DynamicCondition
	effects: SkillEffect[]
}

interface ActiveSkill {
	skillId: string
	perspective?: Perspective
	durationTimer: Timer
	modifier: number
}

function noop(x: unknown) { }

export class RaceSolver implements RaceState {
	accumulatetime: Timer;
	pos: number;
	minSpeed: number;
	currentSpeed: number;
	targetSpeed: number;
	accel: number;
	baseTargetSpeed: number[];
	lastSpurtSpeed: number;
	lastSpurtTransition: number;
	sectionModifier: number[];
	baseAccel: number[];
	horse: { -readonly [P in keyof HorseParameters]: HorseParameters[P] };
	course: CourseData;
	hp: HpPolicy;
	rng: PRNG;
	gorosiRng: PRNG;
	paceEffectRng: PRNG;
	hillRng: PRNG[];
	timers: Timer[];
	startDash: boolean;
	startDelay: number;
	gateRoll: number;
	randomLot: number;
	isLastSpurt: boolean;
	phase: Phase;
	nextPhaseTransition: number;
	activeTargetSpeedSkills: ActiveSkill[];
	activeCurrentSpeedSkills: (ActiveSkill & { naturalDeceleration: boolean })[];
	activeAccelSkills: ActiveSkill[];
	pendingSkills: PendingSkill[];
	pendingRemoval: Set<string>;
	usedSkills: Set<string>;
	nHills: number;
	hillIdx: number;
	slopePer: number;
	hillStart: number[];
	hillEnd: number[];
	isDownhillMode: boolean;
	downhillTimer: Timer;
	activateCount: number[];
	activateCountHeal: number;
	activateCountLastFrame: number;
	onSkillActivate: (s: RaceSolver, skillId: string, perspective: Perspective) => void;
	onSkillDeactivate: (s: RaceSolver, skillId: string, perspective: Perspective) => void;
	sectionLength: number;
	kakariStart: number;
	kakariDuration: number;
	kakariTimer: Timer;
	isKakari: boolean;
	temptationCount: number;
	pacer: RaceSolver | null;
	isPaceDown: boolean;
	forceFullSpurt: boolean;
	forceInnateSkillActivation: boolean;
	order: number;
	numUmas: number;
	posKeepMinThreshold: number;
	posKeepMaxThreshold: number;
	posKeepCooldown: Timer;
	posKeepEnd: number;
	posKeepSpeedCoef: number;
	posKeepEffectStart: number;
	posKeepEffectExitDistance: number;
	updatePositionKeep: () => void;

	// --- Nuevos Rastreadores de Estado para Condiciones ---
	isFinalCorner: boolean = false;
	isFinalCornerLaterHalf: boolean = false;
	currentCornerIdx: number = 0;
	currentStraightIdx: number = 0;
	isLastStraight: boolean = false;
	furlong: number = 1;
	bashinDiffInfront: number = 0;
	bashinDiffBehind: number = 0;
	isOvertake: boolean = false;
	changeOrderLastFrame: number = 0;
	overtakesInPhase: number[] = [0, 0, 0, 0];
	overtakesInFinalCorner: number = 0;
	
	blockedFrontTime: number = 0;
	nearLaneTimeInfront: number = 0;
	nearLaneTimeBehind: number = 0;

	orderRateIn20Continue: boolean = true;
	orderRateIn40Continue: boolean = true;
	orderRateIn50Continue: boolean = true;
	orderRateIn80Continue: boolean = true;
	orderRateOut20Continue: boolean = true;
	orderRateOut40Continue: boolean = true;
	orderRateOut50Continue: boolean = true;
	orderRateOut70Continue: boolean = true;

	private lastFrameRelativePos: number = 0;

	modifiers: {
		targetSpeed: CompensatedAccumulator;
		currentSpeed: CompensatedAccumulator;
		accel: CompensatedAccumulator;
		oneFrameAccel: number;
		specialSkillDurationScaling: number;
		kakariChance: number;
	};

	constructor(params: {
		horse: HorseParameters;
		course: CourseData;
		rng: PRNG;
		skills: PendingSkill[];
		hp: HpPolicy;
		pacer?: RaceSolver;
		forceFullSpurt?: boolean;
		forceInnateSkillActivation?: boolean;
		order?: number;
		numUmas?: number;
		onSkillActivate?: (s: RaceSolver, skillId: string, perspective: Perspective) => void;
		onSkillDeactivate?: (s: RaceSolver, skillId: string, perspective: Perspective) => void;
	}) {
		this.horse = Object.assign({}, params.horse);
		this.course = params.course;
		this.hp = params.hp;
		this.pacer = params.pacer || null;
		this.rng = params.rng;
		this.forceFullSpurt = params.forceFullSpurt || false;
		this.forceInnateSkillActivation = params.forceInnateSkillActivation || false;
		this.order = params.order || 1;
		this.numUmas = params.numUmas || 9;
		this.pendingSkills = params.skills.slice();
		this.pendingRemoval = new Set();
		this.usedSkills = new Set();
		this.gorosiRng = new Rule30CARng(this.rng.int32());
		this.paceEffectRng = new Rule30CARng(this.rng.int32());
		this.timers = [];
		this.accumulatetime = this.getNewTimer();
		this.gateRoll = this.rng.uniform(12252240);
		this.randomLot = this.rng.uniform(100);
		this.phase = 0;
		this.nextPhaseTransition = CourseHelpers.phaseStart(this.course.distance, 1);
		this.activeTargetSpeedSkills = [];
		this.activeCurrentSpeedSkills = [];
		this.activeAccelSkills = [];
		this.activateCount = [0, 0, 0];
		this.activateCountHeal = 0;
		this.activateCountLastFrame = 0;
		this.onSkillActivate = params.onSkillActivate || noop;
		this.onSkillDeactivate = params.onSkillDeactivate || noop;
		this.sectionLength = this.course.distance / 24.0;
		this.isPaceDown = false;
		this.posKeepMinThreshold = PositionKeep.minThreshold(this.horse.strategy, this.course.distance);
		this.posKeepMaxThreshold = PositionKeep.maxThreshold(this.horse.strategy, this.course.distance);
		this.posKeepCooldown = this.getNewTimer();
		this.posKeepEnd = this.sectionLength * 5.0;
		this.posKeepSpeedCoef = 1.0;

		if (StrategyHelpers.strategyMatches(this.horse.strategy, Strategy.Nige) || this.pacer == null) {
			this.updatePositionKeep = noop as any;
		} else {
			this.updatePositionKeep = this.updatePositionKeepNonNige;
		}

		this.modifiers = {
			targetSpeed: new CompensatedAccumulator(0.0),
			currentSpeed: new CompensatedAccumulator(0.0),
			accel: new CompensatedAccumulator(0.0),
			oneFrameAccel: 0.0,
			specialSkillDurationScaling: 1.0,
			kakariChance: 0.0,
		};

		this.startDelay = 0.1 * this.rng.random();
		if (this.pacer) {
			this.pacer.startDelay = 0.0;
		}

		this.pos = 0.0;
		this.accel = 0.0;
		this.currentSpeed = 3.0;
		this.targetSpeed = 0.85 * baseSpeed(this.course);
		this.processSkillActivations();
		this.minSpeed = 0.85 * baseSpeed(this.course) + Math.sqrt(200.0 * this.horse.guts) * 0.001;
		this.startDash = true;
		this.modifiers.accel.add(24.0);

		this.initHills();

		this.baseTargetSpeed = ([0, 1, 2] as Phase[]).map((phase) => baseTargetSpeed(this.horse, this.course, phase));
		this.lastSpurtSpeed = lastSpurtSpeed(this.horse, this.course);
		this.lastSpurtTransition = -1;

		this.kakariStart = (2 + this.rng.uniform(7)) * this.sectionLength;
		if (this.rng.random() > Math.pow(0.65 / Math.log10(0.1 * this.horse.wisdom + 1), 2) + this.modifiers.kakariChance) {
			this.kakariStart = this.course.distance + 9999;
		}
		this.kakariDuration = 3.0 * [0.0, this.rng.random(), this.rng.random(), this.rng.random(), 1.0].findIndex((x) => x > 0.45);
		this.kakariTimer = this.getNewTimer();
		this.isKakari = false;
		this.temptationCount = 0;

		this.sectionModifier = Array.from({ length: 24 }, () => {
			const max = (this.horse.wisdom / 5500.0) * Math.log10(this.horse.wisdom * 0.1);
			const factor = (max - 0.65 + this.rng.random() * 0.65) / 100.0;
			return baseSpeed(this.course) * factor;
		});
		this.sectionModifier.push(0.0);

		this.hp.init(this.horse);
		this.baseAccel = ([0, 1, 2, 0, 1, 2] as Phase[]).map((phase, i) => baseAccel(i > 2 ? UphillBaseAccel : BaseAccel, this.horse, phase));
	}

	initHills() {
		this.nHills = this.course.slopes.length;
		this.hillStart = this.course.slopes.map((s) => s.start).reverse();
		this.hillEnd = this.course.slopes.map((s) => s.start + s.length).reverse();
		this.hillIdx = -1;
		this.hillRng = this.course.slopes.map((_) => new Rule30CARng(this.rng.int32(), this.rng.int32()));
		this.downhillTimer = this.getNewTimer();

		if (this.hillStart.length > 0 && this.hillStart[this.hillStart.length - 1] == 0) {
			this.hillIdx = 0;
			this.slopePer = this.course.slopes[0].slope;
			this.downhillTimer.t = 0;
			this.downhillCheck(this.hillRng[0].random());
			this.hillStart.pop();
		} else {
			this.slopePer = 0;
		}
	}

	getNewTimer(t: number = 0) {
		const tm = new Timer(t);
		this.timers.push(tm);
		return tm;
	}

	getMaxSpeed() {
		if (this.startDash) {
			return Math.min(this.targetSpeed, 0.85 * baseSpeed(this.course));
		} else if (this.currentSpeed + this.modifiers.oneFrameAccel > this.targetSpeed) {
			return 9999.0;
		} else {
			return this.targetSpeed;
		}
	}

	step(dt: number) {
		if (this.accumulatetime.t < this.startDelay) {
			this.timers.forEach((tm) => (tm.t += dt));
			return;
		}

		if (this.pos < this.posKeepEnd && this.pacer != null) {
			this.pacer.step(dt);
		}

		const halfv = Math.min(this.currentSpeed + 0.5 * dt * this.accel, this.getMaxSpeed());
		const displacement = halfv + this.modifiers.currentSpeed.acc + this.modifiers.currentSpeed.err;
		this.pos += displacement * dt;

		// --- ACTUALIZACIÓN DE DATOS PARA CONDICIONES ---
		this.updateEnvironmentData(dt);

		this.hp.tick(this, dt);
		this.timers.forEach((tm) => (tm.t += dt));
		this.updateHills();
		this.updatePhase();
		this.processSkillActivations();
		this.updateKakari();
		this.updatePositionKeep();
		this.updateLastSpurtState();
		this.updateTargetSpeed();
		this.applyForces();

		this.currentSpeed = Math.min(halfv + 0.5 * dt * this.accel + this.modifiers.oneFrameAccel, this.getMaxSpeed());
		if (!this.startDash && this.currentSpeed < this.minSpeed) {
			this.currentSpeed = this.minSpeed;
		} else if (this.startDash && this.currentSpeed >= 0.85 * baseSpeed(this.course)) {
			this.startDash = false;
			this.modifiers.accel.add(-24.0);
		}
		this.modifiers.oneFrameAccel = 0.0;
	}

	private updateEnvironmentData(dt: number) {
		// 1. Geografía: Curvas, Rectas y Furlongs
		this.furlong = Math.floor(this.pos / 201.168) + 1;

		this.currentCornerIdx = 0;
		this.course.corners.forEach((c, idx) => {
			if (this.pos >= c.start && this.pos <= c.start + c.length) this.currentCornerIdx = idx + 1;
		});
		
		this.currentStraightIdx = 0;
		this.course.straights.forEach((s, idx) => {
			if (this.pos >= s.start && this.pos <= s.end) this.currentStraightIdx = idx + 1;
		});

		if (this.course.corners.length > 0) {
			const lastCorner = this.course.corners[this.course.corners.length - 1];
			this.isFinalCorner = (this.pos >= lastCorner.start && this.pos <= lastCorner.start + lastCorner.length);
			this.isFinalCornerLaterHalf = (this.pos >= lastCorner.start + lastCorner.length / 2 && this.pos <= lastCorner.start + lastCorner.length);
		} else {
			this.isFinalCorner = false;
			this.isFinalCornerLaterHalf = false;
		}

		const lastStr = this.course.straights[this.course.straights.length - 1];
		this.isLastStraight = this.pos >= (lastStr?.start || 0);

		// 2. Interacción con el Pacer (Líder simulado)
		if (this.pacer) {
			const relativePos = this.pacer.pos - this.pos; // >0 si el líder va delante
			this.bashinDiffInfront = Math.max(0, relativePos);
			this.bashinDiffBehind = Math.max(0, -relativePos);

			// Timers de Proximidad
			if (relativePos > 0 && relativePos < 2) this.blockedFrontTime += dt;
			else this.blockedFrontTime = 0;

			if (relativePos > 0 && relativePos < 2.5) this.nearLaneTimeInfront += dt;
			else this.nearLaneTimeInfront = 0;

			if (relativePos < 0 && relativePos > -2.5) this.nearLaneTimeBehind += dt;
			else this.nearLaneTimeBehind = 0;

			// Adelantamientos
			const isAheadNow = relativePos < 0;
			const wasBehindLastFrame = this.lastFrameRelativePos >= 0;
			this.isOvertake = isAheadNow && wasBehindLastFrame;

			if (this.isOvertake) {
				this.changeOrderLastFrame = -1; // "Subimos"
				this.overtakesInPhase[this.phase]++;
				if (this.isFinalCorner) this.overtakesInFinalCorner++;
			} else if (!wasBehindLastFrame && !isAheadNow && relativePos > 0) {
				this.changeOrderLastFrame = 1; // "Bajamos"
			} else {
				this.changeOrderLastFrame = 0;
			}

			this.lastFrameRelativePos = relativePos;
		}

		// 3. Persistencia de Posición (_continue) - Empieza tras 5 segundos
		if (this.accumulatetime.t > 5) {
			const rate = ((this.order - 1) / Math.max(1, this.numUmas - 1)) * 100;
			if (rate > 20) this.orderRateIn20Continue = false;
			if (rate > 40) this.orderRateIn40Continue = false;
			if (rate > 50) this.orderRateIn50Continue = false;
			if (rate > 80) this.orderRateIn80Continue = false;
			
			if (rate <= 20) this.orderRateOut20Continue = false;
			if (rate <= 40) this.orderRateOut40Continue = false;
			if (rate <= 50) this.orderRateOut50Continue = false;
			if (rate <= 70) this.orderRateOut70Continue = false;
		}
	}

	updateKakari() {
		if (this.temptationCount == 0 && this.pos >= this.kakariStart) {
			this.isKakari = true;
			this.temptationCount = 1;
			this.kakariTimer.t = -this.kakariDuration;
			this.onSkillActivate(this, 'kakari', Perspective.Self);
		} else if (this.isKakari && this.kakariTimer.t >= 0) {
			this.isKakari = false;
			this.onSkillDeactivate(this, 'kakari', Perspective.Self);
		}
	}

	updatePositionKeepNonNige() {
		if (this.pos >= this.posKeepEnd) {
			this.isPaceDown = false;
			this.posKeepSpeedCoef = 1.0;
			this.updatePositionKeep = noop as any;
		} else if (this.isPaceDown) {
			if (
				this.pacer.pos - this.pos > this.posKeepEffectExitDistance ||
				this.pos - this.posKeepEffectStart > this.sectionLength ||
				this.activeTargetSpeedSkills.length > 0 ||
				this.activeCurrentSpeedSkills.length > 0 ||
				this.isKakari
			) {
				this.isPaceDown = false;
				this.posKeepCooldown.t = -3.0;
				this.posKeepSpeedCoef = 1.0;
			}
		} else if (
			this.pacer.pos - this.pos < this.posKeepMinThreshold &&
			this.activeTargetSpeedSkills.length == 0 &&
			this.activeCurrentSpeedSkills.length == 0 &&
			!this.isKakari &&
			this.posKeepCooldown.t >= 0
		) {
			this.isPaceDown = true;
			this.posKeepEffectStart = this.pos;
			const min = this.posKeepMinThreshold;
			const max = this.phase == 1 ? min + 0.5 * (this.posKeepMaxThreshold - min) : this.posKeepMaxThreshold;
			this.posKeepEffectExitDistance = min + this.paceEffectRng.random() * (max - min);
			this.posKeepSpeedCoef = this.phase == 1 ? 0.945 : 0.915;
		}
	}

	updateLastSpurtState() {
		if (this.isLastSpurt || this.phase < 2) return;
		if (this.forceFullSpurt) {
			this.isLastSpurt = true;
			this.lastSpurtTransition = CourseHelpers.phaseStart(this.course.distance, 2);
			return;
		}
		if (this.lastSpurtTransition == -1) {
			const v = this.hp.getLastSpurtPair(this, this.lastSpurtSpeed, this.baseTargetSpeed[2]);
			this.lastSpurtTransition = v[0];
			this.lastSpurtSpeed = v[1];
		}
		if (this.pos >= this.lastSpurtTransition) {
			this.isLastSpurt = true;
		}
	}

	updateTargetSpeed() {
		if (!this.hp.hasRemainingHp()) {
			this.targetSpeed = this.minSpeed;
		} else if (this.isLastSpurt) {
			this.targetSpeed = this.lastSpurtSpeed;
		} else {
			this.targetSpeed = this.baseTargetSpeed[this.phase] * this.posKeepSpeedCoef;
			this.targetSpeed += this.sectionModifier[Math.floor(this.pos / this.sectionLength)];
		}
		this.targetSpeed += this.modifiers.targetSpeed.acc + this.modifiers.targetSpeed.err;

		if (this.isDownhillMode) {
			this.targetSpeed += 0.3 + this.slopePer / 100000.0;
		} else if (this.hillIdx != -1 && this.slopePer > 0) {
			this.targetSpeed -= (this.slopePer / 10000.0) * 200.0 / this.horse.power;
			this.targetSpeed = Math.max(this.targetSpeed, this.minSpeed);
		}
	}

	applyForces() {
		if (!this.hp.hasRemainingHp()) {
			this.accel = -1.2;
			return;
		}
		if (this.currentSpeed > this.targetSpeed) {
			this.accel = this.isPaceDown ? -0.5 : PhaseDeceleration[this.phase];
			return;
		}
		this.accel = this.baseAccel[+(this.slopePer > 0) * 3 + this.phase];
		this.accel += this.modifiers.accel.acc + this.modifiers.accel.err;
	}

	downhillCheck(roll: number) {
		if (this.slopePer < 0 && roll < this.horse.wisdom * 0.0004) {
			this.onSkillActivate(this, 'downhill', Perspective.Self);
			this.isDownhillMode = true;
		}
	}

	updateHills() {
		if (this.hillIdx == -1 && this.hillStart.length > 0 && this.pos >= this.hillStart[this.hillStart.length - 1]) {
			this.hillIdx = this.nHills - this.hillStart.length;
			this.slopePer = this.course.slopes[this.hillIdx].slope;
			this.downhillTimer.t = 0;
			this.downhillCheck(this.hillRng[this.hillIdx].random());
			this.hillStart.pop();
		} else if (this.hillIdx != -1 && this.hillEnd.length > 0 && this.pos > this.hillEnd[this.hillEnd.length - 1]) {
			this.hillIdx = -1;
			this.slopePer = 0;
			this.hillEnd.pop();
			if (this.isDownhillMode) this.onSkillDeactivate(this, 'downhill', Perspective.Self);
			this.isDownhillMode = false;
		}
		if (this.downhillTimer.t >= 1.0 && this.hillIdx != -1) {
			const roll = this.hillRng[this.hillIdx].random();
			if (this.isDownhillMode && roll > 0.8) {
				this.onSkillDeactivate(this, 'downhill', Perspective.Self);
				this.isDownhillMode = false;
			} else if (!this.isDownhillMode) {
				this.downhillCheck(roll);
			}
			this.downhillTimer.t = 0.0;
		}
	}

	updatePhase() {
		if (this.pos >= this.nextPhaseTransition && this.phase < 2) {
			++this.phase;
			this.nextPhaseTransition = CourseHelpers.phaseStart(this.course.distance, this.phase + 1 as Phase);
		}
	}

	processSkillActivations() {
		const cleanup = (skills: ActiveSkill[], type: 'targetSpeed' | 'currentSpeed' | 'accel') => {
			for (let i = skills.length; --i >= 0;) {
				const s = skills[i];
				if (s.durationTimer.t >= 0) {
					skills.splice(i, 1);
					this.modifiers[type === 'currentSpeed' ? 'currentSpeed' : type].add(-s.modifier);
					if (type === 'currentSpeed' && (s as any).naturalDeceleration) {
						this.modifiers.oneFrameAccel += s.modifier;
					}
					this.onSkillDeactivate(this, s.skillId, s.perspective);
				}
			}
		};

		cleanup(this.activeTargetSpeedSkills, 'targetSpeed');
		cleanup(this.activeCurrentSpeedSkills, 'currentSpeed');
		cleanup(this.activeAccelSkills, 'accel');

		let activatedThisFrame = 0;
		for (let i = this.pendingSkills.length; --i >= 0;) {
			const s = this.pendingSkills[i];
			if (this.pos >= s.trigger.end || this.pendingRemoval.has(s.skillId)) {
				this.pendingSkills.splice(i, 1);
				this.pendingRemoval.delete(s.skillId);
			} else if (this.pos >= s.trigger.start && (s.extraCondition(this) || (this.forceInnateSkillActivation && s.rarity >= SkillRarity.Unique))) {
				this.activateSkill(s);
				this.pendingSkills.splice(i, 1);
				if (s.skillId !== 'asitame' && s.skillId !== 'staminasyoubu') ++activatedThisFrame;
			}
		}
		this.activateCountLastFrame = activatedThisFrame;
	}

	activateSkill(s: PendingSkill) {
		s.effects.sort((a, b) => +(a.type === 42) - +(b.type === 42)).forEach((ef) => {
			const scaledDuration = ef.baseDuration * (this.course.distance / 1000) * (s.rarity === SkillRarity.Evolution ? this.modifiers.specialSkillDurationScaling : 1);
			switch (ef.type) {
				case SkillType.SpeedUp:
					this.horse.speed = Math.max(this.horse.speed + ef.modifier, 1);
					break;
				case SkillType.StaminaUp:
					this.horse.stamina = Math.max(this.horse.stamina + ef.modifier, 1);
					this.horse.rawStamina = Math.max(this.horse.rawStamina + ef.modifier, 1);
					break;
				case SkillType.PowerUp:
					this.horse.power = Math.max(this.horse.power + ef.modifier, 1);
					break;
				case SkillType.GutsUp:
					this.horse.guts = Math.max(this.horse.guts + ef.modifier, 1);
					break;
				case SkillType.WisdomUp:
					this.horse.wisdom = Math.max(this.horse.wisdom + ef.modifier, 1);
					break;
				case SkillType.MultiplyStartDelay:
					this.startDelay *= ef.modifier;
					break;
				case SkillType.ExtendKakari:
					if (this.isKakari) this.kakariTimer.t -= ef.modifier;
					break;
				case SkillType.SetStartDelay:
					this.startDelay = ef.modifier;
					break;
				case SkillType.TargetSpeed:
					this.modifiers.targetSpeed.add(ef.modifier);
					this.activeTargetSpeedSkills.push({ skillId: s.skillId, perspective: s.perspective, durationTimer: this.getNewTimer(-scaledDuration), modifier: ef.modifier });
					break;
				case SkillType.ModifyKakariChance:
					this.modifiers.kakariChance += ef.modifier / 100.0;
					break;
				case SkillType.Accel:
					this.modifiers.accel.add(ef.modifier);
					this.activeAccelSkills.push({ skillId: s.skillId, perspective: s.perspective, durationTimer: this.getNewTimer(-scaledDuration), modifier: ef.modifier });
					break;
				case SkillType.CurrentSpeed:
				case SkillType.CurrentSpeedWithNaturalDeceleration:
					this.modifiers.currentSpeed.add(ef.modifier);
					this.activeCurrentSpeedSkills.push({
						skillId: s.skillId,
						perspective: s.perspective,
						durationTimer: this.getNewTimer(-scaledDuration),
						modifier: ef.modifier,
						naturalDeceleration: ef.type === SkillType.CurrentSpeedWithNaturalDeceleration,
					});
					break;
				case SkillType.Recovery:
					if (s.perspective === Perspective.Self) ++this.activateCountHeal;
					this.hp.recover(ef.modifier);
					if (this.phase >= 2 && !this.isLastSpurt) {
						this.lastSpurtTransition = -1;
						this.updateLastSpurtState();
					}
					break;
				case SkillType.ActivateRandomGold:
					this.doActivateRandomGold(ef.modifier);
					break;
				case SkillType.ExtendEvolvedDuration:
					this.modifiers.specialSkillDurationScaling = ef.modifier;
					break;
			}
		});
		if (s.perspective === Perspective.Self) ++this.activateCount[this.phase];
		this.usedSkills.add(s.skillId);
		this.onSkillActivate(this, s.skillId, s.perspective);
	}

	doActivateRandomGold(ngolds: number) {
		const goldIndices = this.pendingSkills.reduce((acc, skill, i) => {
			if ((skill.rarity === SkillRarity.Gold || skill.rarity === SkillRarity.Evolution) && skill.effects.every((ef) => ef.type > SkillType.WisdomUp)) acc.push(i);
			return acc;
		}, [] as number[]);
		for (let i = goldIndices.length; --i >= 0;) {
			const j = this.gorosiRng.uniform(i + 1);
			[goldIndices[i], goldIndices[j]] = [goldIndices[j], goldIndices[i]];
		}
		for (let i = 0; i < Math.min(ngolds, goldIndices.length); ++i) {
			const s = this.pendingSkills[goldIndices[i]];
			this.activateSkill(s);
			this.pendingRemoval.add(s.skillId);
		}
	}

	cleanup() {
		const callDeactivateHook = (s: { skillId: string; perspective?: Perspective }) => {
			this.onSkillDeactivate(this, s.skillId, s.perspective);
		};
		this.activeTargetSpeedSkills.forEach(callDeactivateHook);
		this.activeCurrentSpeedSkills.forEach(callDeactivateHook);
		this.activeAccelSkills.forEach(callDeactivateHook);
		if (this.isDownhillMode) this.onSkillDeactivate(this, 'downhill', Perspective.Self);
	}
}