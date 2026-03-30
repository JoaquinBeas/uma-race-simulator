import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { O, State, makeState, useGetter, useSetter } from '../optics';
import { SkillSet, DEFAULT_HORSE_STATE, uniqueSkillForUma } from '../components/HorseDefTypes';
import { HorseDef } from '../components/HorseDef';
import { RaceTrack, TrackSelect } from '../components/RaceTrack';
import { CourseHelpers } from '../uma-skill-tools/CourseData';
import { runComparison } from '../umalator/compare';
import { CompareComponent, SkillTableComponent, StaminaCalculatorComponent } from './AnalysisComponents';
import { useGrabScroll } from '../lib/useGrabScroll';
import umas from '../uma-skill-tools/data/umas.json';
import skillmeta from '../uma-skill-tools/data/skill_meta.json';

import './app.css';
    
const UI_STRINGS = Object.freeze({
    'umaheader': 'Umamusume Details',
    'skillheader': 'Skills'
});

const RaceTrackBackground = (props: any) => {
    const { offset, courseid } = props;
    if (!offset) return null;
    
    return (
        <foreignObject 
            x={offset.left} 
            y={offset.top} 
            width={offset.width} 
            height={offset.height}
            style={{ pointerEvents: 'none', opacity: 0.7 }}
        >
            <RaceTrack courseid={courseid} width="100%" height="100%" hideHeader={true} regions={[]} />
        </foreignObject>
    );
};

