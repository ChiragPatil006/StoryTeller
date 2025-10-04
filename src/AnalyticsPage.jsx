import React, { useState, useCallback, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';
import { Save, ArrowUp, ArrowDown, Move, Map, BarChart3, TrendingUp, Zap, Layers, BarChart4, Sliders } from 'lucide-react';

// === UTILITY FUNCTIONS FOR NEW FEATURE ===

/**
 * Calculates a simple Moving Average for data smoothing.
 * @param {Array<Object>} data - The raw scene data including appeal scores.
 * @param {number} factor - The smoothing factor (window size is derived from this).
 * @returns {Array<number>} An array of smoothed appeal values.
 */
const calculateSmoothedData = (data, factor) => {
    if (factor === 0) return data.map(d => d["Emotional Appeal Index"]);

    const appeals = data.map(d => d["Emotional Appeal Index"]);
    // Ensure window size is an odd number >= 1
    const windowSize = Math.max(1, Math.floor(factor / 2) * 2 + 1); 

    return appeals.map((value, index) => {
        let sum = 0;
        let count = 0;
        
        // Define the moving window boundaries
        const halfWindow = Math.floor(windowSize / 2);
        const start = Math.max(0, index - halfWindow);
        const end = Math.min(appeals.length - 1, index + halfWindow);

        for (let i = start; i <= end; i++) {
            sum += appeals[i];
            count++;
        }
        return sum / count;
    });
};

/**
 * Calculates a Pacing Score based on the Mean Absolute Change (MAC) between smoothed scene appeal values.
 * Lower MAC means smoother flow, resulting in a higher score (better pacing).
 * @param {Array<number>} appeals - The smoothed appeal values.
 * @returns {string} The normalized Pacing Score (0-100).
 */
const calculatePacingScore = (appeals) => {
    if (appeals.length <= 1) return "100.0";

    // 1. Calculate the absolute change in appeal between successive scenes
    const changes = [];
    for (let i = 1; i < appeals.length; i++) {
        changes.push(Math.abs(appeals[i] - appeals[i - 1]));
    }
    
    // 2. Calculate Mean Absolute Change (MAC)
    const sumOfChanges = changes.reduce((sum, change) => sum + change, 0);
    const meanAbsoluteChange = sumOfChanges / changes.length;

    // 3. Normalize the score (heuristic: higher MAC suggests poor pacing, so we subtract it from 100)
    // The factor 8 is used to scale the small MAC values (max 12) into a visually useful 0-100 range.
    const score = Math.max(0, 100 - (meanAbsoluteChange * 8)); 
    
    return score.toFixed(1);
};


// === DATA STRUCTURE: Zindagi Na Milegi Dobara (ZNMD) ===
const initialScenes = [
    { id: '1', name: "Mumbai Work Life (Setup)", summary: "Arjun is obsessed with money and work, setting the stage for the necessary escape and self-reflection.", appeal: 4, category: 'Routine/Apathy', img: 'https://placehold.co/100x60/805ad5/ffffff?text=Work' },
    { id: '2', name: "Road Trip Start (Anticipation)", summary: "The friends meet in Spain and the journey officially begins, hinting at underlying tensions between them.", appeal: 6, category: 'Excitement/Tension', img: 'https://placehold.co/100x60/63b3ed/ffffff?text=Car' },
    { id: '3', name: "Underwater Diving (Peace)", summary: "Kabir finds peace and commits to Natasha, resolving relationship doubt and learning to breathe.", appeal: 7, category: 'Calm/Commitment', img: 'https://placehold.co/100x60/4c51bf/ffffff?text=Dive' },
    { id: '4', name: "Skydiving (Fear & Release)", summary: "Arjun faces his fear of death and finance, learning to let go of control and live in the moment.", appeal: 10, category: 'Triumph/Joy', img: 'https://placehold.co/100x60/38a169/ffffff?text=Sky' },
    { id: '5', name: "Tomato Festival (Reunion)", summary: "The boys confront their past conflict and bond again, letting go of long-held grudges and finding pure joy.", appeal: 8, category: 'Reconciliation/Fun', img: 'https://placehold.co/100x60/dd6b20/ffffff?text=Tomatina' },
    { id: '6', name: "Running of the Bulls (Catharsis)", summary: "Imraan completes the final challenge, trusting his friends and moving towards acceptance of his father.", appeal: 12, category: 'Adrenaline/Catharsis', img: 'https://placehold.co/100x60/e53e3e/ffffff?text=Bulls' },
    { id: '7', name: "The Wedding (Happy Ending)", summary: "All three friends find closure and resolution, culminating in Kabir and Natasha's wedding, symbolizing their new beginning.", appeal: 12, category: 'Resolution/Joy', img: 'https://placehold.co/100x60/f6ad55/ffffff?text=Wedding' },
];

// Define common narrative structures for the selector feature
const NARRATIVE_ARCS = [
    { name: "None", structure: [] },
    { 
        name: "Three-Act Structure", 
        structure: [
            { start: 1, end: 2, label: "Act 1: Setup/Inciting Incident", color: "#6366f1" }, 
            { start: 3, end: 6, label: "Act 2: Confrontation/Rising Action", color: "#f97316" },
            { start: 7, end: 7, label: "Act 3: Resolution/Climax", color: "#10b981" },
        ]
    },
    { 
        name: "Freytag's Pyramid (Classic)", 
        structure: [
            { start: 1, end: 2, label: "Exposition", color: "#34d399" },
            { start: 3, end: 4, label: "Rising Action", color: "#facc15" },
            { start: 5, end: 5, label: "Climax", color: "#ef4444" },
            { start: 6, end: 6, label: "Falling Action", color: "#60a5fa" },
            { start: 7, end: 7, label: "Dénouement", color: "#a78bfa" },
        ]
    },
    { 
        name: "Hero's Journey (Monomuth)", 
        structure: [
            { start: 1, end: 1, label: "The Ordinary World", color: "#4B5563" },
            { start: 2, end: 3, label: "The Call & Refusal", color: "#3B82F6" },
            { start: 4, end: 5, label: "The Ordeal", color: "#FBBF24" },
            { start: 6, end: 6, label: "The Reward & Road Back", color: "#10B981" },
            { start: 7, end: 7, label: "The Resurrection/Return", color: "#D946EF" },
        ]
    },
];

// --- Helper Components for Cleanliness (MOVED HERE TO FIX ReferenceError) ---
const MetricCard = ({ title, value, color }) => (
    <div className="bg-gray-800 p-4 rounded-xl shadow-lg border-t-4 border-teal-500/50">
        <p className="text-sm text-gray-400 font-medium">{title}</p>
        <p className={`text-3xl font-extrabold mt-1 ${color}`}>{value}</p>
    </div>
);


// === Main Application Component ===
const App = () => {
    const [scenes, setScenes] = useState(initialScenes);
    const [draggedId, setDraggedId] = useState(null); 
    const [dropIndex, setDropIndex] = useState(null); 
    const [selectedArc, setSelectedArc] = useState(NARRATIVE_ARCS[1]); 
    const [chartType, setChartType] = useState('line');
    
    // NEW STATE for smoothing feature
    const [smoothingFactor, setSmoothingFactor] = useState(0); 

    // Calculate raw metrics (used for range/bounds)
    const rawAppeals = useMemo(() => scenes.map(s => s.appeal), [scenes]);
    const minAppeal = Math.min(...rawAppeals);
    const maxAppeal = Math.max(...rawAppeals);
    const totalAppeal = rawAppeals.reduce((sum, current) => sum + current, 0);

    // --- Graph Data (Now includes smoothed data) ---
    const chartData = useMemo(() => {
        const rawData = scenes.map((scene, index) => ({
            name: `${index + 1}. ${scene.name.split('(')[0].trim()}`,
            "Emotional Appeal Index": scene.appeal,
            "Category": scene.category,
            "ID": scene.id
        }));

        const smoothedValues = calculateSmoothedData(rawData, smoothingFactor);

        return rawData.map((d, index) => ({
            ...d,
            "Smoothed Emotional Appeal": smoothedValues[index]
        }));
    }, [scenes, smoothingFactor]);

    // --- Analysis Metrics (Now includes Pacing Score) ---
    const analysisMetrics = useMemo(() => {
        const range = maxAppeal - minAppeal;
        
        // Calculate Pacing Score using the smoothed data from chartData
        const smoothedAppeals = chartData.map(d => d["Smoothed Emotional Appeal"]);
        const pacingScore = calculatePacingScore(smoothedAppeals);
        
        return {
            minAppeal,
            maxAppeal,
            range,
            averageAppeal: (totalAppeal / rawAppeals.length).toFixed(1),
            pacingScore: pacingScore, // NEW METRIC
        };
    }, [chartData, rawAppeals, minAppeal, maxAppeal, totalAppeal]);

    // --- Drag and Drop Handlers (Unchanged logic) ---
    const handleDoubleClickSetup = useCallback((e, id) => {
        e.preventDefault(); 
        e.stopPropagation();
        setDraggedId(id);
        const cardElement = document.getElementById(`scene-card-${id}`);
        if (cardElement) {
            cardElement.style.opacity = '0.3';
            cardElement.style.transform = 'scale(0.95)';
        }
    }, []);

    const handleDragStart = useCallback((e, id) => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
    }, []);
    
    const handleDragOver = useCallback((e, targetIndex) => {
        e.preventDefault(); 
        const targetElement = e.currentTarget;
        const rect = targetElement.getBoundingClientRect();
        const dropPosition = e.clientY - rect.top;
        
        let newDropIndex = targetIndex;
        if (dropPosition > rect.height / 2) {
            newDropIndex = targetIndex + 1;
        }

        if (newDropIndex !== dropIndex) {
            setDropIndex(newDropIndex);
        }
    }, [dropIndex]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        
        if (!draggedId || dropIndex === null) return;

        const draggedIndex = scenes.findIndex(s => s.id === draggedId);
        if (draggedIndex === -1) return;

        const newScenes = Array.from(scenes);
        const [reorderedItem] = newScenes.splice(draggedIndex, 1);
        
        let insertIndex = dropIndex;
        
        if (draggedIndex < dropIndex) {
             insertIndex--;
        }

        if (insertIndex === draggedIndex) {
            return;
        }

        newScenes.splice(insertIndex, 0, reorderedItem);
        setScenes(newScenes);
    }, [draggedId, scenes, dropIndex]);

    const handleDragEnd = useCallback(() => {
        if (draggedId) {
            const cardElement = document.getElementById(`scene-card-${draggedId}`);
            if (cardElement) {
                cardElement.style.opacity = '1';
                cardElement.style.transform = 'scale(1)';
            }
        }
        setDraggedId(null);
        setDropIndex(null);
    }, [draggedId]);
    
    const reorderScene = useCallback((index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= scenes.length) return;

        const newScenes = Array.from(scenes);
        [newScenes[index], newScenes[newIndex]] = [newScenes[newIndex], newScenes[index]];

        setScenes(newScenes);
    }, [scenes]);

    const handleExportPdf = () => {
        const originalTitle = document.title;
        document.title = "Storyteller Ink - Zindagi Na Milegi Dobara Analytics Report";
        
        window.print();

        setTimeout(() => {
            document.title = originalTitle;
        }, 1000);
    };

    // --- Scene Card Component (Unchanged) ---
    const SceneCard = ({ scene, index }) => {
        const isDragging = draggedId === scene.id;
        const showIndicatorTop = dropIndex === index;
        
        return (
            <div
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={() => setDropIndex(null)}
                className="relative"
            >
                {/* Visual Drop Indicator (Top) */}
                {showIndicatorTop && (
                    <div className="absolute -top-1 left-0 w-full h-1 bg-teal-300 rounded-full z-20 animate-pulse-slow shadow-lg shadow-teal-400/50"></div>
                )}

                <div
                    id={`scene-card-${scene.id}`}
                    className={`
                        flex items-center p-4 mb-3 rounded-xl shadow-2xl transition-all duration-300 ease-in-out cursor-move 
                        ${isDragging 
                            ? 'opacity-30 border-2 border-teal-300 bg-gray-900 scale-95' 
                            : 'bg-gray-800 border-l-4 border-teal-500 hover:bg-gray-700 hover:shadow-teal-900/50 hover:scale-[1.01]'
                        }
                        relative group transform
                    `}
                    draggable
                    onDragStart={(e) => handleDragStart(e, scene.id)}
                    onDragEnd={handleDragEnd}
                    onDoubleClick={(e) => handleDoubleClickSetup(e, scene.id)} 
                >
                    {/* Visual Drag Handle & Order */}
                    <div className="flex-shrink-0 flex flex-col items-center mr-4 cursor-move">
                        <Move className={`w-5 h-5 transition-opacity duration-300 print:hidden ${isDragging ? 'text-white' : 'text-gray-400 group-hover:text-teal-400'}`} />
                        <span className={`text-2xl font-extrabold transition-colors duration-300 ${isDragging ? 'text-white' : 'text-teal-400'}`}>{index + 1}</span>
                    </div>

                    {/* Engaging Image Placeholder */}
                    <img 
                        src={scene.img} 
                        alt={scene.name} 
                        className="w-20 h-12 object-cover rounded-lg shadow-md mr-4 hidden sm:block"
                        onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/100x60/553c9a/ffffff?text=ZNMD" }}
                    />

                    {/* Content */}
                    <div className="flex-grow min-w-0">
                        <h3 className={`text-xl font-extrabold transition-colors duration-300 ${isDragging ? 'text-white' : 'text-teal-200'}`}>
                            {scene.name}
                        </h3>
                        <p className={`text-sm mt-1 ${isDragging ? 'text-teal-100' : 'text-gray-400'}`}>{scene.summary}</p>
                        <div className="mt-2 flex items-center space-x-3">
                            <span className="text-sm font-bold text-red-300 bg-red-900/50 px-3 py-1 rounded-full shadow-inner">
                                EAI: {scene.appeal}
                            </span>
                            <span className="text-sm font-bold text-yellow-300 bg-yellow-900/50 px-3 py-1 rounded-full shadow-inner">
                                {scene.category}
                            </span>
                        </div>
                    </div>
                    
                    {/* Mobile/Accessibility Reorder Buttons */}
                    <div className="flex flex-col space-y-2 ml-auto print:hidden">
                        <button
                            onClick={(e) => { e.stopPropagation(); reorderScene(index, -1); }}
                            disabled={index === 0}
                            title="Move Scene Up"
                            className="p-2 rounded-full bg-gray-600 hover:bg-teal-500 disabled:opacity-30 disabled:hover:bg-gray-600 transition transform hover:scale-110 shadow-lg"
                        >
                            <ArrowUp className="w-4 h-4 text-white" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); reorderScene(index, 1); }}
                            disabled={index === scenes.length - 1}
                            title="Move Scene Down"
                            className="p-2 rounded-full bg-gray-600 hover:bg-teal-500 disabled:opacity-30 disabled:hover:bg-gray-600 transition transform hover:scale-110 shadow-lg"
                        >
                            <ArrowDown className="w-4 h-4 text-white" />
                        </button>
                    </div>
                </div>

                {/* Drop Indicator for the very end of the list */}
                {index === scenes.length - 1 && dropIndex === scenes.length && (
                    <div className="absolute -bottom-1 left-0 w-full h-1 bg-teal-300 rounded-full z-20 animate-pulse-slow shadow-lg shadow-teal-400/50"></div>
                )}
            </div>
        );
    };

    return (
        <>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            
            {/* Custom Styles for Print/PDF and Drag/Drop Indicators */}
            <style jsx="true">{`
                /* Add a slow pulse animation for the drop indicator */
                @keyframes pulse-slow {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                
                @media print {
                    /* Print styles */
                    body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        font-size: 10pt !important;
                    }
                    .print\\:hidden { display: none !important; }
                    #analytics-content {
                        margin-top: 0;
                        padding: 20px;
                        background: #ffffff !important;
                    }
                    #emotional-graph {
                        width: 95% !important; 
                        height: 350px !important;
                        background: #f0f0f0; 
                        padding: 10px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        border: 1px solid #ccc;
                        margin-left: auto;
                        margin-right: auto;
                    }
                    .recharts-xAxis .recharts-cartesian-axis-tick tspan {
                        font-size: 8px !important; 
                    }
                    #scene-flow > div {
                        background: #ffffff !important;
                        color: #000000 !important;
                        border: 1px solid #ccc;
                        padding: 10px;
                        margin-bottom: 8px;
                        border-left: 5px solid #0d9488;
                        border-radius: 4px;
                        page-break-inside: avoid;
                        box-shadow: none !important;
                    }
                    h1 {
                        color: #1f2937 !important;
                        border-bottom: 2px solid #0d9488;
                        padding-bottom: 10px;
                    }
                    .text-white { color: #000000 !important; }
                    .text-gray-400 { color: #4b5563 !important; }
                    .text-teal-400 { color: #0d9488 !important; }
                    .text-red-300, .text-yellow-300 { color: #1f2937 !important; background: #e5e7eb !important; }
                    img { display: none; }
                }
            `}</style>

            {/* Main Application Container */}
            <div className="min-h-screen bg-gray-950 font-sans text-gray-100 p-4 sm:p-8">
                <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center print:hidden">
                    <div>
                        <h1 className="text-5xl font-extrabold text-white flex items-center">
                            <Map className="w-8 h-8 mr-3 text-teal-400 animate-pulse" />
                            Storyteller <span className="text-teal-400 ml-2">Ink Analytics</span>
                        </h1>
                        <p className="text-xl text-gray-400 mt-2 italic">
                            Zindagi Na Milegi Dobara (2011) - Emotional Journey Analysis
                        </p>
                    </div>
                    <button
                        onClick={handleExportPdf}
                        className="mt-4 md:mt-0 flex items-center px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-2xl shadow-teal-700/50 transform transition-all duration-200 active:scale-90 tracking-wider hover:shadow-teal-500/80"
                    >
                        <Save className="w-5 h-5 mr-2" />
                        Export Structured PDF Report
                    </button>
                </header>

                <main id="analytics-content" className="space-y-12">

                    {/* === ANALYTICAL METRICS BAR === */}
                    <section className="bg-gray-900 p-6 rounded-3xl shadow-3xl border border-gray-800">
                        <h2 className="text-2xl font-bold mb-4 flex items-center text-white">
                            <Zap className="w-6 h-6 mr-3 text-red-500" />
                            Flow Metrics
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <MetricCard title="Max Appeal (Climax)" value={analysisMetrics.maxAppeal} color="text-red-400" />
                            <MetricCard title="Min Appeal (Baseline)" value={analysisMetrics.minAppeal} color="text-blue-400" />
                            <MetricCard title="Emotional Range (Stakes)" value={analysisMetrics.range} color="text-yellow-400" />
                            <MetricCard title="Average Appeal" value={analysisMetrics.averageAppeal} color="text-teal-400" />
                            {/* NEW METRIC CARD */}
                            <MetricCard title="Pacing Score (Smoothed)" value={`${analysisMetrics.pacingScore}%`} color="text-purple-400" /> 
                        </div>
                    </section>
                    
                    {/* === AUTOMATIC GRAPH GENERATION === */}
                    <section className="bg-gray-900 p-6 rounded-3xl shadow-3xl border border-gray-800">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                            <h2 className="text-3xl font-bold text-white mb-2 md:mb-0 flex items-center">
                                <BarChart3 className="w-6 h-6 mr-3 text-red-500" />
                                Emotional Appeal Index (EAI) - Flow Visualization
                            </h2>
                            <div className="flex flex-wrap items-center space-x-4">
                                {/* CHART TYPE SELECTOR */}
                                <div className="flex items-center space-x-2">
                                    <BarChart4 className="w-5 h-5 text-gray-400" />
                                    <select
                                        value={chartType}
                                        onChange={(e) => setChartType(e.target.value)}
                                        className="bg-gray-700 text-white p-2 rounded-lg border border-gray-600 focus:ring-red-500 focus:border-red-500 transition"
                                    >
                                        <option value="line">Emotional Flow (Line)</option>
                                        <option value="bar">Scene Comparison (Bar)</option>
                                    </select>
                                </div>
                                {/* NARRATIVE ARC SELECTOR */}
                                <div className="flex items-center space-x-2">
                                    <Layers className="w-5 h-5 text-gray-400" />
                                    <select
                                        value={selectedArc.name}
                                        onChange={(e) => setSelectedArc(NARRATIVE_ARCS.find(arc => arc.name === e.target.value))}
                                        className="bg-gray-700 text-white p-2 rounded-lg border border-gray-600 focus:ring-teal-500 focus:border-teal-500 transition"
                                    >
                                        {NARRATIVE_ARCS.map(arc => (
                                            <option key={arc.name} value={arc.name}>{arc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        {/* NEW FEATURE: Curve Smoothing Control */}
                        <div className="bg-gray-800 p-4 rounded-xl mb-6 shadow-inner border border-gray-700 flex flex-col md:flex-row items-center space-y-3 md:space-y-0 md:space-x-4">
                            <Sliders className="w-5 h-5 text-purple-400 flex-shrink-0" />
                            <label htmlFor="smoothing" className="text-sm font-medium text-gray-300 flex-shrink-0">
                                Curve Smoothing Factor (Window Size: {Math.max(1, Math.floor(smoothingFactor / 2) * 2 + 1)})
                            </label>
                            <input
                                id="smoothing"
                                type="range"
                                min="0"
                                max="10"
                                value={smoothingFactor}
                                onChange={(e) => setSmoothingFactor(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg accent-purple-500"
                            />
                            <span className="text-purple-400 font-bold w-6 text-right">{smoothingFactor}</span>
                        </div>


                        <div id="emotional-graph" className="bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-inner shadow-gray-700/20 h-[450px] w-full animate-fadeIn">
                            <ResponsiveContainer width="100%" height="100%">
                                {chartType === 'line' ? (
                                    <LineChart
                                        data={chartData}
                                        // FIXED: Increased left margin for Y-Axis label alignment
                                        margin={{ top: 20, right: 20, left: 40, bottom: 5 }} 
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                                        <XAxis 
                                            dataKey="name" 
                                            stroke="#6EE7B7" 
                                            angle={-30} 
                                            textAnchor="end" 
                                            height={80} 
                                            interval={0}
                                            style={{ fontSize: '10px' }}
                                        />
                                        <YAxis 
                                            stroke="#6EE7B7" 
                                            label={{ 
                                                value: 'Emotional Appeal Index (EAI)', 
                                                angle: -90, 
                                                position: 'outerLeft', // FIX: Changed to outerLeft 
                                                dy: 20, // FIX: Shifted down for clearance
                                                fill: '#6EE7B7' 
                                            }}
                                            domain={[0, 'auto']}
                                        />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #0d9488', borderRadius: '8px', color: '#fff' }}
                                            formatter={(value, name) => [value, name]}
                                            labelFormatter={(label) => `Scene: ${label}`}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        {/* Original Appeal Index Line */}
                                        <Line 
                                            type="monotone" 
                                            dataKey="Emotional Appeal Index" 
                                            stroke="#EF4444" 
                                            strokeWidth={4}
                                            activeDot={{ r: 8, fill: '#FBBF24', stroke: '#EF4444', strokeWidth: 2 }}
                                            dot={false}
                                            name="Raw EAI"
                                            strokeOpacity={0.4}
                                        />
                                        {/* NEW: Smoothed Appeal Index Line */}
                                        <Line 
                                            type="monotone" 
                                            dataKey="Smoothed Emotional Appeal" 
                                            stroke="#A855F7" // Purple color for smoothed line
                                            strokeWidth={3}
                                            dot={false}
                                            name="Smoothed EAI (Pacing)"
                                        />

                                        {/* Render Narrative Arc Highlights (Unchanged) */}
                                        {selectedArc.structure.map((arc, index) => {
                                            const startName = chartData[arc.start - 1]?.name;
                                            const endName = chartData[arc.end - 1]?.name;

                                            return (
                                                <ReferenceArea 
                                                    key={index}
                                                    x1={startName}
                                                    x2={endName}
                                                    y1={0}
                                                    y2={analysisMetrics.maxAppeal + 1}
                                                    fill={arc.color}
                                                    fillOpacity={0.15}
                                                    stroke={arc.color}
                                                    strokeOpacity={0.5}
                                                    label={{ 
                                                        value: arc.label, 
                                                        position: 'top', 
                                                        fill: arc.color, 
                                                        fontWeight: 'bold',
                                                        fontSize: 12,
                                                    }}
                                                />
                                            );
                                        })}
                                    </LineChart>
                                ) : (
                                    <BarChart
                                        data={chartData}
                                        // FIXED: Increased left margin for Y-Axis label alignment
                                        margin={{ top: 20, right: 20, left: 40, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                                        <XAxis 
                                            dataKey="name" 
                                            stroke="#6EE7B7" 
                                            angle={-30} 
                                            textAnchor="end" 
                                            height={80} 
                                            interval={0}
                                            style={{ fontSize: '10px' }}
                                        />
                                        <YAxis 
                                            stroke="#6EE7B7" 
                                            label={{ 
                                                value: 'Emotional Appeal Index (EAI)', 
                                                angle: -90, 
                                                position: 'outerLeft', // FIX: Changed to outerLeft 
                                                dy: 20, // FIX: Shifted down for clearance
                                                fill: '#6EE7B7' 
                                            }}
                                            domain={[0, 'auto']}
                                        />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #0d9488', borderRadius: '8px', color: '#fff' }}
                                            formatter={(value, name) => [value, "Appeal Score"]}
                                            labelFormatter={(label) => `Scene: ${label}`}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        <Bar dataKey="Emotional Appeal Index" fill="#FBBF24" radius={[10, 10, 0, 0]} />
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </section>

                    {/* === DRAG & DROP STORY FLOW (Unchanged) === */}
                    <section className="bg-gray-900 p-6 rounded-3xl shadow-3xl border border-gray-800">
                        <h2 className="text-3xl font-bold mb-4 border-b border-gray-700 pb-2 flex items-center text-white">
                            <TrendingUp className="w-6 h-6 mr-3 text-teal-500" />
                            Double-Click-to-Drag Scene Flow Editor
                        </h2>
                        <p className="text-gray-400 mb-6 text-lg">
                            INTERACTION: Double-click the card to initiate the drag operation. The card should follow your cursor and release it over another card to drop it into the new sequence.
                        </p>

                        {/* CRITICAL: Attach the overall drop handler to the container */}
                        <div 
                            id="scene-flow" 
                            className="p-4 bg-gray-950 rounded-2xl border border-gray-700 space-y-4 shadow-inner shadow-gray-700/20"
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()} // Must prevent default on container for drop event to fire
                        >
                            {scenes.map((scene, index) => (
                                <SceneCard key={scene.id} scene={scene} index={index} />
                            ))}
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
};

export default App;
