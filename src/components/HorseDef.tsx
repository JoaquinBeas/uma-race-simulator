import { Fragment, cloneElement } from 'react';
import { useState, useReducer, useMemo, useRef, useEffect } from 'react';
import { O, id, useLens, useGetter } from '../optics';
import { SkillList, Skill, ExpandedSkillDetails, SkillCost } from '../components/SkillList';
import { SkillSet, uniqueSkillForUma } from './HorseDefTypes';
import { useGrabScroll } from '../lib/useGrabScroll';
import './HorseDef.css';

import umas from '../uma-skill-tools/data/umas.json';
import icons from '../uma-skill-tools/data/icons.json';
import skilldata from '../uma-skill-tools/data/skill_data.json';
import skillmeta from '../uma-skill-tools/data/skill_meta.json';

const STRINGS = Object.freeze({
	'select': {
		'strategy': 'Active Style:',
		'surfaceaptitude': 'Surface',
		'distanceaptitude': 'Distance',
		'strategyaptitude': 'Style'
	},
	'skillheader': 'Skills',
	'addskill': 'Add Skill',
	'moodfmt': 'Motivation: {{mood}}',
	'common': {
		'strategy': { 1: 'Front Runner', 2: 'Pace Chaser', 3: 'Late Surger', 4: 'End Closer', 5: 'Runaway' },
		'surface': { 1: 'Turf', 2: 'Dirt' },
		'distance': { 1: 'Short', 2: 'Mile', 3: 'Medium', 4: 'Long' },
		'stat': { 1: 'Speed', 2: 'Stamina', 3: 'Power', 4: 'Guts', 5: 'Wit' },
		'mood': { 1: 'Awful', 2: 'Bad', 3: 'Normal', 4: 'Good', 5: 'Great' }
	}
});

const umaAltIds = Object.keys(umas).flatMap(id => Object.keys((umas as any)[id].outfits));
const umaNamesForSearch: Record<string, string> = {};
umaAltIds.forEach(id => {
	const u = (umas as any)[id.slice(0, 4)];
	if (!u || !u.outfits[id]) return;
	umaNamesForSearch[id] = (u.outfits[id].epithet + ' ' + u.name[1]).toUpperCase().replace(/\./g, '');
});

function searchNames(query: string) {
	const q = query.toUpperCase().replace(/\./g, '');
	return umaAltIds.filter(oid => umaNamesForSearch[oid].indexOf(q) > -1);
}

function Star({ starCount, minStarCount, n }: any) {
	const cls = ['umaStar'];
	if (starCount >= n) cls.push('umaStarGte');
	if (n <= minStarCount) cls.push('umaStarMin');
	return <div className={cls.join(' ')} style={{ zIndex: 5 - n }} data-n={n}></div>
}

