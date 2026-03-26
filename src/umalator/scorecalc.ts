import { HorseState, uniqueSkillForUma } from '../components/HorseDefTypes';

import skillmeta from '../uma-skill-tools/data/skill_meta.json';

const mulsmall = [0.5, 0.8, 1, 1.3, 1.6, 1.8, 2.1, 2.4, 2.6, 2.8, 2.9, 3, 3.1, 3.3, 3.4, 3.5, 3.9, 4.1, 4.2, 4.3, 5.2, 5.5, 6.6, 6.8, 6.9];
const mullarge = [8, 8.1, 8.3, 8.4, 8.5, 8.6, 8.8, 8.9, 9, 9.2, 9.3, 9.4, 9.6, 9.7, 9.8, 10, 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.9, 11, 11.1, 11.3, 11.4, 11.5, 11.7, 11.8, 11.9, 12.1, 12.2, 12.3, 12.4, 12.6, 12.7, 12.8, 13, 13.1, 13.2, 13.4, 13.5, 13.6, 13.8, 13.9, 14, 14.1, 14.3, 14.4, 14.5, 14.7, 14.8, 14.9, 15.1, 15.2, 15.3, 15.5, 15.6, 15.7, 15.9, 16, 16.1, 16.2, 16.4, 16.5, 16.6, 16.8, 16.9, 17, 17.2, 17.3, 17.4, 17.6, 17.7, 17.8, 17.9, 18.1, 18.2, 18.3];

function calc(mul: number[], stat: number, blksz: number) {
	const n = Math.floor(stat / blksz);
	return Array.from({length: n+1}, (_,i) => i == n ? stat % blksz : blksz).map((x,i) => x * mul[i]).reduce((a,b) => a+b,0);
}

function lo(stat: number) {
	return Math.floor(calc(mulsmall, stat + 1, 50));
}

function mid(stat: number) {
	return 3841 + Math.ceil(7.888 * (stat - 1200));
}

const EXCEPTIONS = [1643, 1865];
function hi(stat: number) {
	return +(EXCEPTIONS.indexOf(stat) > -1) + 3912 + Math.ceil(calc(mullarge, stat - 1209, 10));
}

export function scoreForStat(stat: number) {
	if (stat < 1201) return lo(stat);
	else if (stat < 1210) return mid(stat);
	else return hi(stat);
}

function aptIdx(tag: number) {
	if (tag >= 500 && tag < 600) return -1;
	else if (tag >= 100 && tag < 200) return 3 + (tag - 100);
	else if (tag >= 200 && tag < 300) return -1 + (tag - 200);
	return -1;
}

const AptitudeMultiplier = Object.freeze({'S':1.1,'A':1.1,'B':0.9,'C':0.9,'D':0.8,'E':0.8,'F':0.8,'G':0.7} as const);
export function scoreForSkill(skillid: string, aptitudes: (keyof typeof AptitudeMultiplier)[]) {
	if (!aptitudes) return 0;
	const sk = (skillmeta as any)[skillid];
	if (!sk || !sk.tags) return 0;
	const tg: Record<number, number[]> = {};
	sk.tags.forEach((t: number) => {
		const group = Math.floor(t / 100);
		if (!tg[group]) tg[group] = [];
		tg[group].push(t);
	});
	const groups = Object.values(tg);
	if (groups.length === 0) return Math.round((sk.score || 0));
	let aptCoef = groups.map(g => g.reduce((acc,t) => {
		const idx = aptIdx(t);
		if (idx == -1 || idx >= aptitudes.length) return acc;
		const apt = aptitudes[idx];
		const mult = AptitudeMultiplier[apt] || 1;
		return Math.max(acc, mult);
	}, 1)).reduce((a,b) => a * b, 1);
	return Math.round((sk.score || 0) * aptCoef);
}

export function scoreUma(uma: HorseState) {
	const uid = uniqueSkillForUma(uma.outfitId, uma.starCount);
	return (120 + 50 * +(uma.starCount > 2)) * uma.uniqueLv +
		scoreForStat(uma.speed) + scoreForStat(uma.stamina) + scoreForStat(uma.power) +
		scoreForStat(uma.guts) + scoreForStat(uma.wisdom) +
		Array.from(uma.skills.values()).reduce((acc,id) => id == uid ? acc : acc + scoreForSkill(id, uma.aptitudes || []), 0);
}
