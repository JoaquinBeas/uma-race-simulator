import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { O, State, makeState, useGetter, useSetter } from '../optics';
import { SkillSet, DEFAULT_HORSE_STATE, uniqueSkillForUma } from '../components/HorseDefTypes';
import { HorseDef } from '../components/HorseDef';
import { RaceTrack, TrackSelect, RegionDisplayType } from '../components/RaceTrack';
import { CourseHelpers } from '../uma-skill-tools/CourseData';
import { runComparison } from '../umalator/compare';
import { CompareComponent, SkillTableComponent, StaminaCalculatorComponent } from './AnalysisComponents';
import { useGrabScroll } from '../lib/useGrabScroll';
import umas from '../uma-skill-tools/data/umas.json';
import skillmeta from '../uma-skill-tools/data/skill_meta.json';
import skillnames from '../uma-skill-tools/data/skillnames.json';
import { defaultRace } from '../uma-skill-tools/data';

import './app.css';

// Shared color palette for Umas
export const UMA_COLORS = ['#8ab4f8', '#f28b82', '#81c995', '#fde293', '#c58af9', '#f48fb1', '#8ab4f8', '#81c995', '#fdad31', '#4fd1c5', '#cddc39', '#5eead4', '#f48fb1', '#f28b82', '#8ab4f8', '#c58af9', '#fde293', '#c4c7c5'];

const UI_STRINGS = Object.freeze({
    'umaheader': 'Umamusume Details',
    'skillheader': 'Skills'
});

const RaceTrackBackground = (props: any) => {
    const { courseid, x, y, width, height, viewBox, regions } = props;

    const renderX = x !== undefined ? x : (viewBox?.x || 20);
    const renderY = y !== undefined ? y : (viewBox?.y || 10);
    const renderWidth = width !== undefined ? width : (viewBox?.width || "100%");
    const renderHeight = height !== undefined ? height : (viewBox?.height || "100%");

    return (
        <foreignObject
            x={renderX}
            y={renderY}
            width={renderWidth}
            height={renderHeight}
            style={{ pointerEvents: 'none', opacity: 0.8 }}
        >
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: '100%', height: '100%' }}>
                <RaceTrack courseid={courseid} width="100%" height="100%" hideHeader={true} regions={regions || []} xOffset={0} yOffset={0} xExtra={0} yExtra={0} />
            </div>
        </foreignObject>
    );
};

const CustomSkillLabel = (props: any) => {
    const { viewBox, value, fill, index } = props;
    return (
        <text x={viewBox.x} y={viewBox.y + 15 + (index * 12)} fill={fill} fontSize={10} textAnchor="middle">
            {value}
        </text>
    );
};

