import React, { useRef, useState, useEffect } from 'react';
import skillmeta from '../uma-skill-tools/data/skill_meta.json';
import skilldata from '../uma-skill-tools/data/skill_data.json';
import skillnames from '../uma-skill-tools/data/skillnames.json';
import { useGrabScroll } from '../lib/useGrabScroll';

interface AggregateStats {
    fullSpurtRate: number[];
    finalHp: number[][];
    startDelays: number[][];
    topSpeeds: number[][];
    lengths: number[][];
    skillStats: Map<string, { count: number; posSum: number }>[];
    overtakes: number[];
}

const getStat = (arr: number[], type: 'mean' | 'median' | 'min' | 'max') => {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    if (type === 'min') return sorted[0];
    if (type === 'max') return sorted[sorted.length - 1];
    if (type === 'mean') return arr.reduce((a, b) => a + b, 0) / arr.length;
    if (type === 'median') {
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return 0;
};

const formatValue = (val: number, decimals: number = 2) => val.toFixed(decimals);

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

export const CompareComponent: React.FC<{ stats: AggregateStats; samples: number; umas: any[] }> = ({ stats, samples, umas }) => {
    const numTotalUmas = stats.fullSpurtRate.length;
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

    useEffect(() => {
        // Initialize with first 5 or all if less than 5
        setSelectedIndices(Array.from({ length: Math.min(5, numTotalUmas) }, (_, i) => i));
    }, [numTotalUmas]);

    const toggleUma = (idx: number) => {
        if (selectedIndices.includes(idx)) {
            setSelectedIndices(selectedIndices.filter(i => i !== idx));
        } else if (selectedIndices.length < 5) {
            setSelectedIndices([...selectedIndices, idx].sort((a, b) => a - b));
        }
    };

    const renderStatRow = (label: string, dataArray: number[][], unit: string = '') => {
        const selectedData = selectedIndices.map(idx => dataArray[idx]);
        const means = selectedData.map(data => getStat(data, 'mean'));
        const medians = selectedData.map(data => getStat(data, 'median'));
        const mins = selectedData.map(data => getStat(data, 'min'));
        const maxs = selectedData.map(data => getStat(data, 'max'));

        return (
            <div className="mb-4 border-b border-[#444746] pb-2">
                <div className="text-xs font-bold text-[#c4c7c5] uppercase tracking-wider mb-1">{label}</div>
                <div className="grid text-[11px] gap-1" style={{ gridTemplateColumns: `auto repeat(${selectedIndices.length}, minmax(0, 1fr))` }}>
                    <div className="text-[#c4c7c5]">Mean</div>
                    {means.map((val, i) => <div key={i} className="text-center font-bold text-[#e3e3e3]">{formatValue(val)}{unit}</div>)}
                    
                    <div className="text-[#c4c7c5]">Median</div>
                    {medians.map((val, i) => <div key={i} className="text-center text-[#c4c7c5]">{formatValue(val)}{unit}</div>)}
                    
                    <div className="text-[#c4c7c5]">Min / Max</div>
                    {mins.map((min, i) => <div key={i} className="text-center text-[#c4c7c5]">{formatValue(min)} / {formatValue(maxs[i])}</div>)}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-[#1e1f20] text-[#e3e3e3] rounded-xl shadow-md border border-[#444746] overflow-hidden flex flex-col h-full">
            <div className="bg-[#282a2c] border-b border-[#444746] px-4 py-3 font-semibold text-[#e3e3e3] flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span>Comparison</span>
                    <span className="text-xs font-normal text-[#c4c7c5] italic">Stats across {samples} runs</span>
                </div>
                
                {/* Selection Menu */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                    {Array.from({ length: numTotalUmas }).map((_, i) => {
                        const isSelected = selectedIndices.includes(i);
                        const colors = ['#8ab4f8', '#f28b82', '#81c995', '#fde293', '#c58af9', '#f48fb1', '#8ab4f8', '#81c995', '#fdad31', '#4fd1c5', '#cddc39', '#5eead4', '#f48fb1', '#f28b82', '#8ab4f8', '#c58af9', '#fde293', '#c4c7c5'];
                        const color = colors[i % colors.length];
                        return (
                            <button
                                key={i}
                                onClick={() => toggleUma(i)}
                                disabled={!isSelected && selectedIndices.length >= 5}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${isSelected ? 'bg-[#131314] border-[#444746] shadow-sm' : 'bg-[#282a2c] border-transparent text-[#c4c7c5] opacity-60 hover:opacity-100'}`}
                                style={isSelected ? { color, borderColor: color } : {}}
                            >
                                {umas[i]?.name || `Uma ${i + 1}`}
                            </button>
                        );
                    })}
                    {selectedIndices.length >= 5 && (
                        <span className="text-[9px] text-[#f28b82] flex items-center ml-1">Max 5 reached</span>
                    )}
                </div>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
                {selectedIndices.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[#c4c7c5] italic text-sm">
                        Select up to 5 Umamusumes to compare
                    </div>
                ) : (
                    <>
                        <div className="grid mb-4 text-[10px] font-bold text-[#c4c7c5] uppercase tracking-wider border-b border-[#444746] pb-1" style={{ gridTemplateColumns: `auto repeat(${selectedIndices.length}, minmax(0, 1fr))` }}>
                            <div>Metric</div>
                            {selectedIndices.map(idx => <div key={idx} className="text-center">{umas[idx]?.name || `Uma ${idx + 1}`}</div>)}
                        </div>

                        {renderStatRow('Lengths', stats.lengths, ' l')}
                        {renderStatRow('Top Speed', stats.topSpeeds, 'm/s')}
                        {renderStatRow('HP Remaining', stats.finalHp)}
                        {renderStatRow('Start Delay', stats.startDelays, 's')}

                        <div className="mt-2 mb-4 border-b border-[#444746] pb-2">
                            <div className="text-xs font-bold text-[#c4c7c5] uppercase tracking-wider mb-2">Overtaking (After Opening Leg)</div>
                            <div className="grid text-[11px] gap-1" style={{ gridTemplateColumns: `auto repeat(${selectedIndices.length}, minmax(0, 1fr))` }}>
                                <div className="text-[#c4c7c5]">Overtakes</div>
                                {selectedIndices.map(idx => {
                                    const val = stats.overtakes[idx];
                                    return <div key={idx} className="text-center font-bold text-[#81c995]">{formatValue(val)}</div>;
                                })}
                            </div>
                        </div>

                        <div className="mb-4 border-b border-[#444746] pb-2">
                            <div className="text-xs font-bold text-[#c4c7c5] uppercase tracking-wider mb-1">Full Spurt Rate</div>
                            <div className="grid text-sm items-center" style={{ gridTemplateColumns: `auto repeat(${selectedIndices.length}, minmax(0, 1fr))` }}>
                                <div className="text-[#c4c7c5] text-[11px]">Rate</div>
                                {selectedIndices.map(idx => {
                                    const rate = stats.fullSpurtRate[idx];
                                    const colors = ['#8ab4f8', '#f28b82', '#81c995', '#fde293', '#c58af9', '#f48fb1', '#8ab4f8', '#81c995', '#fdad31', '#4fd1c5', '#cddc39', '#5eead4', '#f48fb1', '#f28b82', '#8ab4f8', '#c58af9', '#fde293', '#c4c7c5'];
                                    const color = colors[idx % colors.length];
                                    return <div key={idx} className="text-center font-bold" style={{ color }}>{formatValue(rate * 100, 1)}%</div>;
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export const SkillTableComponent: React.FC<{ stats: AggregateStats; samples: number; umas: any[] }> = ({ stats, samples, umas }) => {
    const [activeUma, setActiveUma] = React.useState(0);
    const numUmas = stats.fullSpurtRate.length;
    const tabsRef = useGrabScroll();

    const umaSkills = stats.skillStats[activeUma];
    const skillList = Array.from(umaSkills.entries()).filter(([id]) => id !== 'kakari').map(([id, s]) => {
        const meta = (skillmeta as any)[id];
        const data = (skilldata as any)[id];
        return {
            id,
            name: (skillnames as any)[id]?.[0] || (skillmeta as any)[id]?.name || `Skill ${id}`,
            count: s.count,
            rate: (s.count / samples) * 100,
            avgPos: s.count > 0 ? s.posSum / s.count : 0,
            effects: data?.alternatives?.[0]?.effects || []
        };
    }).sort((a, b) => b.rate - a.rate);

    return (
        <div className="bg-[#1e1f20] text-[#e3e3e3] rounded-xl shadow-md border border-[#444746] overflow-hidden flex flex-col h-full">
            <div className="bg-[#282a2c] border-b border-[#444746] px-4 py-2 font-semibold flex justify-between items-center">
                <span>Skill Analysis</span>
                <div 
                    ref={tabsRef}
                    className="flex bg-[#131314] border border-[#444746] rounded-lg p-0.5 overflow-x-auto max-w-[50%] grab-scroll"
                >
                    {Array.from({ length: numUmas }).map((_, i) => {
                        const colors = ['#8ab4f8', '#f28b82', '#81c995', '#fde293', '#c58af9', '#f48fb1', '#8ab4f8', '#81c995', '#fdad31', '#4fd1c5', '#cddc39', '#5eead4', '#f48fb1', '#f28b82', '#8ab4f8', '#c58af9', '#fde293', '#c4c7c5'];
                        const color = colors[i % colors.length];
                        return (
                            <button 
                                key={i}
                                onClick={() => setActiveUma(i)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap ${activeUma === i ? 'bg-[#282a2c] shadow-sm' : 'text-[#c4c7c5] hover:bg-[#1e1f20]'}`}
                                style={activeUma === i ? { color } : {}}
                            >
                                {umas[i]?.name || `Uma ${i + 1}`}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="p-0 flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-[#282a2c] shadow-sm z-10 border-b border-[#444746]">
                        <tr className="text-[10px] font-bold text-[#c4c7c5] uppercase tracking-wider">
                            <th className="px-4 py-2">Skill</th>
                            <th className="px-2 py-2 text-center">Rate</th>
                            <th className="px-2 py-2 text-center">Avg Pos</th>
                            <th className="px-4 py-2">Effects</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs">
                        {skillList.map(skill => (
                            <tr key={skill.id} className="border-b border-[#282a2c] hover:bg-[#282a2c] transition-colors">
                                <td className="px-4 py-2 font-medium text-[#e3e3e3]">{skill.name}</td>
                                <td className="px-2 py-2 text-center font-bold text-[#81c995]">{formatValue(skill.rate, 1)}%</td>
                                <td className="px-2 py-2 text-center text-[#c4c7c5]">{formatValue(skill.avgPos, 0)}m</td>
                                <td className="px-4 py-2">
                                    <div className="flex flex-wrap gap-1">
                                        {skill.effects.map((e: any, i: number) => (
                                            <span key={i} className="bg-[#131314] border border-[#444746] text-[#c4c7c5] px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                                                {EFFECT_TYPE_MAP[e.type] || 'Unknown'}: {e.modifier > 1000 ? (e.modifier / 10000).toFixed(2) : e.modifier}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {skillList.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-[#c4c7c5] italic">No skills activated</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const StaminaCalculatorComponent: React.FC<{ stats: AggregateStats; umas: any[]; courseDistance: number }> = ({ stats, umas, courseDistance }) => {
    const calculateStamina = (uma: any, finalHps: number[]) => {
        const avgFinalHp = getStat(finalHps, 'mean');
        return {
            avgFinalHp,
        };
    };

    const staminaStats = umas.map((uma, i) => calculateStamina(uma, stats.finalHp[i]));

    return (
        <div className="bg-[#1e1f20] text-[#e3e3e3] rounded-xl shadow-md border border-[#444746] overflow-hidden flex flex-col h-full">
            <div className="bg-[#282a2c] border-b border-[#444746] px-4 py-3 font-semibold text-[#e3e3e3]">
                Stamina Calculator
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-6">
                {umas.map((uma, i) => {
                    const s = staminaStats[i];
                    const colors = ['#8ab4f8', '#f28b82', '#81c995', '#fde293', '#c58af9', '#f48fb1', '#8ab4f8', '#81c995', '#fdad31', '#4fd1c5', '#cddc39', '#5eead4', '#f48fb1', '#f28b82', '#8ab4f8', '#c58af9', '#fde293', '#c4c7c5'];
                    const color = colors[i % colors.length];
                    return (
                        <div key={i} className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="text-xs font-bold text-[#c4c7c5] uppercase tracking-wider">{uma.name || `Uma ${i + 1}`} Profile</div>
                                <div className="flex gap-2 text-[10px]">
                                    <span className="bg-[#131314] border border-[#444746] px-1.5 py-0.5 rounded text-[#c4c7c5]">STA: {uma.stamina}</span>
                                    <span className="bg-[#131314] border border-[#444746] px-1.5 py-0.5 rounded text-[#c4c7c5]">GUT: {uma.guts}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
                                    <div className="text-[10px] font-bold uppercase" style={{ color }}>Avg. Final HP</div>
                                    <div className="text-xl font-bold" style={{ color }}>{formatValue(s.avgFinalHp, 1)}</div>
                                </div>
                                <div className="bg-[#282a2c] border border-[#444746] p-3 rounded-lg">
                                    <div className="text-[10px] text-[#c4c7c5] font-bold uppercase">Status</div>
                                    <div className={`text-sm font-bold ${s.avgFinalHp > 50 ? 'text-[#81c995]' : s.avgFinalHp > 0 ? 'text-[#fde293]' : 'text-[#f28b82]'}`}>
                                        {s.avgFinalHp > 50 ? 'Healthy' : s.avgFinalHp > 0 ? 'Tight' : 'Out of Stamina'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <div className="pt-4 border-t border-[#444746]">
                    <p className="text-[10px] text-[#c4c7c5] leading-relaxed">
                        * Final HP is the remaining stamina at the finish line. 
                        Values below 0 indicate the Umamusume ran out of stamina before finishing, 
                        likely resulting in a significant speed penalty.
                    </p>
                </div>
            </div>
        </div>
    );
};