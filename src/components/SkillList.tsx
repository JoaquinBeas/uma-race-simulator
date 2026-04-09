import React, { useState, useMemo, useRef } from 'react';
import './SkillList.css';
import { SkillSet } from './HorseDefTypes';
import { useGrabScroll } from '../lib/useGrabScroll';
import { Search, X, Check, Filter } from 'lucide-react';
import skillsData from '../uma-skill-tools/data/skill_data.json';
import skillNames from '../uma-skill-tools/data/skillnames.json';
import skillMeta from '../uma-skill-tools/data/skill_meta.json';

// Mocking missing dependencies for now
const ConditionParser = {
    parse: (cond: string) => ({ cond }),
};
const ConditionMatcher = {
    match: () => true,
};
const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => (
    <div className="tooltip-container">
        {children}
        <span className="tooltip-text">{text}</span>
    </div>
);
const Language = {
    get: (key: string) => key,
};

interface SkillListProps {
    ids: string[];
    selected: Map<string, string>;
    setSelected: (skills: Map<string, string>) => void;
    onClose: () => void;
    isOpen: boolean;
}

export const skillGroups = new Map<number, string[]>();
export const costForId = (id: string, hints: Map<string, number>, owned: Map<string, string>) => 0;

const EFFECT_TYPE_MAP: Record<number, string> = {
    27: 'Speed',
    31: 'Accel',
    9: 'Heal',
    21: 'Speed Down',
    28: 'Guts',
    10: 'Wisdom',
    8: 'Lane',
    1: 'Speed (Passive)',
    2: 'Stamina (Passive)',
    3: 'Power (Passive)',
    4: 'Guts (Passive)',
    5: 'Wisdom (Passive)',
};