const RaceGraphVisualizer: React.FC<{runData: any, courseDistance: number, courseid: number, umas: any[]}> = ({runData, courseDistance, courseid, umas}) => {
    const [viewMode, setViewMode] = useState<'speed' | 'hp' | 'both'>('speed');
    const [selectedRun, setSelectedRun] = useState<'meanrun' | 'medianrun' | 'minrun' | 'maxrun'>('meanrun');
    const [selectedUma, setSelectedUma] = useState<number | 'all'>('all');

    const currentRun = runData[selectedRun];
    
    const chartMargins = { top: 10, right: 30, left: 20, bottom: 30 };

    const chartData = useMemo(() => {
        if (!currentRun) return [];
        const data: any[] = [];
        const numUmas = currentRun.p.length;

        const numPoints = 200;
        for (let i = 0; i <= numPoints; i++) {
            const targetPos = (courseDistance / numPoints) * i;
            
            const point: any = {
                distance: Math.round(targetPos)
            };

            for (let u = 0; u < numUmas; u++) {
                const horsePos = currentRun.p[u];
                let idx = 0;
                let minDiff = Infinity;
                for (let j = 0; j < horsePos.length; j++) {
                    const diff = Math.abs(horsePos[j] - targetPos);
                    if (diff < minDiff) {
                        minDiff = diff;
                        idx = j;
                    }
                }

                if (viewMode === 'speed') {
                    point[`uma${u + 1}`] = currentRun.v[u][idx];
                } else if (viewMode === 'hp') {
                    point[`uma${u + 1}`] = currentRun.hp[u][idx];
                } else {
                    point[`uma${u + 1}Speed`] = currentRun.v[u][idx];
                    point[`uma${u + 1}Hp`] = currentRun.hp[u][idx];
                }
            }

            data.push(point);
        }
        return data;
    }, [currentRun, viewMode, courseDistance]);

    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#10b981', '#d946ef', '#f43f5e', '#0ea5e9', '#8b5cf6', '#f59e0b', '#78716c'];

    return (
        <div className="w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    Race Simulation Analysis
                </h3>
                
                <div className="flex flex-wrap gap-2">
                    <select 
                        value={selectedUma}
                        onChange={(e) => setSelectedUma(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                        className="text-xs font-bold bg-slate-100 border-none rounded-lg px-3 py-1 focus:ring-2 focus:ring-green-500 outline-none cursor-pointer"
                    >
                        <option value="all">ALL</option>
                        {umas.map((uma, idx) => (
                            <option key={idx} value={idx}>{uma.name || `Uma ${idx + 1}`}</option>
                        ))}
                    </select>

                    <div className="bg-slate-100 p-1 rounded-lg flex">
                        <button 
                            onClick={() => setViewMode('speed')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'speed' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            SPEED
                        </button>
                        <button 
                            onClick={() => setViewMode('hp')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'hp' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            HP
                        </button>
                        <button 
                            onClick={() => setViewMode('both')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'both' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            SPEED + HP
                        </button>
                    </div>

                    <select 
                        value={selectedRun}
                        onChange={(e) => setSelectedRun(e.target.value as any)}
                        className="text-xs font-bold bg-slate-100 border-none rounded-lg px-3 py-1 focus:ring-2 focus:ring-green-500 outline-none cursor-pointer"
                    >
                        <option value="meanrun">Mean Run</option>
                        <option value="medianrun">Median Run</option>
                        <option value="minrun">Min Run ({umas[0]?.name || 'Uma 1'} Worst)</option>
                        <option value="maxrun">Max Run ({umas[0]?.name || 'Uma 1'} Best)</option>
                    </select>
                </div>
            </div>

            <div className="relative h-[500px] w-full bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="absolute inset-0 z-10">
                    <ResponsiveContainer key={`${selectedRun}-${viewMode}`} width="100%" height="100%">
                        <LineChart data={chartData} margin={chartMargins}>
                            <RaceTrackBackground courseid={courseid} />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                                type="number"
                                dataKey="distance" 
                                domain={[0, courseDistance]}
                                height={30}
                                label={{ value: 'Distance (m)', position: 'insideBottom', offset: -10, fontSize: 12 }} 
                                tick={{fontSize: 12}}
                            />
                            {(viewMode === 'speed' || viewMode === 'both') && (
                                <YAxis 
                                    yAxisId="speed"
                                    width={60}
                                    label={{ value: 'Speed (m/s)', angle: -90, position: 'insideLeft', offset: 5, fontSize: 12 }}
                                    tick={{fontSize: 12}}
                                    domain={['auto', 'auto']}
                                />
                            )}
                            {(viewMode === 'hp' || viewMode === 'both') && (
                                <YAxis 
                                    yAxisId="hp"
                                    orientation="right"
                                    width={60}
                                    label={{ value: 'HP', angle: 90, position: 'insideRight', offset: 5, fontSize: 12 }}
                                    tick={{fontSize: 12}}
                                    domain={[0, 'auto']}
                                />
                            )}
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend verticalAlign="top" height={36}/>
                            
                            {viewMode === 'speed' && currentRun?.p.map((_: any, idx: number) => {
                                if (selectedUma !== 'all' && selectedUma !== idx) return null;
                                return <Line key={idx} yAxisId="speed" type="monotone" dataKey={`uma${idx + 1}`} name={`${umas[idx]?.name || `Uma ${idx + 1}`} Speed`} stroke={colors[idx % colors.length]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />;
                            })}
                            
                            {viewMode === 'hp' && currentRun?.p.map((_: any, idx: number) => {
                                if (selectedUma !== 'all' && selectedUma !== idx) return null;
                                return <Line key={idx} yAxisId="hp" type="monotone" dataKey={`uma${idx + 1}`} name={`${umas[idx]?.name || `Uma ${idx + 1}`} HP`} stroke={colors[idx % colors.length]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />;
                            })}

                            {viewMode === 'both' && currentRun?.p.map((_: any, idx: number) => {
                                if (selectedUma !== 'all' && selectedUma !== idx) return null;
                                return (
                                    <React.Fragment key={idx}>
                                        <Line yAxisId="speed" type="monotone" dataKey={`uma${idx + 1}Speed`} name={`${umas[idx]?.name || `Uma ${idx + 1}`} Speed`} stroke={colors[idx % colors.length]} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                                        <Line yAxisId="hp" type="monotone" dataKey={`uma${idx + 1}Hp`} name={`${umas[idx]?.name || `Uma ${idx + 1}`} HP`} stroke={colors[idx % colors.length]} strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 6 }} />
                                    </React.Fragment>
                                );
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
    
    const [courseid, setCourseid] = useState(10101);
    const [weather, setWeather] = useState(1);
    const [ground, setGround] = useState(1);
    const [season, setSeason] = useState(1);
    
    const [samples, setSamples] = useState(500);
    const [seed, setSeed] = useState(Math.floor(Math.random() * 0xFFFFFFFF).toString());
    const [usePosKeep, setUsePosKeep] = useState(true);
    const [useIntChecks, setUseIntChecks] = useState(false);
    const [forceFullSpurt, setForceFullSpurt] = useState(false);

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

    const [simulationResult, setSimulationResult] = useState<{wins: number[], ties: number, runData: any, aggregateStats: any} | null>(null);

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
            forceFullSpurt
        };
        try {
            const result = runComparison(samples, course, racedef, umasState, [parseInt(seed) || 0, 0], options);
            
            setSimulationResult({ wins: result.wins, ties: result.ties, runData: result.runData, aggregateStats: result.aggregateStats });
        } catch (e) {
            console.error(e);
        }
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-2 md:p-4">
            <div className="max-w-[95rem] mx-auto space-y-6">
                
                {/* Header */}
                <header className="flex items-center justify-between pb-4 border-b border-slate-300">
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Uma Simulator</h1>
                    <div className="text-sm text-slate-500">v2.0</div>
                </header>

                {/* Top Row: Track & Umas */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    
                    {/* Left Column: Track */}
                    <div className="xl:col-span-6 space-y-6">
                        {/* Race Track Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 font-semibold text-slate-700">
                                Race Track
                            </div>
                            <div className="p-4 flex flex-col items-center space-y-6">
                                <div className="w-full overflow-x-auto flex justify-center">
                                    <RaceTrack courseid={courseid} width={700} height={210} regions={[]} />
                                </div>
                                
                                <div className="w-full space-y-6">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-2">Course</label>
                                        <TrackSelect courseid={courseid} setCourseid={setCourseid} tabindex={200} />
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-4 mb-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-2">Weather</label>
                                            <select value={weather} onChange={e => setWeather(+e.target.value)} className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                                <option value={1}>☀️ Sunny</option>
                                                <option value={2}>☁️ Cloudy</option>
                                                <option value={3}>🌧️ Rainy</option>
                                                <option value={4}>❄️ Snowy</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-2">Ground</label>
                                            <select value={ground} onChange={e => setGround(+e.target.value)} className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                                <option value={1}>Good</option>
                                                <option value={2}>Slightly Heavy</option>
                                                <option value={3}>Heavy</option>
                                                <option value={4}>Bad</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-2">Season</label>
                                            <select value={season} onChange={e => setSeason(+e.target.value)} className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                                <option value={1}>🌸 Spring</option>
                                                <option value={2}>☀️ Summer</option>
                                                <option value={3}>🍂 Autumn</option>
                                                <option value={4}>❄️ Winter</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Umamusume Definitions */}
                    <div className="xl:col-span-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                            
                            {/* Tabs */}
                            <div 
                                ref={umaTabsRef}
                                className="flex bg-slate-100 border-b border-slate-200 overflow-x-auto grab-scroll"
                            >
                                {umasState.map((uma: any, idx: number) => (
                                    <div 
                                        key={idx}
                                        className={`flex-1 flex items-center justify-between py-3 px-4 font-bold text-center transition-colors whitespace-nowrap ${activeUmaTab === idx + 1 ? 'bg-white text-green-600 border-t-2 border-t-green-500' : 'text-slate-500 hover:bg-slate-200 border-t-2 border-t-transparent'}`}
                                    >
                                        {editingTab === idx ? (
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onBlur={() => saveTabName(idx)}
                                                onKeyDown={(e) => e.key === 'Enter' && saveTabName(idx)}
                                                autoFocus
                                                className="w-24 px-1 py-0.5 text-sm border border-green-500 rounded text-slate-700 focus:outline-none"
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
                                                className="ml-2 text-red-400 hover:text-red-600 focus:outline-none"
                                                title="Delete Uma"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {umasState.length < 18 && (
                                    <button 
                                        className="py-3 px-4 font-bold text-center text-green-600 hover:bg-green-50 transition-colors border-t-2 border-t-transparent whitespace-nowrap"
                                        onClick={() => {
                                            const umaIds = Object.keys(umas);
                                            const randomUmaId = umaIds[Math.floor(Math.random() * umaIds.length)];
                                            const randomUmaOutfit = Object.keys((umas as any)[randomUmaId].outfits)[0];
                                            
                                            const state = { ...DEFAULT_HORSE_STATE, outfitId: randomUmaOutfit, samplePolicies: new Map(), skills: SkillSet([]) };
                                            if (randomUmaOutfit && (umas as any)[randomUmaOutfit.slice(0, 4)]) {
                                                const u = (umas as any)[randomUmaOutfit.slice(0, 4)].outfits[randomUmaOutfit];
                                                const strats = ['Nige', 'Senkou', 'Sasi', 'Oikomi'];
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
                            <div className="p-4 flex-1 overflow-y-auto flex justify-center bg-slate-50">
                                {umasState.map((_: any, idx: number) => (
                                    <div key={idx} style={{ display: activeUmaTab === idx + 1 ? 'block' : 'none' }} className="w-full max-w-[700px]">
                                        <HorseDef state={O.umas[idx]} aptitudesMode="full" courseDistance={courseDistance} showPolicyEd={false} tabstart={() => idx * 100 + 1} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Full Width Bottom Row: Simulation Controls & Results & Graph */}
                <div className="w-full space-y-6 mt-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 font-semibold text-slate-700">
                            Simulation Dashboard
                        </div>
                        
                        {/* Controls and Results Section */}
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 border-b border-slate-100">
                            {/* Controls */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Samples</label>
                                        <input 
                                            type="number" 
                                            value={samples} 
                                            onChange={e => setSamples(+e.target.value)} 
                                            className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Seed</label>
                                        <div className="flex">
                                            <input 
                                                type="text" 
                                                value={seed} 
                                                onChange={e => setSeed(e.target.value)} 
                                                className="w-full border border-slate-300 rounded-l-md p-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                            />
                                            <button 
                                                onClick={() => setSeed(Math.floor(Math.random() * 0xFFFFFFFF).toString())}
                                                className="bg-slate-100 border border-l-0 border-slate-300 rounded-r-md px-3 hover:bg-slate-200 transition-colors"
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
                                            className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
                                        />
                                        <span className="text-sm text-slate-700">Simulate position keep</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={useIntChecks} 
                                            onChange={e => setUseIntChecks(e.target.checked)} 
                                            className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
                                        />
                                        <span className="text-sm text-slate-700">Wit checks for skills</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={forceFullSpurt} 
                                            onChange={e => setForceFullSpurt(e.target.checked)} 
                                            className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
                                        />
                                        <span className="text-sm text-slate-700">Force full spurt</span>
                                    </label>
                                </div>

                                <button 
                                    onClick={handleCompare}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-sm transition-colors mt-4 text-lg flex items-center justify-center gap-2"
                                >
                                    <span>🏁</span> SIMULATE RACE
                                </button>
                            </div>

                            {/* Results */}
                            <div className="lg:border-l lg:border-slate-100 lg:pl-8 flex flex-col justify-center">
                                {simulationResult ? (
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Simulation Results</h3>
                                        <div 
                                            ref={resultsRef}
                                            className="space-y-5 max-h-[300px] overflow-y-auto pr-2 grab-scroll"
                                        >
                                            {simulationResult.wins.map((wins, idx) => {
                                                const colors = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#10b981', '#d946ef', '#f43f5e', '#0ea5e9', '#8b5cf6', '#f59e0b', '#78716c'];
                                                const color = colors[idx % colors.length];
                                                const umaName = umasState[idx]?.name || `Uma ${idx + 1}`;
                                                return (
                                                    <div key={idx}>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <span className="text-sm font-semibold text-slate-600">{umaName} Wins</span>
                                                            <span className="text-xl font-mono font-bold" style={{ color }}>{wins}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-200 rounded-full h-3">
                                                            <div 
                                                                className="h-3 rounded-full transition-all duration-500"
                                                                style={{ width: `${(wins / samples) * 100}%`, backgroundColor: color }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                                <span className="text-sm font-semibold text-slate-600">Ties</span>
                                                <span className="text-sm font-mono font-bold text-slate-500">{simulationResult.ties}</span>
                                            </div>
                                        </div>
                                        <div className="mt-6 text-left">
                                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">Based on {samples} samples</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 min-h-[160px]">
                                        Run a simulation to see results
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Graph Section */}
                        {simulationResult && (
                            <div className="bg-slate-50">
                                <div className="p-6">
                                    <RaceGraphVisualizer 
                                        runData={simulationResult.runData} 
                                        courseDistance={courseDistance} 
                                        courseid={courseid}
                                        umas={umasState}
                                    />
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 border-t border-slate-200">
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
