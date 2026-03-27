import { Fragment, cloneElement } from 'react';
import { useState, useReducer, useMemo, useRef, useEffect } from 'react';
import { O, id, useLens, useGetter } from '../optics';
import { SkillList, Skill, ExpandedSkillDetails, SkillCost } from '../components/SkillList';
import { SkillSet, uniqueSkillForUma } from './HorseDefTypes';
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
	const u = (umas as any)[id.slice(0,4)];
	if (!u || !u.outfits[id]) return;
	umaNamesForSearch[id] = (u.outfits[id].epithet + ' ' + u.name[1]).toUpperCase().replace(/\./g, '');
});

function searchNames(query: string) {
	const q = query.toUpperCase().replace(/\./g, '');
	return umaAltIds.filter(oid => umaNamesForSearch[oid].indexOf(q) > -1);
}

function Star({starCount, minStarCount, n}: any) {
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
	const u = value && (umas as any)[value.slice(0,4)];
	const minStarCount = u ? u.outfits[value].rarity : 1;
	const input = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	
	const [query, search] = useReducer((state: any, q: string) => ({
		input: q, 
		suggestions: searchNames(q)
	}), u ? `${u.outfits[value].epithet} ${u.name[1]}` : '', (initial) => ({ input: initial, suggestions: searchNames(initial) }));

	useEffect(() => {
		const currentName = value && (umas as any)[value.slice(0,4)] ? `${(umas as any)[value.slice(0,4)].outfits[value].epithet} ${(umas as any)[value.slice(0,4)].name[1]}` : '';
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
		<div className="umaSelector">
			<div className="umaSelectorIconsBox">
				<div>
					<img src={value ? `/icons/chara/${(icons as any)[value][1]}.png` : randomMob} onClick={() => input.current?.focus()} />
					<div className="umaStarsRow" onClick={(e: any) => {
						const star = e.target.closest('.umaStar');
						if (star) setStarCount(Math.max(minStarCount, +star.dataset.n));
					}}>
						<div className="umaStarContainer">
							{[1,2,3,4,5].map(n => <Star key={n} starCount={starCount} minStarCount={minStarCount} n={n} />)}
						</div>
					</div>
				</div>
				<img src="/icons/utx_ico_umamusume_00.png" onClick={() => input.current?.focus()} />
			</div>
			<div className="umaEpithet"><span>{value && u.outfits[value].epithet}</span></div>
			<div className="umaSelectWrapper">
				<input type="text" className="umaSelectInput" value={query.input} tabIndex={props.tabindex} 
					onInput={(e: any) => search(e.target.value)} 
					onFocus={() => { setOpen(true); search(''); }} 
					onBlur={() => {
						setTimeout(() => {
							setOpen(false);
							const val = valueRef.current;
							const currentName = val && (umas as any)[val.slice(0,4)] ? `${(umas as any)[val.slice(0,4)].outfits[val].epithet} ${(umas as any)[val.slice(0,4)].name[1]}` : '';
							search(currentName);
						}, 250);
					}} 
					ref={input} 
				/>
				<ul className={`umaSuggestions ${open ? 'open' : ''}`}>
					{query.suggestions.slice(0, 50).map((oid) => (
						<li key={oid} className="umaSuggestion" onMouseDown={(e) => { e.preventDefault(); confirm(oid); }}>
							<img src={`/icons/chara/${(icons as any)[oid][1]}.png`} loading="lazy" />
							<span>{(umas as any)[oid.slice(0,4)].outfits[oid].epithet} {(umas as any)[oid.slice(0,4)].name[1]}</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

export function Stat({value: lens, tabindex}: any) {
	const [value, setValue] = useLens(lens);
	const rank = value > 1200 ? Math.min(18 + Math.floor((value - 1200) / 100) * 10 + Math.floor(value / 10) % 10, 97) : (value >= 1150 ? 17 : (value >= 1100 ? 16 : (value >= 400 ? 8 + Math.floor((value - 400) / 100) : Math.floor(value / 50))));
	return (
		<div className="horseParam">
			<img src={`/icons/statusrank/ui_statusrank_${(100 + rank).toString().slice(1)}.png`} />
			<input type="number" min="1" max="2000" value={value} tabIndex={tabindex} onInput={(e: any) => setValue(+e.currentTarget.value)} />
		</div>
	);
}

const APTITUDES = ['S','A','B','C','D','E','F','G'];
export function AptitudeSelect({a: lens, tabindex}: any){
	const [a, setA] = useLens(lens);
	const [open, setOpen] = useState(false);
	const idx = 100 + (7 - APTITUDES.indexOf(a || 'A'));
	return (
		<div className="horseAptitudeSelect" tabIndex={tabindex} onClick={() => setOpen(!open)} onBlur={() => setTimeout(() => setOpen(false), 200)}>
			<span><img src={`/icons/utx_ico_statusrank_${idx.toString().slice(1)}.png`} /></span>
			<ul style={{ display: open ? "block" : "none" }}>
				{APTITUDES.map(apt => <li key={apt} onClick={() => setA(apt)}>
					<img src={`/icons/utx_ico_statusrank_${(100 + (7 - APTITUDES.indexOf(apt))).toString().slice(1)}.png`} />
				</li>)}
			</ul>
		</div>
	);
}

export function HorseDef(props: any) {
	if (!props.state) return null;
	const [skillPickerOpen, setSkillPickerOpen] = useState(false);
	const [expanded, setExpanded] = useState(new Set<string>());
	
	const [skills, setSkills] = useLens(useMemo(() => props.state.skills, [props.state]));
	const [currentStrategy, setStrategy] = useLens(props.state.strategy);
	const [mood, setMood] = useLens(props.state.mood);
	const [popularity, setPopularity] = useLens(props.state.popularity);

	const l_umaId = useMemo(() => props.state._lens((x: any) => x.outfitId, (f: any, state: any) => {
		const id = f(state.outfitId);
		const newSkills = new Map();
		state.skills.forEach((sid: string, g: string) => {
			const sd = (skilldata as any)[sid];
			if (sd && (sd.rarity < 3 || sid[0] === '4' || (sid[0] === '9' && sid.length > 6))) newSkills.set(g, sid);
		});
		if (id && (umas as any)[id.slice(0,4)] && (umas as any)[id.slice(0,4)].outfits[id]) {
			const u = (umas as any)[id.slice(0,4)].outfits[id];
			const strats = ['Nige', 'Senkou', 'Sasi', 'Oikomi'];
			const stratAptitudes = u.aptitudes.slice(4, 8);
			let bestVal = 99, bestIdx = 0;
			for(let i=0; i<4; i++) {
				if(stratAptitudes[i] < bestVal) {
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
	}, (f: any, state: any) => ({...state, uniqueLv: f(state.uniqueLv)})), [props.state]);
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
		<div className="horseDef">
			<div className="horseDefHeader">{props.children}</div>
			<UmaSelector outfitId={l_umaId} starCount={props.state.starCount} />
			<div className="horseParams">
				{[1,2,3,4,5].map(i => <div key={i} className="horseParamHeader"><img src={`/icons/status_0${i-1}.png`} /><span>{(STRINGS.common.stat as any)[i]}</span></div>)}
				<Stat value={props.state.speed} /><Stat value={props.state.stamina} /><Stat value={props.state.power} /><Stat value={props.state.guts} /><Stat value={props.state.wisdom} />
			</div>
			
			<div className="flex flex-col gap-3 px-6 py-3 border-t border-slate-100 bg-slate-50/50">
				<div className="flex justify-between items-center gap-4">
					<div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
						<span className="text-xs font-bold text-slate-500 uppercase">Motivation</span>
						<img src={`/icons/global/utx_ico_motivation_m_0${mood + 2}.png`} className="h-8 cursor-pointer hover:scale-110 transition-transform" 
							onClick={() => setMood(mood === 2 ? -2 : mood + 1)} />
					</div>

					<div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
						<span className="text-xs font-bold text-slate-500 uppercase">Style</span>
						<select value={currentStrategy} onChange={(e)=>setStrategy(e.target.value)} className="outline-none bg-transparent font-bold text-sm text-green-700">
							{Object.entries(STRINGS.common.strategy).map(([k,v]) => <option key={k} value={v === 'Runner' ? 'Nige' : v === 'Leader' ? 'Senkou' : v === 'Betweener' ? 'Sasi' : v === 'Chaser' ? 'Oikomi' : 'Oonige'}>{v}</option>)}
						</select>
					</div>

					<div className="flex items-center font-bold text-purple-700 bg-white px-3 py-1 rounded-lg border border-purple-200 shadow-sm">
						<span className="text-xs font-bold text-purple-400 uppercase mr-2">Rank</span>
						No. <input type="number" value={popularity} min="1" max="18" className="w-8 text-center bg-transparent outline-none font-bold" onInput={(e:any)=>setPopularity(+e.target.value)}/> Fav
					</div>
				</div>

				<div className="horseFullAptitudes">
					<div><span>{STRINGS.select.surfaceaptitude}</span></div>
					<div><span>Turf</span><AptitudeSelect a={props.state.aptitudes?.[8]} /></div>
					<div><span>Dirt</span><AptitudeSelect a={props.state.aptitudes?.[9]} /></div>
					<div /><div />
					<div><span>{STRINGS.select.distanceaptitude}</span></div>
					<div><span>Short</span><AptitudeSelect a={props.state.aptitudes?.[0]} /></div>
					<div><span>Mile</span><AptitudeSelect a={props.state.aptitudes?.[1]} /></div>
					<div><span>Medium</span><AptitudeSelect a={props.state.aptitudes?.[2]} /></div>
					<div><span>Long</span><AptitudeSelect a={props.state.aptitudes?.[3]} /></div>
					<div><span>{STRINGS.select.strategyaptitude}</span></div>
					<div><span>Runner</span><AptitudeSelect a={props.state.aptitudes?.[4]} /></div>
					<div><span>Leader</span><AptitudeSelect a={props.state.aptitudes?.[5]} /></div>
					<div><span>Between</span><AptitudeSelect a={props.state.aptitudes?.[6]} /></div>
					<div><span>Chaser</span><AptitudeSelect a={props.state.aptitudes?.[7]} /></div>
				</div>
			</div>

			<div className="horseSkillHeader">{STRINGS.skillheader}</div>
			<div className="horseSkillListWrapper"><ul className="horseSkillList">{skillList}
				<li><button className="skill addSkillButton" onClick={() => setSkillPickerOpen(true)}><span>+</span>{STRINGS.addskill}</button></li>
			</ul></div>
			{skillPickerOpen && <div className="horseSkillPickerWrapper open"><SkillList ids={Object.keys(skilldata).filter(id => (skilldata as any)[id].rarity < 3 || id.startsWith(umaId))} selected={skills} setSelected={(s:any)=>{setSkills(s); setSkillPickerOpen(false);}} isOpen={true} onClose={()=>setSkillPickerOpen(false)} /></div>}
		</div>
	);
}
