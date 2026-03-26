import React, { Fragment, useState, useMemo, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { O, State, makeState, useLens, useGetter } from '../optics';
import { SkillSet, DEFAULT_HORSE_STATE } from '../components/HorseDefTypes';
import { HorseDef } from '../components/HorseDef';
import { RaceTrack, TrackSelect } from '../components/RaceTrack';
import { CourseHelpers } from '../uma-skill-tools/CourseData';
import { runComparison } from '../umalator/compare';
import umas from '../uma-skill-tools/data/umas.json';

import './app.css';

const UI_STRINGS = Object.freeze({
    'umaheader': 'Umamusume Details',
    'skillheader': 'Skills'
});

const dfsk = [200012,200952,200362,200382,201312,201601,202712,202742,202802,202982,203122,203172,203312,203422,204162,210141];

const RaceGraphVisualizer: React.FC<{runData: any, courseDistance: number, courseid: number}> = ({runData, courseDistance, courseid}) => {
    const [viewMode, setViewMode] = useState<'speed' | 'hp'>('speed');
    const [selectedRun, setSelectedRun] = useState<'meanrun' | 'medianrun' | 'minrun' | 'maxrun'>('meanrun');

    const currentRun = runData[selectedRun];
    
    const chartData = useMemo(() => {
        if (!currentRun) return [];
        const data: any[] = [];
        const horse1Pos = currentRun.p[0];
        const horse1Val = viewMode === 'speed' ? currentRun.v[0] : currentRun.hp[0];
        const horse2Pos = currentRun.p[1];
        const horse2Val = viewMode === 'speed' ? currentRun.v[1] : currentRun.hp[1];

        // Use a fixed number of points for the chart
        const numPoints = 200;
        for (let i = 0; i <= numPoints; i++) {
            const targetPos = (courseDistance / numPoints) * i;
            
            // Find closest point for horse 1
            let idx1 = 0;
            let minDiff1 = Infinity;
            for (let j = 0; j < horse1Pos.length; j++) {
                const diff = Math.abs(horse1Pos[j] - targetPos);
                if (diff < minDiff1) {
                    minDiff1 = diff;
                    idx1 = j;
                }
            }

            // Find closest point for horse 2
            let idx2 = 0;
            let minDiff2 = Infinity;
            for (let j = 0; j < horse2Pos.length; j++) {
                const diff = Math.abs(horse2Pos[j] - targetPos);
                if (diff < minDiff2) {
                    minDiff2 = diff;
                    idx2 = j;
                }
            }

            data.push({
                distance: Math.round(targetPos),
                uma1: horse1Val[idx1],
                uma2: horse2Val[idx2]
            });
        }
        return data;
    }, [currentRun, viewMode, courseDistance]);

    return (
        <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span>📊</span> Race Simulation Analysis
                </h3>
                
                <div className="flex flex-wrap gap-2">
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
                    </div>

                    <select 
                        value={selectedRun}
                        onChange={(e) => setSelectedRun(e.target.value as any)}
                        className="text-xs font-bold bg-slate-100 border-none rounded-lg px-3 py-1 focus:ring-2 focus:ring-green-500 outline-none"
                    >
                        <option value="meanrun">Mean Run</option>
                        <option value="medianrun">Median Run</option>
                        <option value="minrun">Min Run (Uma 1 Worst)</option>
                        <option value="maxrun">Max Run (Uma 1 Best)</option>
                    </select>
                </div>
            </div>

            <div className="relative h-[400px] w-full bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-end" style={{ padding: '10px 30px 60px 60px' }}>
                    <div className="w-full h-[120px] opacity-40">
                        <RaceTrack courseid={courseid} width="100%" height="100%" hideHeader={true} regions={[]} />
                    </div>
                </div>

                <div className="absolute inset-0 z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                                type="number"
                                dataKey="distance" 
                                domain={[0, courseDistance]}
                                height={30}
                                label={{ value: 'Distance (m)', position: 'insideBottomRight', offset: -20, fontSize: 12 }} 
                                tick={{fontSize: 12}}
                            />
                            <YAxis 
                                width={50}
                                label={{ value: viewMode === 'speed' ? 'Speed (m/s)' : 'HP', angle: -90, position: 'insideLeft', fontSize: 12, offset: -5 }}
                                tick={{fontSize: 12}}
                                domain={viewMode === 'speed' ? ['auto', 'auto'] : [0, 'auto']}
                            />
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend verticalAlign="top" height={36}/>
                            <Line 
                                type="monotone" 
                                dataKey="uma1" 
                                name="Umamusume 1" 
                                stroke="#3b82f6" 
                                strokeWidth={2} 
                                dot={false} 
                                activeDot={{ r: 6 }} 
                            />
                            <Line 
                                type="monotone" 
                                dataKey="uma2" 
                                name="Umamusume 2" 
                                stroke="#ef4444" 
                                strokeWidth={2} 
                                dot={false} 
                                activeDot={{ r: 6 }} 
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

function SimulatorApp() {
    const [activeUmaTab, setActiveUmaTab] = useState(1);
    
    const [courseid, setCourseid] = useState(10101);
    const [weather, setWeather] = useState(1);
    const [ground, setGround] = useState(1);
    const [season, setSeason] = useState(1);
    
    const [samples, setSamples] = useState(500);
    const [seed, setSeed] = useState(Math.floor(Math.random() * 0xFFFFFFFF).toString());
    const [usePosKeep, setUsePosKeep] = useState(true);
    const [useIntChecks, setUseIntChecks] = useState(false);
    const [showHpConsumption, setShowHpConsumption] = useState(false);

    const uma1 = useGetter(O.uma1);
    const uma2 = useGetter(O.uma2);

    const courseDistance = useMemo(() => CourseHelpers.getCourse(courseid).distance, [courseid]);

    const [simulationResult, setSimulationResult] = useState<{wins1: number, wins2: number, ties: number, runData: any} | null>(null);

    const handleCompare = () => {
        const course = CourseHelpers.getCourse(courseid);
        const racedef = {
            groundCondition: ground,
            weather: weather,
            season: season,
            time: 1,
            orderRange: [1, 1],
            numUmas: 9
        };
        const options = {
            usePosKeep,
            useIntChecks
        };
        try {
            const result = runComparison(samples, course, racedef, uma1, uma2, [parseInt(seed) || 0, 0], options);
            
            const wins1 = result.results.filter(d => d < 0).length;
            const wins2 = result.results.filter(d => d > 0).length;
            const ties = result.results.filter(d => d === 0).length;
            
            setSimulationResult({ wins1, wins2, ties, runData: result.runData });
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <header className="flex items-center justify-between pb-4 border-b border-slate-300">
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Uma Simulator</h1>
                    <div className="text-sm text-slate-500">v2.0</div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Left Column: Track */}
                    <div className="lg:col-span-5 space-y-6">
                        
                        {/* Race Track Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 font-semibold text-slate-700">
                                Race Track
                            </div>
                            <div className="p-4 flex flex-col items-center space-y-4">
                                <div className="w-full overflow-x-auto flex justify-center">
                                    <RaceTrack courseid={courseid} width={400} height={120} regions={[]} />
                                </div>
                                
                                <div className="w-full space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Course</label>
                                        <TrackSelect courseid={courseid} setCourseid={setCourseid} tabindex={200} />
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Weather</label>
                                            <select value={weather} onChange={e => setWeather(+e.target.value)} className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                                <option value={1}>☀️ Sunny</option>
                                                <option value={2}>☁️ Cloudy</option>
                                                <option value={3}>🌧️ Rainy</option>
                                                <option value={4}>❄️ Snowy</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Ground</label>
                                            <select value={ground} onChange={e => setGround(+e.target.value)} className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                                <option value={1}>Good</option>
                                                <option value={2}>Slightly Heavy</option>
                                                <option value={3}>Heavy</option>
                                                <option value={4}>Bad</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Season</label>
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
                    <div className="lg:col-span-7">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                            
                            {/* Tabs */}
                            <div className="flex bg-slate-100 border-b border-slate-200">
                                <button 
                                    className={`flex-1 py-3 px-4 font-bold text-center transition-colors ${activeUmaTab === 1 ? 'bg-white text-green-600 border-t-2 border-t-green-500' : 'text-slate-500 hover:bg-slate-200 border-t-2 border-t-transparent'}`}
                                    onClick={() => setActiveUmaTab(1)}
                                >
                                    Umamusume 1
                                </button>
                                <button 
                                    className={`flex-1 py-3 px-4 font-bold text-center transition-colors ${activeUmaTab === 2 ? 'bg-white text-green-600 border-t-2 border-t-green-500' : 'text-slate-500 hover:bg-slate-200 border-t-2 border-t-transparent'}`}
                                    onClick={() => setActiveUmaTab(2)}
                                >
                                    Umamusume 2
                                </button>
                            </div>
                            
                            {/* Tab Content */}
                            <div className="p-4 flex-1 overflow-y-auto flex justify-center bg-slate-50">
                                <div style={{ display: activeUmaTab === 1 ? 'block' : 'none' }} className="w-full max-w-[700px]">
                                    <HorseDef key="uma1" state={O.uma1} aptitudesMode="full" courseDistance={courseDistance} showPolicyEd={false} tabstart={() => 1} />
                                </div>
                                <div style={{ display: activeUmaTab === 2 ? 'block' : 'none' }} className="w-full max-w-[700px]">
                                    <HorseDef key="uma2" state={O.uma2} aptitudesMode="full" courseDistance={courseDistance} showPolicyEd={false} tabstart={() => 100} />
                                </div>
                            </div>

                        </div>
                    </div>

                </div>

                {/* Full Width Bottom Row: Simulation Controls & Results */}
                <div className="w-full space-y-6 mt-2">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 font-semibold text-slate-700">
                            Simulation Controls
                        </div>
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="col-span-1 space-y-4">
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

                                <div className="space-y-2 pt-2">
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
                                            checked={showHpConsumption} 
                                            onChange={e => setShowHpConsumption(e.target.checked)} 
                                            className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
                                        />
                                        <span className="text-sm text-slate-700">Show HP consumption</span>
                                    </label>
                                </div>

                                <button 
                                    onClick={handleCompare}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-sm transition-colors mt-4 text-lg flex items-center justify-center gap-2"
                                >
                                    <span>🏁</span> SIMULATE RACE
                                </button>
                            </div>

                            <div className="col-span-1 lg:col-span-2">
                                {simulationResult ? (
                                    <div className="h-full flex flex-col justify-center px-4 md:px-8">
                                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Simulation Results</h3>
                                        <div className="space-y-5">
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-sm font-semibold text-slate-600">Uma 1 Wins</span>
                                                    <span className="text-xl font-mono font-bold text-blue-600">{simulationResult.wins1}</span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-3">
                                                    <div 
                                                        className="bg-blue-500 h-3 rounded-full transition-all duration-500" 
                                                        style={{ width: `${(simulationResult.wins1 / samples) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-sm font-semibold text-slate-600">Uma 2 Wins</span>
                                                    <span className="text-xl font-mono font-bold text-red-600">{simulationResult.wins2}</span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-3">
                                                    <div 
                                                        className="bg-red-500 h-3 rounded-full transition-all duration-500" 
                                                        style={{ width: `${(simulationResult.wins2 / samples) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                                <span className="text-sm font-semibold text-slate-600">Ties</span>
                                                <span className="text-sm font-mono font-bold text-slate-500">{simulationResult.ties}</span>
                                            </div>
                                        </div>
                                        <div className="mt-6 text-center">
                                            <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">Based on {samples} samples</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 min-h-[160px]">
                                        Run a simulation to see results
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {simulationResult && (
                        <RaceGraphVisualizer 
                            runData={simulationResult.runData} 
                            courseDistance={courseDistance} 
                            courseid={courseid}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

function App(props: any) {
    const state = makeState(() => {
        const umaIds = Object.keys(umas);
        const randomUmaId = umaIds[Math.floor(Math.random() * umaIds.length)];
        const randomUmaOutfit = Object.keys((umas as any)[randomUmaId].outfits)[0];

        return {
            uma1: {...DEFAULT_HORSE_STATE, outfitId: '100602', samplePolicies: new Map(), skills: SkillSet([])},
            uma2: {...DEFAULT_HORSE_STATE, outfitId: randomUmaOutfit, samplePolicies: new Map(), skills: SkillSet([])},
        };
    });

    return (
        <State.Provider value={state}>
            <SimulatorApp />
        </State.Provider>
    );
}

export default App;
