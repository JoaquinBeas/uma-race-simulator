import { Fragment, cloneElement } from 'react';
import { useState, useReducer, useMemo, useLayoutEffect, useRef, useEffect } from 'react';

import { O, c, id, useLens, useGetter, Delete } from '../optics';

import { SkillList, Skill, ExpandedSkillDetails, SkillCost } from '../components/SkillList';

import { HorseParameters } from '../uma-skill-tools/HorseTypes';

import { SkillSet, HorseState, uniqueSkillForUma } from './HorseDefTypes';

import './HorseDef.css';

import umas from '../uma-skill-tools/data/umas.json';
import icons from '../uma-skill-tools/data/icons.json';
import skilldata from '../uma-skill-tools/data/skill_data.json';
import skillmeta from '../uma-skill-tools/data/skill_meta.json';

const STRINGS = Object.freeze({
	'select': Object.freeze({
		'strategy': 'Strategy:',
		'surfaceaptitude': 'Surface aptitude:',
		'distanceaptitude': 'Distance aptitude:',
		'strategyaptitude': 'Strategy aptitude:'
	}),
	'skillheader': 'Skills',
	'addskill': 'Add Skill',
	'moodfmt': 'Motivation: {{mood}}',
	'popularity': Object.freeze({
		'pre': 'Popularity:',
		'post': ''
	}),
	'common': Object.freeze({
		'strategy': Object.freeze({
			1: 'Runner',
			2: 'Leader',
			3: 'Betweener',
			4: 'Chaser',
			5: 'Great Runner'
		}),
		'surface': Object.freeze({
			1: 'Turf',
			2: 'Dirt'
		}),
		'distance': Object.freeze({
			1: 'Short',
			2: 'Mile',
			3: 'Medium',
			4: 'Long'
		}),
		'stat': Object.freeze({
			1: 'Speed',
			2: 'Stamina',
			3: 'Power',
			4: 'Guts',
			5: 'Wisdom'
		}),
		'mood': Object.freeze({
			1: 'Worst',
			2: 'Bad',
			3: 'Normal',
			4: 'Good',
			5: 'Best'
		})
	})
});

const umaAltIds = Object.keys(umas).flatMap(id => Object.keys(umas[id].outfits));
const umaNamesForSearch = {};
umaAltIds.forEach(id => {
	const u = umas[id.slice(0,4)];
	if (!u || !u.outfits[id]) return;
	umaNamesForSearch[id] = (u.outfits[id] + ' ' + u.name[1]).toUpperCase().replace(/\./g, '');
});

function searchNames(query) {
	const q = query.toUpperCase().replace(/\./g, '');
	return umaAltIds.filter(oid => umaNamesForSearch[oid].indexOf(q) > -1);
}

function Star(props) {
	const {starCount, minStarCount, n} = props;
	const cls = ['umaStar'];
	if (starCount >= n) cls.push('umaStarGte');
	if (n <= minStarCount) cls.push('umaStarMin');
	return <div className={cls.join(' ')} style={{ zIndex: 5 - n }} data-n={n}></div>
}