const RaceGraphVisualizer: React.FC<{ runData: any, aggregateStats: any, courseDistance: number, courseid: number, umas: any[] }> = ({ runData, aggregateStats, courseDistance, courseid, umas }) => {
    const [viewMode, setViewMode] = useState<'speed' | 'hp' | 'both' | 'distance'>('speed');
    const [selectedRun, setSelectedRun] = useState<'meanrun' | 'medianrun' | 'minrun' | 'maxrun'>('meanrun');
    const [selectedUma, setSelectedUma] = useState<number | 'all'>('all');
    const [showSkills, setShowSkills] = useState(false);

    const currentRun = runData[selectedRun];

    const chartMargins = { top: 10, right: 30, left: 20, bottom: 30 };

    const skillRegions = useMemo(() => {
        if (!showSkills || !aggregateStats || !aggregateStats.skillStats) return [];
        const regions: any[] = [];
        
        aggregateStats.skillStats.forEach((umaSkills: Map<string, any>, umaIdx: number) => {
            if (selectedUma !== 'all' && selectedUma !== umaIdx) return;
            
            umaSkills.forEach((s: any, skillId: string) => {
                if (skillId === 'downhill' || skillId === 'kakari') return;
                if (s.count === 0) return; // Didn't activate
                
                const skillName = (skillnames as any)[skillId]?.[0] || (skillmeta as any)[skillId]?.name || skillId;
                const color = UMA_COLORS[umaIdx % UMA_COLORS.length];
                const avgPos = s.posSum / s.count;
                const avgDuration = (s.durationSum || 0) / s.count;
                
                regions.push({
                    type: RegionDisplayType.Textbox,
                    regions: [{ start: avgPos, end: avgPos + Math.max(avgDuration, 15) }],
                    color: { stroke: color, fill: color + '60' }, // Slightly more opaque fill
                    text: skillName,
                    height: 10
                });
            });
        });
        return regions;
    }, [aggregateStats, showSkills, selectedUma]);

    const chartData = useMemo(() => {
        if (!currentRun) return [];
        const data: any[] = [];
        const numUmas = currentRun.p.length;

        const numPoints = 200;

        if (viewMode === 'distance') {
            const maxTime = Math.max(...currentRun.t.map((t: any[]) => t[t.length - 1] || 0));
            for (let i = 0; i <= numPoints; i++) {
                const targetTime = (maxTime / numPoints) * i;
                const point: any = { time: parseFloat(targetTime.toFixed(2)) };

                for (let u = 0; u < numUmas; u++) {
                    const horseTime = currentRun.t[u];
                    const horsePos = currentRun.p[u];
                    if (!horseTime || horseTime.length === 0) continue;
                    let idx = 0;
                    let minDiff = Infinity;
                    for (let j = 0; j < horseTime.length; j++) {
                        const diff = Math.abs(horseTime[j] - targetTime);
                        if (diff < minDiff) { minDiff = diff; idx = j; }
                        else if (diff > minDiff) break;
                    }
                    point[`uma${u + 1}`] = Math.max(0, courseDistance - horsePos[idx]);
                }
                data.push(point);
            }
        } else {
            for (let i = 0; i <= numPoints; i++) {
                const targetPos = (courseDistance / numPoints) * i;
                const point: any = { distance: Math.round(targetPos) };

                for (let u = 0; u < numUmas; u++) {
                    const horsePos = currentRun.p[u];
                    let idx = 0;
                    let minDiff = Infinity;
                    for (let j = 0; j < horsePos.length; j++) {
                        const diff = Math.abs(horsePos[j] - targetPos);
                        if (diff < minDiff) { minDiff = diff; idx = j; }
                        else if (diff > minDiff) {
                            if (j > 0 && horsePos[j] > targetPos + 100) break;
                        }
                    }

                    if (viewMode === 'speed') point[`uma${u + 1}`] = currentRun.v[u][idx];
                    else if (viewMode === 'hp') point[`uma${u + 1}`] = currentRun.hp[u][idx];
                    else {
                        point[`uma${u + 1}Speed`] = currentRun.v[u][idx];
                        point[`uma${u + 1}Hp`] = currentRun.hp[u][idx];
                    }
                }
                data.push(point);
            }
        }
        return data;
    }, [currentRun, viewMode, courseDistance]);

    return (
        <div className="w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <h3 className="text-lg font-bold text-[#e3e3e3] flex items-center gap-2">
                    Race Simulation Analysis
                </h3>

                <div className="flex flex-wrap gap-2">
                    <select
                        value={selectedUma}
                        onChange={(e) => setSelectedUma(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                        className="text-xs font-bold bg-[#131314] text-[#e3e3e3] border border-[#444746] rounded-lg px-3 py-1 focus:ring-2 focus:ring-[#8ab4f8] outline-none cursor-pointer"
                    >
                        <option value="all" className="bg-[#1e1f20] text-[#e3e3e3]">ALL</option>
                        {umas.map((uma, idx) => (
                            <option key={idx} value={idx} className="bg-[#1e1f20] text-[#e3e3e3]">{uma.name || `Uma ${idx + 1}`}</option>
                        ))}
                    </select>

                    <div className="bg-[#131314] border border-[#444746] p-1 rounded-lg flex">
                        <button
                            onClick={() => setViewMode('speed')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'speed' ? 'bg-[#282a2c] text-[#8ab4f8] shadow-sm' : 'text-[#c4c7c5] hover:text-[#e3e3e3]'}`}
                        >
                            SPEED
                        </button>
                        <button
                            onClick={() => setViewMode('hp')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'hp' ? 'bg-[#282a2c] text-[#8ab4f8] shadow-sm' : 'text-[#c4c7c5] hover:text-[#e3e3e3]'}`}
                        >
                            HP
                        </button>
                        <button
                            onClick={() => setViewMode('both')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'both' ? 'bg-[#282a2c] text-[#8ab4f8] shadow-sm' : 'text-[#c4c7c5] hover:text-[#e3e3e3]'}`}
                        >
                            SPEED + HP
                        </button>
                        <button
                            onClick={() => setViewMode('distance')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'distance' ? 'bg-[#282a2c] text-[#8ab4f8] shadow-sm' : 'text-[#c4c7c5] hover:text-[#e3e3e3]'}`}
                        >
                            DISTANCE
                        </button>
                    </div>

                    <select
                        value={selectedRun}
                        onChange={(e) => setSelectedRun(e.target.value as any)}
                        className="text-xs font-bold bg-[#131314] text-[#e3e3e3] border border-[#444746] rounded-lg px-3 py-1 focus:ring-2 focus:ring-[#8ab4f8] outline-none cursor-pointer"
                    >
                        <option value="meanrun" className="bg-[#1e1f20] text-[#e3e3e3]">Mean Run</option>
                        <option value="medianrun" className="bg-[#1e1f20] text-[#e3e3e3]">Median Run</option>
                        <option value="minrun" className="bg-[#1e1f20] text-[#e3e3e3]">Min Run ({umas[0]?.name || 'Uma 1'} Worst)</option>
                        <option value="maxrun" className="bg-[#1e1f20] text-[#e3e3e3]">Max Run ({umas[0]?.name || 'Uma 1'} Best)</option>
                    </select>

                    <button
                        onClick={() => setShowSkills(!showSkills)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all border ${showSkills ? 'bg-[#282a2c] text-[#8ab4f8] border-[#8ab4f8] shadow-sm' : 'bg-[#131314] text-[#c4c7c5] border-[#444746] hover:text-[#e3e3e3]'}`}
                    >
                        {showSkills ? 'HIDE SKILLS' : 'SHOW SKILLS'}
                    </button>
                </div>
            </div>

            <div className="relative h-[500px] w-full bg-[#1e1f20] rounded-lg border border-[#444746] overflow-hidden">
                <div className="absolute inset-0 z-10">
                    <ResponsiveContainer key={`${selectedRun}-${viewMode}`} width="100%" height="100%">
                        <LineChart data={chartData} margin={chartMargins}>
                            {(viewMode !== 'distance') && <ReferenceArea yAxisId={viewMode === 'hp' ? 'hp' : 'speed'} x1={0} x2={courseDistance} shape={<RaceTrackBackground courseid={courseid} regions={skillRegions} />} />}
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#444746" />
                            <XAxis
                                type="number"
                                dataKey={viewMode === 'distance' ? "time" : "distance"}
                                domain={viewMode === 'distance' ? [0, 'auto'] : [0, courseDistance]}
                                height={30}
                                label={{
                                    value: viewMode === 'distance' ? 'Time (s)' : 'Distance (m)',
                                    position: 'insideBottom',
                                    offset: -10,
                                    fill: '#c4c7c5',
                                    fontSize: 12
                                }}
                                tick={{ fontSize: 12, fill: '#c4c7c5' }}
                            />
                            {(viewMode === 'speed' || viewMode === 'both') && (
                                <YAxis
                                    yAxisId="speed"
                                    width={60}
                                    label={{ value: 'Speed (m/s)', angle: -90, position: 'insideLeft', offset: 5, fill: '#c4c7c5', fontSize: 12 }}
                                    tick={{ fontSize: 12, fill: '#c4c7c5' }}
                                    domain={['auto', 'auto']}
                                />
                            )}
                            {(viewMode === 'hp' || viewMode === 'both') && (
                                <YAxis
                                    yAxisId="hp"
                                    orientation="right"
                                    width={60}
                                    label={{ value: 'HP', angle: 90, position: 'insideRight', offset: 5, fill: '#c4c7c5', fontSize: 12 }}
                                    tick={{ fontSize: 12, fill: '#c4c7c5' }}
                                    domain={[0, 'auto']}
                                />
                            )}
                            {(viewMode === 'distance') && (
                                <YAxis
                                    yAxisId="distance"
                                    width={60}
                                    label={{
                                        value: 'Distance to Finish (m)',
                                        angle: -90,
                                        position: 'insideLeft',
                                        offset: 5,
                                        fill: '#c4c7c5',
                                        fontSize: 12
                                    }}
                                    tick={{ fontSize: 12, fill: '#c4c7c5' }}
                                    domain={[0, courseDistance]}
                                />
                            )}
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: '#1e1f20', borderColor: '#444746', color: '#e3e3e3', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }}
                            />
                            <Legend verticalAlign="top" height={36} wrapperStyle={{ color: '#e3e3e3' }} />

                            {viewMode === 'speed' && currentRun?.p.map((_: any, idx: number) => {
                                if (selectedUma !== 'all' && selectedUma !== idx) return null;
                                return <Line key={idx} yAxisId="speed" type="monotone" dataKey={`uma${idx + 1}`} name={`${umas[idx]?.name || `Uma ${idx + 1}`} Speed`} stroke={UMA_COLORS[idx % UMA_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />;
                            })}

                            {viewMode === 'hp' && currentRun?.p.map((_: any, idx: number) => {
                                if (selectedUma !== 'all' && selectedUma !== idx) return null;
                                return <Line key={idx} yAxisId="hp" type="monotone" dataKey={`uma${idx + 1}`} name={`${umas[idx]?.name || `Uma ${idx + 1}`} HP`} stroke={UMA_COLORS[idx % UMA_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />;
                            })}

                            {viewMode === 'both' && currentRun?.p.map((_: any, idx: number) => {
                                if (selectedUma !== 'all' && selectedUma !== idx) return null;
                                return (
                                    <React.Fragment key={idx}>
                                        <Line yAxisId="speed" type="monotone" dataKey={`uma${idx + 1}Speed`} name={`${umas[idx]?.name || `Uma ${idx + 1}`} Speed`} stroke={UMA_COLORS[idx % UMA_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                                        <Line yAxisId="hp" type="monotone" dataKey={`uma${idx + 1}Hp`} name={`${umas[idx]?.name || `Uma ${idx + 1}`} HP`} stroke={UMA_COLORS[idx % UMA_COLORS.length]} strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 6 }} />
                                    </React.Fragment>
                                );
                            })}

                            {viewMode === 'distance' && currentRun?.p.map((_: any, idx: number) => {
                                if (selectedUma !== 'all' && selectedUma !== idx) return null;
                                return <Line key={idx} yAxisId="distance" type="monotone" dataKey={`uma${idx + 1}`} name={`${umas[idx]?.name || `Uma ${idx + 1}`} Distance`} stroke={UMA_COLORS[idx % UMA_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />;
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

function SimulatorApp() {
    const [activeUmaTab, setActiveUmaTab] = useState(1);
    const umaTabsRef = useGrabScroll();
    const resultsRef = useGrabScroll();

    const [courseid, setCourseid] = useState(defaultRace.courseId);
    const [weather, setWeather] = useState(defaultRace.weather);
    const [ground, setGround] = useState(defaultRace.ground_condition);
    const [season, setSeason] = useState(defaultRace.season);

    const [samples, setSamples] = useState(500);
    const [seed, setSeed] = useState(Math.floor(Math.random() * 0xFFFFFFFF).toString());
    const [usePosKeep, setUsePosKeep] = useState(true);
    const [useIntChecks, setUseIntChecks] = useState(false);
    const [forceFullSpurt, setForceFullSpurt] = useState(false);
    const [forceInnateSkillActivation, setForceInnateSkillActivation] = useState(false);

    const umasState = useGetter(O.umas);
    const setUmasState = useSetter(O.umas);

    const [editingTab, setEditingTab] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');

    const saveTabName = (idx: number) => {
        setUmasState((prev: any[]) => {
            const newUmas = [...prev];
            newUmas[idx] = { ...newUmas[idx], name: editingName };
            return newUmas;
        });
        setEditingTab(null);
    };

    const deleteUma = (idx: number) => {
        setUmasState((prev: any[]) => {
            const newUmas = [...prev];
            newUmas.splice(idx, 1);
            return newUmas;
        });
        if (activeUmaTab === idx + 1) {
            setActiveUmaTab(1);
        } else if (activeUmaTab > idx + 1) {
            setActiveUmaTab(activeUmaTab - 1);
        }
    };

    const courseDistance = useMemo(() => CourseHelpers.getCourse(courseid).distance, [courseid]);

    const [simulationResult, setSimulationResult] = useState<{ wins: number[], ties: number, runData: any, aggregateStats: any } | null>(null);

    const handleCompare = () => {
        const course = CourseHelpers.getCourse(courseid);
        const racedef = {
            groundCondition: ground,
            weather: weather,
            season: season,
            time: 1,
            orderRange: [1, 18],
            numUmas: 18
        };
        const options = {
            usePosKeep,
            useIntChecks,
            forceFullSpurt,
            forceInnateSkillActivation
        };
        try {
            const result = runComparison(samples, course, racedef, umasState, [parseInt(seed) || 0, 0], options);

            setSimulationResult({ wins: result.wins, ties: result.ties, runData: result.runData, aggregateStats: result.aggregateStats });
        } catch (e) {
            console.error(e);
        }
    }

    return (
        <div className="min-h-screen bg-[#131314] text-[#e3e3e3] font-sans p-2 md:p-4">
            <div className="max-w-[100%] xl:px-30 mx-auto space-y-6">

                {/* Header */}
                <header className="flex items-center justify-between pb-4 border-b border-[#444746]">
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#e3e3e3]">Uma Simulator</h1>
                    <div className="text-sm text-[#c4c7c5]">v2.0</div>
                </header>

                {/* Top Row: Track & Umas */}
                <div className="grid grid-cols-1 xl:grid-cols-24 gap-6">

                    {/* Left Column: Track */}
                    <div className="xl:col-span-13 space-y-6">
                        {/* Race Track Card */}
                        <div className="bg-[#1e1f20] rounded-xl shadow-md border border-[#444746] overflow-hidden">
                            <div className="bg-[#282a2c] border-b border-[#444746] px-4 py-3 font-semibold text-[#e3e3e3]">
                                Race Track
                            </div>
                            <div className="p-4 flex flex-col items-center space-y-6">
                                <div className="w-full overflow-x-auto flex justify-center">
                                    <RaceTrack courseid={courseid} width={650} height={210} regions={[]} />
                                </div>

                                <div className="w-full space-y-6">
                                    <div>
                                        <label className="block text-xs font-medium text-[#c4c7c5] mb-2">Course</label>
                                        <TrackSelect courseid={courseid} setCourseid={setCourseid} tabindex={200} />
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 mb-3">
                                        <div>
                                            <label className="block text-xs font-medium text-[#c4c7c5] mb-2">Weather</label>
                                            <select value={weather} onChange={e => setWeather(+e.target.value)} className="w-full border border-[#444746] rounded-md p-2 text-sm bg-[#131314] text-[#e3e3e3] focus:ring-2 focus:ring-[#8ab4f8] focus:border-[#8ab4f8] outline-none">
                                                <option value={1} className="bg-[#1e1f20] text-[#e3e3e3]">☀️ Sunny</option>
                                                <option value={2} className="bg-[#1e1f20] text-[#e3e3e3]">☁️ Cloudy</option>
                                                <option value={3} className="bg-[#1e1f20] text-[#e3e3e3]">🌧️ Rainy</option>
                                                <option value={4} className="bg-[#1e1f20] text-[#e3e3e3]">❄️ Snowy</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[#c4c7c5] mb-2">Ground</label>
                                            <select value={ground} onChange={e => setGround(+e.target.value)} className="w-full border border-[#444746] rounded-md p-2 text-sm bg-[#131314] text-[#e3e3e3] focus:ring-2 focus:ring-[#8ab4f8] focus:border-[#8ab4f8] outline-none">
                                                <option value={1} className="bg-[#1e1f20] text-[#e3e3e3]">Good</option>
                                                <option value={2} className="bg-[#1e1f20] text-[#e3e3e3]">Slightly Heavy</option>
                                                <option value={3} className="bg-[#1e1f20] text-[#e3e3e3]">Heavy</option>
                                                <option value={4} className="bg-[#1e1f20] text-[#e3e3e3]">Bad</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[#c4c7c5] mb-2">Season</label>
                                            <select value={season} onChange={e => setSeason(+e.target.value)} className="w-full border border-[#444746] rounded-md p-2 text-sm bg-[#131314] text-[#e3e3e3] focus:ring-2 focus:ring-[#8ab4f8] focus:border-[#8ab4f8] outline-none">
                                                <option value={1} className="bg-[#1e1f20] text-[#e3e3e3]">🌸 Spring</option>
                                                <option value={2} className="bg-[#1e1f20] text-[#e3e3e3]">☀️ Summer</option>
                                                <option value={3} className="bg-[#1e1f20] text-[#e3e3e3]">🍂 Autumn</option>
                                                <option value={4} className="bg-[#1e1f20] text-[#e3e3e3]">❄️ Winter</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Umamusume Definitions */}
                    <div className="xl:col-span-11">
                        <div className="bg-[#1e1f20] rounded-xl shadow-md border border-[#444746] overflow-hidden flex flex-col h-full">

                            {/* Tabs */}
                            <div
                                ref={umaTabsRef}
                                className="flex bg-[#131314] border-b border-[#444746] overflow-x-auto grab-scroll"
                            >
                                {umasState.map((uma: any, idx: number) => {
                                    const color = UMA_COLORS[idx % UMA_COLORS.length];
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex-1 flex items-center justify-between py-3 px-4 font-bold text-center transition-colors whitespace-nowrap ${activeUmaTab === idx + 1 ? 'bg-[#1e1f20] border-t-2' : 'text-[#c4c7c5] hover:bg-[#282a2c] border-t-2 border-t-transparent'}`}
                                            style={activeUmaTab === idx + 1 ? { color: color, borderTopColor: color } : {}}
                                        >
                                            {editingTab === idx ? (
                                                <input
                                                    type="text"
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    onBlur={() => saveTabName(idx)}
                                                    onKeyDown={(e) => e.key === 'Enter' && saveTabName(idx)}
                                                    autoFocus
                                                    className="w-24 px-1 py-0.5 text-sm bg-[#131314] border rounded focus:outline-none"
                                                    style={{ borderColor: color, color: color }}
                                                />
                                            ) : (
                                                <span
                                                    className="cursor-pointer flex-1"
                                                    onClick={() => setActiveUmaTab(idx + 1)}
                                                    onDoubleClick={() => {
                                                        setEditingTab(idx);
                                                        setEditingName(uma.name || `Uma ${idx + 1}`);
                                                    }}
                                                >
                                                    {uma.name || `Uma ${idx + 1}`}
                                                </span>
                                            )}
                                            {umasState.length > 1 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteUma(idx);
                                                    }}
                                                    className="ml-2 text-[#f28b82] hover:text-[#e06c64] focus:outline-none"
                                                    title="Delete Uma"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                                {umasState.length < 18 && (
                                    <button
                                        className="py-3 px-4 font-bold text-center text-[#8ab4f8] hover:bg-[#282a2c] transition-colors border-t-2 border-t-transparent whitespace-nowrap"
                                        onClick={() => {
                                            const umaIds = Object.keys(umas);
                                            const randomUmaId = umaIds[Math.floor(Math.random() * umaIds.length)];
                                            const randomUmaOutfit = Object.keys((umas as any)[randomUmaId].outfits)[0];

                                            const state = { ...DEFAULT_HORSE_STATE, outfitId: randomUmaOutfit, samplePolicies: new Map(), skills: SkillSet([]) };
                                            if (randomUmaOutfit && (umas as any)[randomUmaOutfit.slice(0, 4)]) {
                                                const u = (umas as any)[randomUmaOutfit.slice(0, 4)].outfits[randomUmaOutfit];
                                                const strats = ['Nige', 'Senkou', 'Sasi', 'Oikomi', 'Oonige'];
                                                const stratAptitudes = u.aptitudes.slice(4, 8);
                                                let bestVal = 99, bestIdx = 0;
                                                for (let i = 0; i < 4; i++) {
                                                    if (stratAptitudes[i] < bestVal) {
                                                        bestVal = stratAptitudes[i];
                                                        bestIdx = i;
                                                    }
                                                }
                                                const uid = uniqueSkillForUma(randomUmaOutfit, state.starCount as any);
                                                if (uid) state.skills.set((skillmeta as any)[uid].groupId, uid);

                                                state.strategy = strats[bestIdx] as any;
                                                state.aptitudes = u.aptitudes.map((i: number) => ' GFEDCBA'[i]) as any;
                                            }
                                            setUmasState((prev: any) => [...prev, state]);
                                            setActiveUmaTab(umasState.length + 1);
                                        }}
                                    >
                                        + Add
                                    </button>
                                )}
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto">
                                {umasState.map((_: any, idx: number) => (
                                    <div key={idx} style={{ display: activeUmaTab === idx + 1 ? 'block' : 'none' }} className="w-full h-full">
                                        <HorseDef
                                            state={O.umas[idx]}
                                            aptitudesMode="full"
                                            courseDistance={courseDistance}
                                            showPolicyEd={false}
                                            tabstart={() => idx * 100 + 1}
                                            accentColor={UMA_COLORS[idx % UMA_COLORS.length]}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Full Width Bottom Row: Simulation Controls & Results & Graph */}
                <div className="w-full space-y-6 mt-6">
                    <div className="bg-[#1e1f20] rounded-xl shadow-md border border-[#444746] overflow-hidden">
                        <div className="bg-[#282a2c] border-b border-[#444746] px-4 py-3 font-semibold text-[#e3e3e3]">
                            Simulation Dashboard
                        </div>

                        {/* Controls and Results Section */}
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 border-b border-[#282a2c]">
                            {/* Controls */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-[#c4c7c5] mb-1">Samples</label>
                                        <input
                                            type="number"
                                            value={samples}
                                            onChange={e => setSamples(+e.target.value)}
                                            className="w-full border border-[#444746] rounded-md p-2 text-sm bg-[#131314] text-[#e3e3e3] focus:ring-2 focus:ring-[#8ab4f8] focus:border-[#8ab4f8] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[#c4c7c5] mb-1">Seed</label>
                                        <div className="flex">
                                            <input
                                                type="text"
                                                value={seed}
                                                onChange={e => setSeed(e.target.value)}
                                                className="w-full border border-[#444746] rounded-l-md p-2 text-sm bg-[#131314] text-[#e3e3e3] focus:ring-2 focus:ring-[#8ab4f8] focus:border-[#8ab4f8] outline-none"
                                            />
                                            <button
                                                onClick={() => setSeed(Math.floor(Math.random() * 0xFFFFFFFF).toString())}
                                                className="bg-[#282a2c] border border-l-0 border-[#444746] rounded-r-md px-3 hover:bg-[#444746] transition-colors"
                                                title="Randomize Seed"
                                            >
                                                🎲
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 flex flex-col sm:flex-row sm:gap-6 sm:space-y-0">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={usePosKeep}
                                            onChange={e => setUsePosKeep(e.target.checked)}
                                            className="rounded text-[#8ab4f8] bg-[#131314] border-[#444746] focus:ring-[#8ab4f8] w-4 h-4"
                                        />
                                        <span className="text-sm text-[#e3e3e3]">Simulate position keep</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={useIntChecks}
                                            onChange={e => setUseIntChecks(e.target.checked)}
                                            className="rounded text-[#8ab4f8] bg-[#131314] border-[#444746] focus:ring-[#8ab4f8] w-4 h-4"
                                        />
                                        <span className="text-sm text-[#e3e3e3]">Wit checks for skills</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={forceFullSpurt}
                                            onChange={e => setForceFullSpurt(e.target.checked)}
                                            className="rounded text-[#8ab4f8] bg-[#131314] border-[#444746] focus:ring-[#8ab4f8] w-4 h-4"
                                        />
                                        <span className="text-sm text-[#e3e3e3]">Force full spurt</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={forceInnateSkillActivation}
                                            onChange={e => setForceInnateSkillActivation(e.target.checked)}
                                            className="rounded text-[#8ab4f8] bg-[#131314] border-[#444746] focus:ring-[#8ab4f8] w-4 h-4"
                                        />
                                        <span className="text-sm text-[#e3e3e3]">Force innate skill activation</span>
                                    </label>
                                </div>

                                <button
                                    onClick={handleCompare}
                                    className="w-full bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#131314] font-bold py-3 rounded-lg shadow-sm transition-colors mt-4 text-lg flex items-center justify-center gap-2"
                                >
                                    <span>🏁</span> SIMULATE RACE
                                </button>
                            </div>

                            {/* Results */}
                            <div className="lg:border-l lg:border-[#444746] lg:pl-8 flex flex-col justify-center">
                                {simulationResult ? (
                                    <div>
                                        <h3 className="text-sm font-bold text-[#e3e3e3] uppercase tracking-wider mb-4">Simulation Results</h3>
                                        <div
                                            ref={resultsRef}
                                            className="space-y-5 max-h-[300px] overflow-y-auto pr-2 grab-scroll"
                                        >
                                            {simulationResult.wins.map((wins, idx) => {
                                                const color = UMA_COLORS[idx % UMA_COLORS.length];
                                                const umaName = umasState[idx]?.name || `Uma ${idx + 1}`;
                                                return (
                                                    <div key={idx}>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <span className="text-sm font-semibold text-[#c4c7c5]">{umaName} Wins</span>
                                                            <span className="text-xl font-mono font-bold" style={{ color }}>{wins}</span>
                                                        </div>
                                                        <div className="w-full bg-[#282a2c] rounded-full h-3">
                                                            <div
                                                                className="h-3 rounded-full transition-all duration-500"
                                                                style={{ width: `${(wins / samples) * 100}%`, backgroundColor: color }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            <div className="flex items-center justify-between pt-2 border-t border-[#444746]">
                                                <span className="text-sm font-semibold text-[#c4c7c5]">Ties</span>
                                                <span className="text-sm font-mono font-bold text-[#c4c7c5]">{simulationResult.ties}</span>
                                            </div>
                                        </div>
                                        <div className="mt-6 text-left">
                                            <span className="text-xs font-medium text-[#c4c7c5] bg-[#282a2c] px-3 py-1.5 rounded-full">Based on {samples} samples</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center border-2 border-dashed border-[#444746] rounded-xl bg-[#131314] text-[#c4c7c5] min-h-[160px]">
                                        Run a simulation to see results
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Graph Section */}
                        {simulationResult && (
                            <div className="bg-[#131314]">
                                <div className="p-6">
                                    <RaceGraphVisualizer
                                        runData={simulationResult.runData}
                                        aggregateStats={simulationResult.aggregateStats}
                                        courseDistance={courseDistance}
                                        courseid={courseid}
                                        umas={umasState}
                                    />
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 border-t border-[#444746]">
                                    <CompareComponent stats={simulationResult.aggregateStats} samples={samples} umas={umasState} />
                                    <SkillTableComponent stats={simulationResult.aggregateStats} samples={samples} umas={umasState} />
                                    <StaminaCalculatorComponent stats={simulationResult.aggregateStats} umas={umasState} courseDistance={courseDistance} />
                                </div>
                            </div>
                        )}

                    </div>
                </div>

            </div>
        </div>
    );
}

export default function App(props: any) {
    const state = makeState(() => {
        const umaIds = Object.keys(umas);
        const randomUmaId = umaIds[Math.floor(Math.random() * umaIds.length)];
        const randomUmaOutfit = Object.keys((umas as any)[randomUmaId].outfits)[0];

        function createInitialUmaState(outfitId: string) {
            const state = { ...DEFAULT_HORSE_STATE, outfitId, samplePolicies: new Map(), skills: SkillSet([]) };
            if (outfitId && (umas as any)[outfitId.slice(0, 4)]) {
                const u = (umas as any)[outfitId.slice(0, 4)].outfits[outfitId];
                const strats = ['Nige', 'Senkou', 'Sasi', 'Oikomi'];
                const stratAptitudes = u.aptitudes.slice(4, 8);
                let bestVal = 99, bestIdx = 0;
                for (let i = 0; i < 4; i++) {
                    if (stratAptitudes[i] < bestVal) {
                        bestVal = stratAptitudes[i];
                        bestIdx = i;
                    }
                }
                const uid = uniqueSkillForUma(outfitId, state.starCount as any);
                if (uid) state.skills.set((skillmeta as any)[uid].groupId, uid);

                state.strategy = strats[bestIdx] as any;
                state.aptitudes = u.aptitudes.map((i: number) => ' GFEDCBA'[i]) as any;
            }
            return state;
        }

        return {
            umas: [
                createInitialUmaState('100602'),
                createInitialUmaState(randomUmaOutfit)
            ],
        };
    });

    return (
        <State.Provider value={state}>
            <SimulatorApp />
        </State.Provider>
    );
}