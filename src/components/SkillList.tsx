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

export const Skill: React.FC<any> = (props) => {
    const name = skillNames[String(props.id) as keyof typeof skillNames]?.[0] || props.id;
    const iconId = (skillMeta as any)[String(props.id)]?.iconId;
    const iconSrc = iconId ? `/icons/skill/utx_ico_skill_${iconId}.png` : null;

    let lvDisplay = null;
    if (props.lv) {
        if (typeof props.lv === 'object' && props.lv.setVal) {
            lvDisplay = (
                <div className="flex items-center text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <span className="mr-1 uppercase tracking-tighter">Lv</span>
                    <select 
                        value={props.lv.val} 
                        onChange={(e) => props.lv.setVal(parseInt(e.target.value, 10))}
                        className="bg-transparent font-bold outline-none cursor-pointer appearance-none"
                    >
                        {Array.from({length: props.lv.max - props.lv.min + 1}, (_, i) => props.lv.min + i).map(n => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                    <div className="ml-1 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[3px] border-t-blue-600"></div>
                </div>
            );
        } else {
            lvDisplay = <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 whitespace-nowrap flex-shrink-0">Lv {props.lv}</span>;
        }
    }

    return (
        <div className="group flex items-center gap-3 p-2 border border-gray-200 rounded-xl bg-white shadow-sm hover:border-[#8bc34a] hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer" data-skillid={props.id} onClick={props.onClick}>
            <div className="w-10 h-10 bg-gray-50 rounded-lg flex-shrink-0 flex items-center justify-center text-xs overflow-hidden border border-gray-100 group-hover:scale-105 transition-transform">
                {iconSrc ? (
                    <img src={iconSrc} alt="" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                ) : (
                    "🐎"
                )}
            </div>
            <span className="text-sm font-bold text-[#794016] truncate flex-1">{name}</span>
            <div className="flex items-center gap-2">
                {lvDisplay}
                {props.dismissable && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onDismiss?.();
                        }}
                        className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                        ✕
                    </button>
                )}
            </div>
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
                <div className="flex items-center text-xs bg-blue-100 text-blue-800 px-1 rounded inline-flex whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <span className="mr-1">Lv</span>
                    <select 
                        value={props.lv.val} 
                        onChange={(e) => props.lv.setVal(parseInt(e.target.value, 10))}
                        className="bg-transparent font-bold outline-none cursor-pointer"
                        style={{ paddingRight: '2px' }}
                    >
                        {Array.from({length: props.lv.max - props.lv.min + 1}, (_, i) => props.lv.min + i).map(n => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </div>
            );
        } else {
            lvDisplay = <div className="text-xs bg-blue-100 text-blue-800 px-1 rounded inline-block whitespace-nowrap">Lv {props.lv}</div>;
        }
    }

    return (
        <div className="expandedSkill flex items-center justify-between p-2 border rounded bg-white shadow-sm w-full overflow-hidden" data-skillid={props.id}>
            <div className="expandedSkillHeader flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center text-xs overflow-hidden">
                    {iconSrc ? (
                        <img src={iconSrc} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                        "🐎"
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{name}</div>
                    {lvDisplay}
                </div>
            </div>
            {props.dismissable && (
                <button 
                    onClick={props.onDismiss}
                    className="skillDismiss flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded ml-2"
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
        { id: 'all', label: 'All', color: 'bg-gray-100 text-gray-700' },
        { id: 'speed', label: 'Speed', color: 'bg-orange-100 text-orange-700' },
        { id: 'accel', label: 'Accel', color: 'bg-red-100 text-red-700' },
        { id: 'recovery', label: 'Recovery', color: 'bg-blue-100 text-blue-700' },
        { id: 'debuff', label: 'Debuff', color: 'bg-purple-100 text-purple-700' },
        { id: 'others', label: 'Others', color: 'bg-slate-100 text-slate-700' },
        { id: 'selected', label: 'Selected', color: 'bg-yellow-100 text-yellow-700' },
    ];

    return (
        <div className="flex flex-col h-full max-h-[80vh]">
            <div className="flex flex-col gap-4 mb-4 border-b pb-4 sticky top-0 bg-white z-10">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-blue-600" />
                        <h2 className="text-xl font-bold text-slate-800">Select Skills</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <Search className="h-5 w-5" />
                        </span>
                        <input 
                            type="text" 
                            placeholder="Search skills by name..." 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {filterButtons.map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => setFilterType(btn.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filterType === btn.id ? btn.color + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>
            </div>

            <div 
                ref={listRef}
                className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-1 grab-scroll"
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
                                className={`group relative p-3 border rounded-2xl cursor-pointer flex items-center gap-3 transition-all duration-200 ${isSelected ? 'bg-blue-50 border-blue-400 shadow-md ring-1 ring-blue-400' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm'}`}
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
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs overflow-hidden transition-transform group-hover:scale-110 ${isSelected ? 'bg-blue-100' : 'bg-slate-50'}`}>
                                    {iconSrc ? (
                                        <img src={iconSrc} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                    ) : (
                                        "🐎"
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`font-bold text-sm truncate ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>{name}</div>
                                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{type}</div>
                                </div>
                                {isSelected && (
                                    <div className="bg-blue-500 text-white rounded-full p-1 shadow-sm">
                                        <Check className="h-3 w-3" />
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-12 text-center text-slate-400">
                        <div className="text-4xl mb-2">🔍</div>
                        <p>No skills found matching your criteria</p>
                    </div>
                )}
            </div>
            
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <div className="text-sm text-slate-500">
                    <span className="font-bold text-blue-600">{selected ? selected.size : 0}</span> skills selected
                </div>
                <button 
                    onClick={onClose} 
                    className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-xl font-bold transition-colors shadow-lg shadow-slate-200"
                >
                    Done
                </button>
            </div>
        </div>
    );
};