export function UmaSelector(props) {
	const randomMob = useMemo(() => `/icons/mob/trained_mob_chr_icon_${8000 + Math.floor(Math.random() * 624)}_000001_01.png`, []);
	const [value, setOutfitId] = useLens(props.outfitId);
	const [starCount, setStarCount] = useLens(props.starCount);
	const u = value && umas[value.slice(0,4)];
	const minStarCount = u ? u.outfits[value].rarity : 1;

	const input = useRef(null);
	const suggestionsContainer = useRef(null);
	const wasClearedByFocus = useRef(false);
	const [open, setOpen] = useState(false);
	const [activeIdx, setActiveIdx] = useState(-1);
	function update(q) {
		return {input: q, suggestions: searchNames(q)};
	}
	const [query, search] = useReducer((_,q) => update(q), u && u.name[1], update);

	function confirm(oid) {
		setOpen(false);
		setOutfitId(oid);
		const uname = umas[oid.slice(0,4)].name[1];
		search(uname);
		setActiveIdx(-1);
		if (input.current != null) {
			input.current.value = uname;
			input.current.blur();
		}
	}

	function focus() {
		input.current && input.current.select();
	}

	function setActiveAndScroll(idx) {
		setActiveIdx(idx);
		if (!suggestionsContainer.current) return;
		const container = suggestionsContainer.current;
		const li = container.querySelector(`[data-uma-id="${query.suggestions[idx]}"]`);
		const ch = container.offsetHeight - 4;  // 4 for borders
		if (li.offsetTop < container.scrollTop) {
			container.scrollTop = li.offsetTop;
		} else if (li.offsetTop >= container.scrollTop + ch) {
			const h = li.offsetHeight;
			container.scrollTop = (li.offsetTop / h - (ch / h - 1)) * h;
		}
	}

	function handleClick(e) {
		const li = e.target.closest('.umaSuggestion');
		if (li == null) return;
		e.stopPropagation();
		confirm(li.dataset.umaId);
	}

	function handleInput(e) {
		wasClearedByFocus.current = false;
		search(e.target.value);
	}

	function handleKeyDown(e) {
		const l = query.suggestions.length;
		switch (e.keyCode) {
			case 13:
				if (activeIdx > -1) confirm(query.suggestions[activeIdx]);
				break;
			case 38:
				setActiveAndScroll((activeIdx - 1 + l) % l);
				break;
			case 40:
				setActiveAndScroll((activeIdx + 1 + l) % l);
				break;
		}
	}

	function handleFocus() {
		setOpen(true);
		wasClearedByFocus.current = true;
		// Don't filter, just show all
		search('');
	}

	function handleBlur(e) {
		const isInputEmpty = e.target.value.length == 0;
		if (isInputEmpty && wasClearedByFocus.current) {
			// Restore the previous value if the user clicked outside without selecting
			// Assuming value holds the currently selected Uma's outfit ID
			if (value && umas[value.slice(0,4)] && umas[value.slice(0,4)].outfits[value]) {
				const u = umas[value.slice(0,4)];
				const outfit = u.outfits[value];
				search(outfit.epithet + ' ' + u.name[1]);
			} else {
				// If nothing was selected, clear
				setOutfitId('');
				search('');
			}
		} else if (isInputEmpty) {
			setOutfitId('');
			search('');
		} else {
			// Restore the previous value if the user clicked outside without selecting
			// Assuming value holds the currently selected Uma's outfit ID
			if (value && umas[value.slice(0,4)] && umas[value.slice(0,4)].outfits[value]) {
				const u = umas[value.slice(0,4)];
				const outfit = u.outfits[value];
				search(outfit.epithet + ' ' + u.name[1]);
			} else {
				// If nothing was selected, clear
				setOutfitId('');
				search('');
			}
		}
		wasClearedByFocus.current = false;
		setOpen(false);
	}

	function handleStarClick(e) {
		const star = e.target.closest('.umaStar');
		if (star == null) return;
		setStarCount(Math.max(minStarCount, +star.dataset.n));
	}

	return (
		<div className="umaSelector">
			<div className="umaSelectorIconsBox">
				<div>
					<img src={value ? `/icons/chara/${icons[value][1]}.png` : randomMob} onClick={focus} />
					<div className="umaStarsRow" onClick={handleStarClick}>
						<div className="umaStarContainer">
							<Star starCount={starCount} minStarCount={minStarCount} n={1} />
							<div className="umaStarContainer">
								<Star starCount={starCount} minStarCount={minStarCount} n={2} />
								<div className="umaStarContainer">
									<Star starCount={starCount} minStarCount={minStarCount} n={3} />
									<div className="umaStarContainer">
										<Star starCount={starCount} minStarCount={minStarCount} n={4} />
										<div className="umaStarContainer">
											<Star starCount={starCount} minStarCount={minStarCount} n={5} />
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<img src="/icons/utx_ico_umamusume_00.png" onClick={focus} />
			</div>
			<div className="umaEpithet"><span>{value && u.outfits[value].epithet}</span></div>
			<div className="umaSelectWrapper">
				<input type="text" className="umaSelectInput" value={query.input} tabIndex={props.tabindex} onInput={handleInput} onKeyDown={handleKeyDown} onFocus={handleFocus} onBlur={handleBlur} ref={input} />
				<ul className={`umaSuggestions ${open ? 'open' : ''}`} onMouseDown={handleClick} ref={suggestionsContainer}>
					{query.suggestions.map((oid, i) => {
						const uid = oid.slice(0,4);
						return (
							<li key={oid} data-uma-id={oid} className={`umaSuggestion ${i == activeIdx ? 'selected' : ''}`}>
								<img src={`/icons/chara/${icons[oid][1]}.png`} loading="lazy" /><span>{umas[uid].outfits[oid].epithet} {umas[uid].name[1]}</span>
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}

function rankForStat(x: number) {
	if (x > 1200) {
		// over 1200 letter (eg UG) goes up by 100 and minor number (eg UG8) goes up by 10
		return Math.min(18 + Math.floor((x - 1200) / 100) * 10 + Math.floor(x / 10) % 10, 97);
	} else if (x >= 1150) {
		return 17; // SS+
	} else if (x >= 1100) {
		return 16; // SS
	} else if (x >= 400) {
		// between 400 and 1100 letter goes up by 100 starting with C (8)
		return 8 + Math.floor((x - 400) / 100);
	} else {
		// between 1 and 400 letter goes up by 50 starting with G+ (0)
		return Math.floor(x / 50);
	}
}

export function Stat(props) {
	const [value, setValue] = useLens(props.value);
	return (
		<div className="horseParam">
			<img src={`/icons/statusrank/ui_statusrank_${(100 + rankForStat(value)).toString().slice(1)}.png`} />
			<input type="number" min="1" max="2000" value={value} tabIndex={props.tabindex} onInput={(e) => setValue(+e.currentTarget.value)} />
		</div>
	);
}

const APTITUDES = Object.freeze(['S','A','B','C','D','E','F','G']);
export function AptitudeIcon(props) {
	const idx = 7 - APTITUDES.indexOf(props.a);
	return <img src={`/icons/utx_ico_statusrank_${(100 + idx).toString().slice(1)}.png`} loading="lazy" />;
}

export function AptitudeSelect(props){
	const [a, setA] = useLens(props.a);
	const [open, setOpen] = useState(false);
	function setAptitude(e) {
		e.stopPropagation();
		setA(e.currentTarget.dataset.horseAptitude);
		setOpen(false);
	}
	function selectByKey(e: KeyboardEvent) {
		const k = e.key.toUpperCase();
		if (APTITUDES.indexOf(k) > -1) {
			setA(k);
			setOpen(false);
		}
	}
	return (
		<div className="horseAptitudeSelect" tabIndex={props.tabindex} onClick={() => setOpen(!open)} onBlur={setOpen.bind(null, false)} onKeyDown={selectByKey}>
			<span><AptitudeIcon a={a} /></span>
			<ul style={open ? { display: "block" } : { display: "none" }}>
				{APTITUDES.map(a => <li key={a} data-horse-aptitude={a} onClick={setAptitude}><AptitudeIcon a={a} /></li>)}
			</ul>
		</div>
	);
}

export function StrategySelect(props) {
	const [s, setS] = useLens(props.s);
	return (
		<select className="horseStrategySelect" value={s} tabIndex={props.tabindex} onInput={(e) => setS(e.currentTarget.value)} style={CC_GLOBAL ? { textAlign: "left" } : null}>
			<option value="Nige">{STRINGS.common.strategy[1]}</option>
			<option value="Senkou">{STRINGS.common.strategy[2]}</option>
			<option value="Sasi">{STRINGS.common.strategy[3]}</option>
			<option value="Oikomi">{STRINGS.common.strategy[4]}</option>
			<option value="Oonige">{STRINGS.common.strategy[5]}</option>
		</select>
	);
}

export function MoodSelect(props) {
	const infix = '/global';
	const [m, setM] = useLens(props.m);
	function cycle() {
		setM((m + 3) % 5 - 2);
	}
	function reverseCycle(e) {
		e.preventDefault();
		setM(((m + 1) % 5 + 5) % 5 - 2);
	}
	function selectByKey(e: KeyboardEvent) {
		const n = parseInt(e.key,10);
		if (!isNaN(n)) {
			setM((n + 4) % 5 - 2);
		}
	}
	const mood = STRINGS.common.mood[m+3];
	return (
		<img src={`/icons${infix}/utx_ico_motivation_m_${(102+m).toString().slice(1)}.png`} tabIndex={props.tabindex} title={STRINGS.moodfmt.replace('{{mood}}', mood)} onClick={cycle} onContextMenu={reverseCycle} onKeyDown={selectByKey} />
	);
}

export function PopularitySelect(props) {
	const [p, setP] = useLens(props.p);
	return (
		<Fragment>
			{STRINGS.popularity.pre}
			<input type="number" min="1" max="18" value={p} tabIndex={props.tabindex} onInput={(e) => setP(+e.currentTarget.value)} />
			{STRINGS.popularity.post}
		</Fragment>
	);
}

const nonUniqueSkills = Object.keys(skilldata).filter(id => skilldata[id].rarity < 3 || skilldata[id].rarity > 5);
const universallyAccessiblePinks = Object.keys(skilldata).filter(id => id[0] == '4' || id[0] == '9' && id.length > 6);

export function isGeneralSkill(id: string) {
	if (!skilldata[id]) return false;
	return skilldata[id].rarity < 3 || universallyAccessiblePinks.indexOf(id) > -1;
}

function skillOrder(a, b) {
	const metaA = skillmeta[a], metaB = skillmeta[b];
	if (!metaA || !metaB) return 0;
	const x = metaA.order, y = metaB.order;
	return +(y < x) - +(x < y) || +(b < a) - +(a < b);
}

export function HorseDef(props) {
	if (!props.state) return null;
	const [skillPickerOpen, setSkillPickerOpen] = useState(false);
	const [expanded, setExpanded] = useState(new Set());
	const strategy = useGetter(props.state.strategy);
	const [oldStrategyState, updateOldStrategyState] = useReducer((ss, msg: boolean | string) => {
		if (typeof msg == 'boolean') {
			return {...ss, oonigeIsNew: msg};
		}
		return {...ss, old: msg};
	}, {oonigeIsNew: true, old: strategy});
	
	const [skills, setSkills] = useLens(useMemo(() => props.state.skills, [props.state]));
	const l_strategy = useMemo(() => props.state.strategy._lens(id, (f,strat) => {
		return f(strat);
	}), [props.state.strategy]);
	const [currentStrategy, setStrategy] = useLens(l_strategy);

	useEffect(() => {
		if (currentStrategy !== 'Oonige') {
			updateOldStrategyState(currentStrategy);
		}
	}, [currentStrategy]);

	useEffect(() => {
		if (skills.has('20205') && oldStrategyState.oonigeIsNew) {
			setStrategy('Oonige');
			updateOldStrategyState(false);
		} else if (!skills.has('20205') && !oldStrategyState.oonigeIsNew) {
			setStrategy(oldStrategyState.old);
			updateOldStrategyState(true);
		}
	}, [skills, oldStrategyState.oonigeIsNew, oldStrategyState.old, setStrategy]);

	const tabstart = props.tabstart();
	let tabi = 0;
	function tabnext() {
		return tabstart + tabi++;
	}

	const l_umaId = useMemo(() => props.state._lens(x => x.outfitId, (f,state) => {
		const id = f(state.outfitId);
		const newSkills = new Map();
		state.skills.forEach((id,g) => isGeneralSkill(id) && newSkills.set(g, id));
		let aptitudes = ['S','S','S','S','A','A','A','A','A','A'];
		let starCount = state.starCount;
		let strategy = state.strategy;
		if (id) {
			const umaData = umas[id.slice(0,4)];
			const u = umaData ? umaData.outfits[id] : null;
			if (u) {
				aptitudes = u.aptitudes.map(i => ' GFEDCBA'[i]);
				starCount = Math.max(starCount, u.rarity);
				strategy = ['', 'Nige', 'Senkou', 'Sasi', 'Oikomi'][u.strategy];
				const uid = uniqueSkillForUma(id, starCount);
				if (skillmeta[uid]) {
					newSkills.set(skillmeta[uid].groupId, uid);
				}
			}
		}
		const uniqueLv = starCount % 3 + Math.floor(starCount / 3);
		return {...state, outfitId: id, starCount, uniqueLv, strategy, skills: newSkills, aptitudes};
	}), [props.state]);
	const umaId = useGetter(l_umaId);
	const initialized = useRef(false);
	useEffect(() => {
		if (!initialized.current && umaId && (!props.state.aptitudes || props.state.aptitudes.every(a => a === 'S' || a === 'A'))) {
			initialized.current = true;
			l_umaId.set(umaId);
		}
	}, [umaId]);
	const selectableSkills = useMemo(() => nonUniqueSkills.filter(id => skilldata[id].rarity != 6 || id.startsWith(umaId) || universallyAccessiblePinks.indexOf(id) != -1), [umaId]);

	const l_starCount = useMemo(() => props.state._lens(x => x.starCount, (f,state) => {
		const starCount = f(state.starCount);
		let skills = state.skills;
		const uniqueLv = starCount % 3 + Math.floor(starCount / 3);
		if (state.outfitId) {
			skills = new Map(state.skills);
			const uid = uniqueSkillForUma(state.outfitId, starCount);
			if (skillmeta[uid]) {
				skills.set(skillmeta[uid].groupId, uid);
			}
		}
		return {...state, starCount, uniqueLv, skills};
	}), [props.state]);
	const starCount = useGetter(l_starCount);

	const l_uniqueLv = useMemo(() => props.state._lens(state => {
		const min = state.starCount % 3 + Math.floor(state.starCount / 3);
		const max = min + 3;
		return [state.uniqueLv, min, max];
	}, (f,state) => ({...state, uniqueLv: f(state.uniqueLv)})),
	[props.state]);

	function openSkillPicker(e) {
		e.stopPropagation();
		setSkillPickerOpen(true);
	}

	function setSkillsAndClose(skills) {
		setSkills(skills);
		setSkillPickerOpen(false);
	}

	function handleSkillClick(e) {
		e.stopPropagation();
		const seh = e.target.closest('.expandedSkillHeader');
		const se = seh != null ? seh.parentNode : e.target.closest('.skill');
		if (se == null) return;
		if (e.target.closest('.skillDismiss')) {
			const entry = Array.from(skills.entries()).find(([g,id]) => id == se.dataset.skillid);
			if (!entry) return;
			const k = entry[0];
			const newSkills = new Map(skills);
			newSkills.delete(k);
			setSkills(newSkills);
		} else if (se.classList.contains('expandedSkill')) {
			expanded.delete(se.dataset.skillid);
			setExpanded(new Set(expanded));
		} else {
			expanded.add(se.dataset.skillid);
			setExpanded(new Set(expanded));
		}
	}

	/*
	useLayoutEffect(function () {
		document.querySelectorAll('.horseExpandedSkill').forEach(e => {
			(e as HTMLElement).style.gridRow = 'span ' + Math.ceil((e.firstChild as HTMLElement).offsetHeight / 64);
		});
	}, [expanded]);
	*/

	function getAptitudesSection() {
		if (!props.state) return null;
		if (!props.state.aptitudes) return null;
		switch (props.aptitudesMode) {
		case 'simulation':
			return (
				<div className="horseAptitudes">
					<div>
						<span>{STRINGS.select.surfaceaptitude}</span>
						<AptitudeSelect a={props.state.surfaceAptitude} tabIndex={tabnext()} />
					</div>
					<div>
						<span>{STRINGS.select.distanceaptitude}</span>
						<AptitudeSelect a={props.state.distanceAptitude} tabIndex={tabnext()} />
					</div>
					<div><MoodSelect m={props.state.mood} tabIndex={tabnext()} /></div>
					<div>
						<span>{STRINGS.select.strategy}</span>
						<StrategySelect s={l_strategy} tabIndex={tabnext()} />
					</div>
					<div>
						<span>{STRINGS.select.strategyaptitude}</span>
						<AptitudeSelect a={props.state.strategyAptitude} tabIndex={tabnext()} />
					</div>
					<div><PopularitySelect p={props.state.popularity} tabIndex={tabnext()} /></div>
				</div>
			);
		case 'full':
			return (
				<div className="horseFullAptitudes">
					<div>
						<span>{STRINGS.select.surfaceaptitude}</span>
					</div>
					<div>
						<span>{STRINGS.common.surface[1]}</span>
						<AptitudeSelect a={props.state.aptitudes?.[8] || 'A'} tabIndex={tabnext()} />
					</div>
					<div>
						<span>{STRINGS.common.surface[2]}</span>
						<AptitudeSelect a={props.state.aptitudes?.[9] || 'A'} tabIndex={tabnext()} />
					</div>
					<div></div>
					<div></div>
					<div>
						<span>{STRINGS.select.distanceaptitude}</span>
					</div>
					<div>
						<span>{STRINGS.common.distance[1]}</span>
						<AptitudeSelect a={props.state.aptitudes?.[0] || 'A'} tabIndex={tabnext()} />
					</div>
					<div>
						<span>{STRINGS.common.distance[2]}</span>
						<AptitudeSelect a={props.state.aptitudes?.[1] || 'A'} tabIndex={tabnext()} />
					</div>
					<div>
						<span>{STRINGS.common.distance[3]}</span>
						<AptitudeSelect a={props.state.aptitudes?.[2] || 'A'} tabIndex={tabnext()} />
					</div>
					<div>
						<span>{STRINGS.common.distance[4]}</span>
						<AptitudeSelect a={props.state.aptitudes?.[3] || 'A'} tabIndex={tabnext()} />
					</div>
					<div>
						<span>{STRINGS.select.strategyaptitude}</span>
					</div>
					<div>
						<span>{STRINGS.common.strategy[1]}</span>
						<AptitudeSelect a={props.state.aptitudes?.[4] || 'A'} tabIndex={tabnext()} />
					</div>
					<div>
						<span>{STRINGS.common.strategy[2]}</span>
						<AptitudeSelect a={props.state.aptitudes?.[5] || 'A'} tabIndex={tabnext()} />
					</div>
					<div>
						<span>{STRINGS.common.strategy[3]}</span>
						<AptitudeSelect a={props.state.aptitudes?.[6] || 'A'} tabIndex={tabnext()} />
					</div>
					<div>
						<span>{STRINGS.common.strategy[4]}</span>
						<AptitudeSelect a={props.state.aptitudes?.[7] || 'A'} tabIndex={tabnext()} />
					</div>
				</div>
			);
		}
	}

	const skillList = useMemo(function () {
		const u = uniqueSkillForUma(umaId, starCount);
		const onDismiss = (id: string) => {
			const currentIds = Array.from((skills as Map<string, string>).values());
			const newIds = currentIds.filter(sid => sid !== id);
			setSkills(SkillSet(newIds));
		};

		return Array.from((skills as Map<string, string>).values()).sort(skillOrder).map(id =>
			expanded.has(id)
				? <li key={id} className="horseExpandedSkill">
					  <ExpandedSkillDetails id={id} distanceFactor={props.courseDistance} lv={id == u && l_uniqueLv} dismissable={id != u}
						  onDismiss={() => onDismiss(id as string)}
						  samplePolicy={props.showPolicyEd ? props.state.samplePolicies.get(id) : null}
						  topChildren={props.hintLevels && <SkillCost id={id} hints={props.hintLevels} ownedSkills={new Map() /* ignore the fact that we own them or the cost would always be 0 */} />} />
					  {props.skillExtra && cloneElement(props.skillExtra, {id})}
				  </li>
				: <li key={id} style={{}}>
					  <Skill id={id} selected={false} lv={id == u && l_uniqueLv} dismissable={id != u} onDismiss={() => onDismiss(id as string)} />
					  {props.skillExtra && cloneElement(props.skillExtra, {id})}
				  </li>
		);
	}, [skills, umaId, expanded, props.courseDistance, props.hintLevels, props.showPolicyEd, props.skillExtra, l_uniqueLv, starCount]);

	return (
		<div className="horseDef">
			<div className="horseDefHeader">{props.children}</div>
			<UmaSelector outfitId={l_umaId} starCount={l_starCount} tabIndex={tabnext()} />
			<div className="horseParams">
				<div className="horseParamHeader"><img src="/icons/status_00.png" /><span>{STRINGS.common.stat[1]}</span></div>
				<div className="horseParamHeader"><img src="/icons/status_01.png" /><span>{STRINGS.common.stat[2]}</span></div>
				<div className="horseParamHeader"><img src="/icons/status_02.png" /><span>{STRINGS.common.stat[3]}</span></div>
				<div className="horseParamHeader"><img src="/icons/status_03.png" /><span>{STRINGS.common.stat[4]}</span></div>
				<div className="horseParamHeader"><img src="/icons/status_04.png" /><span>{STRINGS.common.stat[5]}</span></div>
				<Stat value={props.state.speed} tabIndex={tabnext()} />
				<Stat value={props.state.stamina} tabIndex={tabnext()} />
				<Stat value={props.state.power} tabIndex={tabnext()} />
				<Stat value={props.state.guts} tabIndex={tabnext()} />
				<Stat value={props.state.wisdom} tabIndex={tabnext()} />
			</div>
			{getAptitudesSection()}
			<div className="horseSkillHeader">{props.skillHeader || STRINGS.skillheader}</div>
			<div className="horseSkillListWrapper" onClick={handleSkillClick}>
				<ul className="horseSkillList">
					{skillList}
					<li key="add">
						<button className="skill addSkillButton" onClick={openSkillPicker} tabIndex={tabnext()}>
							<span>+</span>{STRINGS.addskill}
						</button>
					</li>
				</ul>
			</div>
			<div className={`horseSkillPickerOverlay ${skillPickerOpen ? "open" : ""}`} onClick={setSkillPickerOpen.bind(null, false)} />
			<div className={`horseSkillPickerWrapper ${skillPickerOpen ? "open" : ""}`}>
				<SkillList ids={selectableSkills} selected={skills} setSelected={setSkills} isOpen={skillPickerOpen} onClose={() => setSkillPickerOpen(false)} />
			</div>
		</div>
	);
}