export const Skill: React.FC<any> = (props) => {
    const name = skillNames[String(props.id) as keyof typeof skillNames]?.[0] || props.id;
    const iconId = (skillMeta as any)[String(props.id)]?.iconId;
    const iconSrc = iconId ? `${import.meta.env.BASE_URL}icons/skill/utx_ico_skill_${iconId}.png` : null;
    const skillData = (skillsData as any)[String(props.id)];

    let lvDisplay = null;
    if (props.lv) {
        if (typeof props.lv === 'object' && props.lv.setVal) {
            lvDisplay = (
                <div className="flex items-center text-[10px] font-bold bg-[#282a2c] text-[#8ab4f8] px-2 py-0.5 rounded-full border border-[#444746] flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <span className="mr-1 uppercase tracking-tighter">Lv</span>
                    <select
                        value={props.lv.val}
                        onChange={(e) => props.lv.setVal(parseInt(e.target.value, 10))}
                        className="bg-transparent font-bold outline-none cursor-pointer appearance-none text-[#8ab4f8]"
                    >
                        {Array.from({ length: props.lv.max - props.lv.min + 1 }, (_, i) => props.lv.min + i).map(n => (
                            <option key={n} value={n} className="bg-[#1e1f20]">{n}</option>
                        ))}
                    </select>
                    <div className="ml-1 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[3px] border-t-[#8ab4f8]"></div>
                </div>
            );
        } else {
            lvDisplay = <span className="text-[10px] font-bold bg-[#282a2c] text-[#8ab4f8] px-2 py-0.5 rounded-full border border-[#444746] whitespace-nowrap flex-shrink-0">Lv {props.lv}</span>;
        }
    }

    return (
        <div
            className={`group flex flex-col p-2 border rounded-xl bg-[#131314] shadow-sm transition-all duration-200 overflow-hidden cursor-pointer ${props.isExpanded ? 'border-[#8ab4f8] ring-1 ring-[#8ab4f8]' : 'border-[#444746] hover:border-[#c4c7c5]'}`}
            data-skillid={props.id}
            onClick={props.onClick}
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1e1f20] rounded-lg flex-shrink-0 flex items-center justify-center text-xs overflow-hidden border border-[#444746] group-hover:scale-105 transition-transform">
                    {iconSrc ? (
                        <img src={iconSrc} alt="" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                    ) : (
                        "🐎"
                    )}
                </div>
                <span className={`text-sm font-bold truncate flex-1 transition-colors ${props.isExpanded ? 'text-[#8ab4f8]' : 'text-[#e3e3e3]'}`}>{name}</span>
                <div className="flex items-center gap-2">
                    {lvDisplay}
                    {props.dismissable && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                props.onDismiss?.();
                            }}
                            className="w-6 h-6 flex items-center justify-center text-[#c4c7c5] hover:text-[#f28b82] hover:bg-[#282a2c] rounded-full transition-colors"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded Skill Data Section */}
            {props.isExpanded && skillData && skillData.alternatives && (
                <div
                    className="mt-3 pt-3 border-t border-[#444746] flex flex-col gap-3 text-xs text-[#c4c7c5] cursor-text"
                    onClick={e => e.stopPropagation()} /* Prevents collapse when trying to highlight/copy text */
                >
                    {skillData.alternatives.map((alt: any, idx: number) => (
                        <div key={idx} className="flex flex-col gap-1.5 bg-[#1e1f20] p-2 rounded-lg border border-[#444746]">
                            {alt.precondition && (
                                <div className="break-words leading-relaxed">
                                    <span className="text-[#8ab4f8] font-bold mr-1">Pre:</span>
                                    {alt.precondition}
                                </div>
                            )}
                            {alt.condition && (
                                <div className="break-words leading-relaxed">
                                    <span className="text-[#8ab4f8] font-bold mr-1">Cond:</span>
                                    {alt.condition}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                <span className="bg-[#282a2c] px-2 py-0.5 rounded border border-[#444746] text-[#e3e3e3] font-mono">
                                    Dur: {(alt.baseDuration / 10000).toFixed(2)}s
                                </span>
                                {alt.effects.map((e: any, i: number) => (
                                    <span key={i} className="bg-[#282a2c] px-2 py-0.5 rounded border border-[#444746] text-[#e3e3e3] font-mono">
                                        {EFFECT_TYPE_MAP[e.type] || `Type ${e.type}`}: {e.modifier > 1000 ? (e.modifier / 10000).toFixed(2) : e.modifier}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const ExpandedSkillDetails: React.FC<any> = (props) => {
    const name = skillNames[String(props.id) as keyof typeof skillNames]?.[0] || props.id;
    const iconId = (skillMeta as any)[String(props.id)]?.iconId;
    const iconSrc = iconId ? `/icons/skill/utx_ico_skill_${iconId}.png` : null;

    let lvDisplay = null;
    if (props.lv) {
        if (typeof props.lv === 'object' && props.lv.setVal) {
            lvDisplay = (
                <div className="flex items-center text-xs bg-[#282a2c] text-[#8ab4f8] px-1 rounded inline-flex whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <span className="mr-1">Lv</span>
                    <select
                        value={props.lv.val}
                        onChange={(e) => props.lv.setVal(parseInt(e.target.value, 10))}
                        className="bg-transparent font-bold outline-none cursor-pointer"
                        style={{ paddingRight: '2px' }}
                    >
                        {Array.from({ length: props.lv.max - props.lv.min + 1 }, (_, i) => props.lv.min + i).map(n => (
                            <option key={n} value={n} className="bg-[#1e1f20]">{n}</option>
                        ))}
                    </select>
                </div>
            );
        } else {
            lvDisplay = <div className="text-xs bg-[#282a2c] text-[#8ab4f8] px-1 rounded inline-block whitespace-nowrap">Lv {props.lv}</div>;
        }
    }

    return (
        <div className="expandedSkill flex items-center justify-between p-2 border border-[#444746] rounded bg-[#131314] shadow-sm w-full overflow-hidden" data-skillid={props.id}>
            <div className="expandedSkillHeader flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 bg-[#1e1f20] rounded flex-shrink-0 flex items-center justify-center text-xs overflow-hidden">
                    {iconSrc ? (
                        <img src={iconSrc} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                        "🐎"
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate text-[#e3e3e3]">{name}</div>
                    {lvDisplay}
                </div>
            </div>
            {props.dismissable && (
                <button
                    onClick={props.onDismiss}
                    className="skillDismiss flex-shrink-0 text-[#f28b82] hover:text-[#e06c64] hover:bg-[#282a2c] p-1 rounded ml-2"
                >
                    ✕
                </button>
            )}
        </div>
    );
};
export const SkillCost: React.FC<any> = (props) => null;

export const SkillList: React.FC<SkillListProps> = ({ ids, selected, setSelected, isOpen, onClose }) => {
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const listRef = useGrabScroll();

    const getSkillType = (id: string) => {
        const iconId = (skillMeta as any)[id]?.iconId?.toString() || '';
        if (iconId.startsWith('2001') || iconId.startsWith('1001')) return 'speed';
        if (iconId.startsWith('2004') || iconId.startsWith('1003')) return 'accel';
        if (iconId.startsWith('2002') || iconId.startsWith('1002')) return 'recovery';
        if (iconId.startsWith('300')) return 'debuff';
        return 'others';
    };

    const filteredSkills = useMemo(() => {
        return (ids || []).filter(id => {
            const name = skillNames[String(id) as keyof typeof skillNames]?.[0] || id.toString();
            const matchesSearch = name.toLowerCase().includes(search.toLowerCase());

            if (!matchesSearch) return false;

            if (filterType === 'all') return true;
            if (filterType === 'selected') return selected ? Array.from(selected.values()).includes(id) : false;

            return getSkillType(id.toString()) === filterType;
        });
    }, [ids, search, filterType, selected]);

    if (!isOpen) return null;

    const filterButtons = [
        { id: 'all', label: 'All', activeClass: 'bg-[#e3e3e3] text-[#131314] border-[#e3e3e3]' },
        { id: 'speed', label: 'Speed', activeClass: 'bg-[#fdad31]/20 text-[#fdad31] border-[#fdad31]' },
        { id: 'accel', label: 'Accel', activeClass: 'bg-[#f28b82]/20 text-[#f28b82] border-[#f28b82]' },
        { id: 'recovery', label: 'Recovery', activeClass: 'bg-[#81c995]/20 text-[#81c995] border-[#81c995]' },
        { id: 'debuff', label: 'Debuff', activeClass: 'bg-[#c58af9]/20 text-[#c58af9] border-[#c58af9]' },
        { id: 'others', label: 'Others', activeClass: 'bg-[#e3e3e3]/20 text-[#e3e3e3] border-[#e3e3e3]' },
        { id: 'selected', label: 'Selected', activeClass: 'bg-[#8ab4f8]/20 text-[#8ab4f8] border-[#8ab4f8]' },
    ];

    return (
        <div className="flex flex-col h-full bg-[#1e1f20]">
            {/* HEADER - shrink-0 ensures it doesn't compress */}
            <div className="flex flex-col gap-4 p-4 border-b border-[#444746] shrink-0">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 pr-8">
                        <Filter className="h-5 w-5 text-[#8ab4f8]" />
                        <h2 className="text-xl font-bold text-[#e3e3e3]">Select Skills</h2>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#c4c7c5]">
                            <Search className="h-5 w-5" />
                        </span>
                        <input
                            type="text"
                            placeholder="Search skills by name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full bg-[#131314] text-[#e3e3e3] border border-[#444746] rounded-xl focus:ring-2 focus:ring-[#8ab4f8] focus:border-transparent outline-none transition-all placeholder-[#c4c7c5]"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {filterButtons.map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => setFilterType(btn.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${filterType === btn.id ? btn.activeClass : 'bg-[#131314] text-[#c4c7c5] border-[#444746] hover:bg-[#282a2c]'}`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* SCROLLABLE LIST - flex-1 allows it to take all remaining space */}
            <div
                ref={listRef}
                className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 grab-scroll bg-[#131314]"
                style={{ alignContent: 'start' }}
            >
                {filteredSkills.length > 0 ? (
                    filteredSkills.map(id => {
                        const name = skillNames[String(id) as keyof typeof skillNames]?.[0] || id;
                        const isSelected = selected ? Array.from(selected.values()).includes(id) : false;
                        const iconId = (skillMeta as any)[String(id)]?.iconId;
                        const iconSrc = iconId ? `/icons/skill/utx_ico_skill_${iconId}.png` : null;
                        const type = getSkillType(id.toString());

                        return (
                            <div
                                key={id}
                                className={`group relative p-3 border rounded-2xl cursor-pointer flex items-center gap-3 transition-all duration-200 h-[68px] ${isSelected ? 'bg-[#8ab4f8]/10 border-[#8ab4f8] shadow-md ring-1 ring-[#8ab4f8]' : 'bg-[#1e1f20] border-[#444746] hover:border-[#c4c7c5] hover:bg-[#282a2c]'}`}
                                onClick={() => {
                                    const newIds = selected ? Array.from(selected.values() as Iterable<string>) : [];
                                    if (!newIds.includes(id)) {
                                        newIds.push(id);
                                    } else {
                                        newIds.splice(newIds.indexOf(id), 1);
                                    }
                                    setSelected(SkillSet(newIds));
                                }}
                            >
                                <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-xs overflow-hidden transition-transform group-hover:scale-110 ${isSelected ? 'bg-[#8ab4f8]/20' : 'bg-[#131314]'}`}>
                                    {iconSrc ? (
                                        <img src={iconSrc} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                    ) : (
                                        "🐎"
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`font-bold text-sm truncate ${isSelected ? 'text-[#8ab4f8]' : 'text-[#e3e3e3]'}`}>{name}</div>
                                    <div className="text-[10px] uppercase tracking-wider font-bold text-[#c4c7c5]">{type}</div>
                                </div>
                                {isSelected && (
                                    <div className="bg-[#8ab4f8] text-[#131314] rounded-full p-1 shadow-sm shrink-0">
                                        <Check className="h-3 w-3" />
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-12 text-center text-[#c4c7c5]">
                        <div className="text-4xl mb-2">🔍</div>
                        <p>No skills found matching your criteria</p>
                    </div>
                )}
            </div>

            {/* FOOTER - shrink-0 ensures it's always visible and pinned to bottom */}
            <div className="p-4 border-t border-[#444746] bg-[#1e1f20] flex justify-between items-center shrink-0">
                <div className="text-sm text-[#c4c7c5]">
                    <span className="font-bold text-[#8ab4f8]">{selected ? selected.size : 0}</span> skills selected
                </div>
                <button
                    onClick={onClose}
                    className="bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#131314] px-6 py-2 rounded-xl font-bold transition-colors"
                >
                    Done
                </button>
            </div>
        </div>
    );
};