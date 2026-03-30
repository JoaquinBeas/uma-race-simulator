import React, { useState, useMemo, useRef } from 'react';
import './SkillList.css';
import { SkillSet } from './HorseDefTypes';
import { useGrabScroll } from '../lib/useGrabScroll';
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
                <div className="flex items-center text-xs bg-blue-100 text-blue-800 px-1 rounded flex-shrink-0" onClick={e => e.stopPropagation()}>
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
            lvDisplay = <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded whitespace-nowrap flex-shrink-0">Lv {props.lv}</span>;
        }
    }

    return (
        <div className="skill flex items-center gap-2 p-1 border rounded bg-white shadow-sm overflow-hidden" data-skillid={props.id}>
            <div className="w-6 h-6 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center text-xs overflow-hidden">
                {iconSrc ? (
                    <img src={iconSrc} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                    "🐎"
                )}
            </div>
            <span className="text-sm font-bold truncate flex-1">{name}</span>
            {lvDisplay}
            {props.dismissable && (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        props.onDismiss?.();
                    }}
                    className="skillDismiss text-red-500 hover:text-red-700 ml-1 px-1"
                >
                    ✕
                </button>
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
    const listRef = useGrabScroll();

    const filteredSkills = useMemo(() => {
        return (ids || []).filter(id => {
            const name = skillNames[String(id) as keyof typeof skillNames]?.[0] || id.toString();
            return name.toLowerCase().includes(search.toLowerCase());
        });
    }, [ids, search]);

    if (!isOpen) return null;

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <input 
                    type="text" 
                    placeholder="Search skills..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)}
                    className="border border-gray-300 rounded p-2 w-64"
                />
                <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded font-bold">Close</button>
            </div>
            <div 
                ref={listRef}
                className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-2 grab-scroll"
            >
                {filteredSkills.map(id => {
                    const name = skillNames[String(id) as keyof typeof skillNames]?.[0] || id;
                    const isSelected = selected ? Array.from(selected.values()).includes(id) : false;
                    const iconId = (skillMeta as any)[String(id)]?.iconId;
                    const iconSrc = iconId ? `/icons/skill/utx_ico_skill_${iconId}.png` : null;

                    return (
                        <div 
                            key={id} 
                            className={`p-2 border rounded cursor-pointer flex items-center gap-2 ${isSelected ? 'bg-green-100 border-green-500' : 'bg-white hover:bg-gray-50'}`}
                            onClick={() => {
                                const newIds = selected ? Array.from(selected.values() as Iterable<string>) : [];
                                if (!newIds.includes(id)) {
                                    newIds.push(id);
                                } else {
                                    newIds.splice(newIds.indexOf(id), 1);
                                }
                                // We don't close immediately so they can select multiple
                                setSelected(SkillSet(newIds));
                            }}
                        >
                            <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-xs overflow-hidden">
                                {iconSrc ? (
                                    <img src={iconSrc} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                ) : (
                                    "🐎"
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-sm">{name}</div>
                            </div>
                            {isSelected && <div className="text-green-600 font-bold">✓</div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
