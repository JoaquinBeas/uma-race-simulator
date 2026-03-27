import skills from '../uma-skill-tools/data/skill_data.json';
import skillmeta from '../uma-skill-tools/data/skill_meta.json';

export function isDebuffSkill(id: string) {
	const meta = (skillmeta as any)[id];
	if (!meta || !meta.iconId) return false;
	return meta.iconId[0] == '3';
}

export function SkillSet(ids: string[]): Map<string, string> {
	return new Map(ids.reduce((acc: any, id: string) => {
		const {entries, ndebuff} = acc;
		const meta = (skillmeta as any)[id];
		if (!meta) return acc;
		const groupId = meta.groupId;
		if (isDebuffSkill(id)) {
			entries.push([groupId + '-' + ndebuff, id]);
			return {entries, ndebuff: ndebuff + 1};
		} else {
			entries.push([groupId, id]);
			return {entries, ndebuff};
		}
	}, {entries: [], ndebuff: 0}).entries);
}

function assertIsSkill(sid: string): boolean {
	return (skills as any)[sid] != null;
}

export function uniqueSkillForUma(oid: string, starCount: 1 | 2 | 3 | 4 | 5): string {
	if (!oid || oid.length < 6) return ''; 
	const i = +oid.slice(1, -2), v = +oid.slice(-2);
	const sid = (10000 * (1 + 9 * +(starCount > 2)) + 10000 * (v - 1) + i * 10 + 1).toString();
    
	if (!assertIsSkill(sid)) {
		const fallbackSid = (10000 * (1 + 9 * +(starCount > 2)) + i * 10 + 1).toString();
		return assertIsSkill(fallbackSid) ? fallbackSid : '';
	}
	
	return sid;
}

export type SamplePolicyDesc = {policy: 'immediate'} | {policy: 'fixed', pos: number}
	| {policy: 'random'} | {policy: 'straight-random'} | {policy: 'all-corner-random'}
	| {policy: 'log-normal', mu: number, sigma: number} | {policy: 'erlang', k: number, lambda: number};

export type Aptitude = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface HorseState {
	outfitId: string
	starCount: 1 | 2 | 3 | 4 | 5
	speed: number
	stamina: number
	power: number
	guts: number
	wisdom: number
	strategy: 'Nige' | 'Senkou' | 'Sasi' | 'Oikomi' | 'Oonige'
	distanceAptitude: Aptitude
	surfaceAptitude: Aptitude
	strategyAptitude: Aptitude
	aptitudes: Aptitude[]
	skills: Map<string, string>
	samplePolicies: Map<string, SamplePolicyDesc>
	uniqueLv: number
	mood: -2 | -1 | 0 | 1 | 2;
	popularity: number
}

export const DEFAULT_HORSE_STATE = {
	outfitId: '',
	starCount: 3,
	speed: 1200,
	stamina: 1200,
	power: 800,
	guts: 400,
	wisdom: 400,
	strategy: 'Senkou',
	distanceAptitude: 'S',
	surfaceAptitude: 'A',
	strategyAptitude: 'A',
	aptitudes: ['S','S','S','S','A','A','A','A','A','A'],
	skills: SkillSet([]),
	samplePolicies: new Map(),
	uniqueLv: 1,
	mood: 0,
	popularity: 1
};
