function assert(condition: any, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message || "Assertion failed");
	}
}

export enum Strategy { Nige = 1, Senkou, Sasi, Oikomi, Oonige }
export enum Aptitude { S, A, B, C, D, E, F, G }

export interface HorseParameters {
	readonly speed: number
	readonly stamina: number
	readonly power: number
	readonly guts: number
	readonly wisdom: number
	readonly strategy: Strategy
	readonly distanceAptitude: Aptitude
	readonly surfaceAptitude: Aptitude
	readonly strategyAptitude: Aptitude
	readonly rawStamina: number
}

export namespace StrategyHelpers {
	export function assertIsStrategy(strategy: number): asserts strategy is Strategy {
		assert(strategy in Strategy);
	}

	export function strategyMatches(s1: Strategy, s2: Strategy) {
		return s1 == s2 || (s1 == Strategy.Nige && s2 == Strategy.Oonige) || (s1 == Strategy.Oonige && s2 == Strategy.Nige);
	}
}