export function UmaSelector(props: any) {
	const randomMob = useMemo(() => `/icons/mob/trained_mob_chr_icon_${8000 + Math.floor(Math.random() * 624)}_000001_01.png`, []);
	const [value, setOutfitId] = useLens(props.outfitId);
	const valueRef = useRef(value);
	useEffect(() => {
		valueRef.current = value;
	}, [value]);
	const [starCount, setStarCount] = useLens(props.starCount);
	const u = value && (umas as any)[value.slice(0, 4)];
	const minStarCount = u ? u.outfits[value].rarity : 1;
	const input = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const suggestionsRef = useGrabScroll();

	const [query, search] = useReducer((state: any, q: string) => ({
		input: q,
		suggestions: searchNames(q)
	}), u ? `${u.outfits[value].epithet} ${u.name[1]}` : '', (initial) => ({ input: initial, suggestions: searchNames(initial) }));

	useEffect(() => {
		const currentName = value && (umas as any)[value.slice(0, 4)] ? `${(umas as any)[value.slice(0, 4)].outfits[value].epithet} ${(umas as any)[value.slice(0, 4)].name[1]}` : '';
		if (query.input !== currentName) {
			search(currentName);
		}
	}, [value]);

	function confirm(oid: string) {
		setOpen(false);
		setOutfitId(oid);
		if (input.current) input.current.blur();
	}

	return (
		<div className="flex items-center gap-6 px-4 py-2">
			<div className="relative flex flex-col items-center">
				<div className="relative">
					<img
						src={value ? `/icons/chara/${(icons as any)[value][1]}.png` : randomMob}
						className="w-32 h-32 rounded-full border-4 border-[#444746] shadow-md cursor-pointer object-cover"
						onClick={() => input.current?.focus()}
					/>
					<img
						src="/icons/utx_ico_umamusume_00.png"
						className="absolute -top-2 -right-2 w-10 h-10 cursor-pointer z-10"
						onClick={() => input.current?.focus()}
					/>
				</div>
				<div className="flex justify-center mt-1" onClick={(e: any) => {
					const star = e.target.closest('.umaStar');
					if (star) setStarCount(Math.max(minStarCount, +star.dataset.n));
				}}>
					<div className="flex h-6">
						{[1, 2, 3, 4, 5].map(n => <Star key={n} starCount={starCount} minStarCount={minStarCount} n={n} />)}
					</div>
				</div>
			</div>

			<div className="flex-1 flex flex-col justify-center gap-1">
				<div className="text-center">
					<span className="text-[#e3e3e3] text-2xl font-bold block leading-tight">
						{value && u.outfits[value].epithet ? `[${u.outfits[value].epithet}]` : ''}
					</span>
				</div>
				<div className="relative">
					<input
						type="text"
						className="w-full bg-transparent border-none text-[#e3e3e3] text-2xl font-bold text-center outline-none focus:ring-0"
						value={query.input}
						tabIndex={props.tabindex}
						onInput={(e: any) => search(e.target.value)}
						onFocus={() => { setOpen(true); search(''); }}
						onBlur={() => {
							setTimeout(() => {
								setOpen(false);
								const val = valueRef.current;
								const currentName = val && (umas as any)[val.slice(0, 4)] ? `${(umas as any)[val.slice(0, 4)].outfits[val].epithet} ${(umas as any)[val.slice(0, 4)].name[1]}` : '';
								search(currentName);
							}, 250);
						}}
						ref={input}
					/>
					<ul
						ref={suggestionsRef}
						className={`absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto bg-[#1e1f20] border-2 border-[#444746] rounded-lg shadow-xl z-[100] grab-scroll text-[#e3e3e3] ${open ? 'block' : 'hidden'}`}
					>
						{query.suggestions.slice(0, 50).map((oid) => (
							<li key={oid} className="flex items-center gap-3 p-2 hover:bg-[#8ab4f8] hover:text-[#131314] cursor-pointer transition-colors" onMouseDown={(e) => { e.preventDefault(); confirm(oid); }}>
								<img src={`/icons/chara/${(icons as any)[oid][1]}.png`} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
								<span className="font-bold">{(umas as any)[oid.slice(0, 4)].outfits[oid].epithet} {(umas as any)[oid.slice(0, 4)].name[1]}</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}

export function Stat({ value: lens, tabindex }: any) {
	const [value, setValue] = useLens(lens);
	const rank = value > 1200 ? Math.min(18 + Math.floor((value - 1200) / 100) * 10 + Math.floor(value / 10) % 10, 97) : (value >= 1150 ? 17 : (value >= 1100 ? 16 : (value >= 400 ? 8 + Math.floor((value - 400) / 100) : Math.floor(value / 50))));
	return (
		<div className="flex items-center justify-center p-2 gap-2 bg-[#131314]">
			<img src={`/icons/statusrank/ui_statusrank_${(100 + rank).toString().slice(1)}.png`} className="h-8 w-8 object-contain" />
			<input
				type="number"
				min="1"
				max="2000"
				value={value}
				tabIndex={tabindex}
				onInput={(e: any) => setValue(+e.currentTarget.value)}
				className="w-full bg-transparent border-none text-[#e3e3e3] text-xl font-bold p-0 outline-none focus:ring-0"
			/>
		</div>
	);
}

const APTITUDES = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
export function AptitudeSelect({ a: lens, tabindex }: any) {
	const [a, setA] = useLens(lens);
	const [open, setOpen] = useState(false);
	const idx = 100 + (7 - APTITUDES.indexOf(a || 'A'));
	return (
		<div className="relative inline-block" tabIndex={tabindex} onBlur={() => setTimeout(() => setOpen(false), 200)}>
			<div
				className="cursor-pointer hover:scale-110 transition-transform"
				onClick={() => setOpen(!open)}
			>
				<img src={`/icons/utx_ico_statusrank_${idx.toString().slice(1)}.png`} className="h-7 w-7 object-contain" />
			</div>
			{open && (
				<ul className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-[#1e1f20] border border-[#444746] rounded-md shadow-xl z-[110] min-w-[44px] p-1">
					{APTITUDES.map(apt => (
						<li
							key={apt}
							onClick={() => { setA(apt); setOpen(false); }}
							className="p-1.5 hover:bg-[#282a2c] rounded transition-colors cursor-pointer flex justify-center"
						>
							<img src={`/icons/utx_ico_statusrank_${(100 + (7 - APTITUDES.indexOf(apt))).toString().slice(1)}.png`} className="h-7 w-7" />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export function HorseDef(props: any) {
	if (!props.state) return null;
	const [skillPickerOpen, setSkillPickerOpen] = useState(false);
	const [expanded, setExpanded] = useState(new Set<string>());
	const skillListRef = useGrabScroll();
	const accentColor = props.accentColor || '#8ab4f8';

	const [skills, setSkills] = useLens(useMemo(() => props.state.skills, [props.state]));
	const [currentStrategy, setStrategy] = useLens(props.state.strategy);
	const [mood, setMood] = useLens(props.state.mood);
	const [popularity, setPopularity] = useLens(props.state.popularity);

	const l_umaId = useMemo(() => props.state._lens((x: any) => x?.outfitId, (f: any, state: any) => {
		const id = f(state?.outfitId);
		const newSkills = new Map();
		state.skills.forEach((sid: string, g: string) => {
			const sd = (skilldata as any)[sid];
			if (sd && (sd.rarity < 3 || sid[0] === '4' || (sid[0] === '9' && sid.length > 6))) newSkills.set(g, sid);
		});
		if (id && (umas as any)[id.slice(0, 4)] && (umas as any)[id.slice(0, 4)].outfits[id]) {
			const u = (umas as any)[id.slice(0, 4)].outfits[id];
			const strats = ['Nige', 'Senkou', 'Sasi', 'Oikomi', 'Oonige'];
			const stratAptitudes = u.aptitudes.slice(4, 8);
			let bestVal = 99, bestIdx = 0;
			for (let i = 0; i < 4; i++) {
				if (stratAptitudes[i] < bestVal) {
					bestVal = stratAptitudes[i];
					bestIdx = i;
				}
			}
			const uid = uniqueSkillForUma(id, state.starCount);
			if (uid) newSkills.set((skillmeta as any)[uid].groupId, uid);
			return {
				...state, outfitId: id, strategy: strats[bestIdx],
				aptitudes: u.aptitudes.map((i: number) => ' GFEDCBA'[i]), skills: newSkills
			};
		}
		return { ...state, outfitId: id, skills: newSkills };
	}), [props.state]);

	const [umaId, setUmaId] = useLens(l_umaId);
	const aptitudes = useGetter(props.state.aptitudes);
	const starCount = useGetter(props.state.starCount);

	const l_uniqueLv = useMemo(() => props.state._lens((state: any) => {
		const min = state.starCount % 3 + Math.floor(state.starCount / 3);
		const max = min + 3;
		return [state.uniqueLv, min, max];
	}, (f: any, state: any) => ({ ...state, uniqueLv: f(state.uniqueLv) })), [props.state]);
	const [uniqueLvData, setUniqueLv] = useLens(l_uniqueLv);

	const skillList = useMemo(() => {
		const u = uniqueSkillForUma(umaId, starCount);
		return Array.from(skills.values()).map((id: any) => (
			<li key={id}>
				<Skill id={id}
					lv={id === u ? { val: uniqueLvData[0], min: uniqueLvData[1], max: uniqueLvData[2], setVal: setUniqueLv } : undefined}
					dismissable={id !== u}
					onDismiss={() => setSkills(SkillSet(Array.from<string>(skills.values()).filter(sid => sid !== id)))}
					onClick={() => { const next = new Set(expanded); next.has(id) ? next.delete(id) : next.add(id); setExpanded(next); }}
				/>
			</li>
		));
	}, [skills, umaId, starCount, uniqueLvData, setUniqueLv, expanded]);

	return (
		<div className="flex flex-col h-full w-full bg-[#1e1f20] text-[#e3e3e3]" style={{ '--accent-color': accentColor } as React.CSSProperties}>
			<div className="h-2 w-full shrink-0 transition-colors" style={{ backgroundColor: accentColor }} />

			<div className="p-6 flex flex-col gap-6 overflow-y-auto">
				{props.children && (
					<div className="text-center font-bold text-[#e3e3e3] text-xl -mb-4 opacity-50">
						{props.children}
					</div>
				)}

				<UmaSelector outfitId={l_umaId} starCount={props.state.starCount} />

				<div className="grid grid-cols-5 border rounded-xl overflow-hidden shadow-sm transition-colors" style={{ borderColor: accentColor }}>
					{[1, 2, 3, 4, 5].map(i => (
						<div key={i} className="flex flex-col border-r last:border-r-0 transition-colors" style={{ borderColor: accentColor }}>
							<div className="bg-[#282a2c] flex items-center justify-center py-1 gap-1 border-b transition-colors" style={{ borderColor: accentColor, color: accentColor }}>
								<img src={`/icons/status_0${i - 1}.png`} className="h-4 w-4 brightness-0 invert opacity-80" />
								<span className="text-[10px] sm:text-xs font-bold uppercase tracking-tight">{(STRINGS.common.stat as any)[i]}</span>
							</div>
							{i === 1 && <Stat value={props.state.speed} />}
							{i === 2 && <Stat value={props.state.stamina} />}
							{i === 3 && <Stat value={props.state.power} />}
							{i === 4 && <Stat value={props.state.guts} />}
							{i === 5 && <Stat value={props.state.wisdom} />}
						</div>
					))}
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-2">
					{/* Motivation */}
					<div className="flex items-center justify-center gap-3 bg-[#131314] h-11 rounded-full border border-[#444746] shadow-sm">
						<span className="text-[10px] font-bold text-[#c4c7c5] uppercase tracking-wider">Motivation</span>
						<img
							src={`/icons/global/utx_ico_motivation_m_0${mood + 2}.png`}
							className="h-7 cursor-pointer hover:scale-110 transition-transform"
							onClick={() => setMood(mood === 2 ? -2 : mood + 1)}
						/>
					</div>

					{/* Style */}
					<div className="flex items-center justify-center gap-3 bg-[#131314] h-11 rounded-full border border-[#444746] shadow-sm">
						<span className="text-[10px] font-bold text-[#c4c7c5] uppercase tracking-wider">Style</span>
						<div className="flex items-center gap-1 text-[#8ab4f8] font-bold text-sm">
							<select
								value={currentStrategy}
								onChange={(e) => setStrategy(e.target.value)}
								className="outline-none bg-transparent font-bold text-sm text-[#8ab4f8] appearance-none cursor-pointer"
							>
								{Object.entries(STRINGS.common.strategy).map(([k, v]) => {
									const val = k === '1' ? 'Nige' : k === '2' ? 'Senkou' : k === '3' ? 'Sasi' : k === '4' ? 'Oikomi' : 'Oonige';
									return <option key={k} value={val} className="bg-[#1e1f20] text-[#e3e3e3]">{v}</option>;
								})}
							</select>
							<div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-[#8ab4f8]"></div>
						</div>
					</div>

					{/* Rank */}
					<div className="flex items-center justify-center bg-[#131314] h-11 rounded-full border border-[#444746] shadow-sm">
						<span className="text-[10px] font-bold text-[#c58af9] uppercase tracking-wider mr-3">Rank</span>
						<div className="flex items-center text-[#c58af9] font-bold text-sm">
							<span>No.</span>
							<input
								type="number"
								value={popularity}
								min="1"
								max="18"
								className="w-8 text-center bg-transparent outline-none font-bold text-[#c58af9] mx-1"
								onInput={(e: any) => setPopularity(+e.target.value)}
							/>
							<span className="text-[#c58af9]">Fav</span>
						</div>
					</div>
				</div>

				<div className="bg-[#131314] rounded-xl p-4 border border-[#444746] flex flex-col gap-4">
					<div className="grid grid-cols-[80px_1fr] items-center gap-4">
						<span className="text-xs font-bold text-[#c4c7c5] uppercase tracking-wider text-right">{STRINGS.select.surfaceaptitude}</span>
						<div className="grid grid-cols-4 gap-2">
							<div className="flex items-center justify-between bg-[#1e1f20] px-3 py-1.5 rounded-lg border border-[#444746] shadow-sm">
								<span className="text-xs font-bold text-[#e3e3e3]">Turf</span>
								<AptitudeSelect a={props.state.aptitudes?.[8]} />
							</div>
							<div className="flex items-center justify-between bg-[#1e1f20] px-3 py-1.5 rounded-lg border border-[#444746] shadow-sm">
								<span className="text-xs font-bold text-[#e3e3e3]">Dirt</span>
								<AptitudeSelect a={props.state.aptitudes?.[9]} />
							</div>
						</div>
					</div>

					<div className="grid grid-cols-[80px_1fr] items-center gap-4">
						<span className="text-xs font-bold text-[#c4c7c5] uppercase tracking-wider text-right">{STRINGS.select.distanceaptitude}</span>
						<div className="grid grid-cols-4 gap-2">
							{[
								{ label: 'Short', idx: 0 },
								{ label: 'Mile', idx: 1 },
								{ label: 'Medium', idx: 2 },
								{ label: 'Long', idx: 3 }
							].map(item => (
								<div key={item.idx} className="flex items-center justify-between bg-[#1e1f20] px-3 py-1.5 rounded-lg border border-[#444746] shadow-sm">
									<span className="text-xs font-bold text-[#e3e3e3]">{item.label}</span>
									<AptitudeSelect a={props.state.aptitudes?.[item.idx]} />
								</div>
							))}
						</div>
					</div>

					<div className="grid grid-cols-[80px_1fr] items-center gap-4">
						<span className="text-xs font-bold text-[#c4c7c5] uppercase tracking-wider text-right">{STRINGS.select.strategyaptitude}</span>
						<div className="grid grid-cols-4 gap-2">
							{[
								{ label: 'Runner', idx: 4 },
								{ label: 'Leader', idx: 5 },
								{ label: 'Between', idx: 6 },
								{ label: 'Chaser', idx: 7 }
							].map(item => (
								<div key={item.idx} className="flex items-center justify-between bg-[#1e1f20] px-3 py-1.5 rounded-lg border border-[#444746] shadow-sm">
									<span className="text-xs font-bold text-[#e3e3e3]">{item.label}</span>
									<AptitudeSelect a={props.state.aptitudes?.[item.idx]} />
								</div>
							))}
						</div>
					</div>
				</div>

				<div
					className="bg-[#282a2c] border rounded-full py-2 text-center font-bold mx-2 shadow-md uppercase tracking-widest text-sm transition-colors"
					style={{ borderColor: accentColor, color: accentColor }}
				>
					{STRINGS.skillheader}
				</div>

				<div className="bg-[#131314] rounded-xl p-3 border border-[#444746] flex-1 overflow-y-auto min-h-[200px]">
					<ul
						ref={skillListRef}
						className="grid grid-cols-1 sm:grid-cols-2 gap-3 grab-scroll"
					>
						{skillList}
						<li className="h-full">
							<button
								className="w-full h-full min-h-[60px] flex items-center justify-center gap-2 bg-[#1e1f20] border-2 border-dashed border-[#444746] rounded-xl text-[#e3e3e3] font-bold hover:bg-[#282a2c] transition-all group hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]"
								onClick={() => setSkillPickerOpen(true)}
							>
								<span className="text-2xl group-hover:scale-125 transition-transform">+</span>
								{STRINGS.addskill}
							</button>
						</li>
					</ul>
				</div>
			</div>
			{skillPickerOpen && (
				<div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
					<div className="bg-[#1e1f20] text-[#e3e3e3] border border-[#444746] w-full max-w-4xl h-[90vh] rounded-3xl overflow-hidden shadow-2xl relative">
						<button
							className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-[#282a2c] rounded-full text-[#c4c7c5] hover:bg-[#444746] transition-colors z-10"
							onClick={() => setSkillPickerOpen(false)}
						>
							✕
						</button>
						<SkillList
							ids={Object.keys(skilldata).filter(id => (skilldata as any)[id].rarity < 3 || id.startsWith(umaId))}
							selected={skills}
							setSelected={(s: any) => { setSkills(s); }}
							isOpen={true}
							onClose={() => setSkillPickerOpen(false)}
						/>
					</div>
				</div>
			)}
		</div>
	);
}