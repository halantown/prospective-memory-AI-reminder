import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Constants ---
const GAME_DURATION = 60; // Total game duration (seconds)
const VIP_TRIGGER_TIME = 30; // Time remaining when VIP order triggers (seconds)
const TICK_RATE = 100; // Game loop refresh rate (ms)
const TICKS_PER_SEC = 1000 / TICK_RATE;

const PAN_STATE = {
  EMPTY: 'empty',
  RAW: 'raw',       // 0-3s
  COOKED: 'cooked', // 3-4.5s
  BURNT: 'burnt'    // >4.5s
};

const VirtualKitchenExperiment = () => {
  // --- Game State ---
  const [gameState, setGameState] = useState('encoding'); // encoding, playing, gameover
  const [condition, setCondition] = useState('A'); // A: High Fidelity, B: Low Fidelity, C: Baseline
  
  // --- UI Data State ---
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [pressure, setPressure] = useState(0);
  const [orders, setOrders] = useState([
    { id: 1, type: 'normal' },
    { id: 2, type: 'normal' },
    { id: 3, type: 'normal' },
  ]);
  const [pans, setPans] = useState([
    { id: 0, state: PAN_STATE.EMPTY, progress: 0 },
    { id: 1, state: PAN_STATE.EMPTY, progress: 0 },
    { id: 2, state: PAN_STATE.EMPTY, progress: 0 },
  ]);
  
  // --- Interaction Selection State ---
  const [selectedPan, setSelectedPan] = useState(null);
  const [selectedSauce, setSelectedSauce] = useState(null);
  const [aiMessage, setAiMessage] = useState("");

  // --- Experiment Data Recording (Refs for precise timing, unaffected by React render cycle) ---
  const expData = useRef({
    targetAppearedTime: null,
    firstActionTime: null,
    targetCompletedTime: null,
    vipActive: false,
    orderCounter: 3
  });

  // --- Game Main Loop ---
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      // 1. Update time
      setTimeLeft((prevTime) => {
        const newTime = prevTime - (1 / TICKS_PER_SEC);
        
        // VIP order trigger logic
        if (Math.abs(newTime - VIP_TRIGGER_TIME) < 0.05 && !expData.current.vipActive) {
          triggerVIPOrder();
        }
        
        if (newTime <= 0) {
          setGameState('gameover');
          return 0;
        }
        return newTime;
      });

      // 2. Update pressure gauge (increases 5%-15% per second -> 0.5%-1.5% per tick)
      setPressure((prev) => {
        const increase = (Math.random() * 1 + 0.5); 
        const newPressure = prev + increase;
        if (newPressure >= 100) {
          setScore((s) => s - 20); // Pressure overload penalty
          return 0;
        }
        return newPressure;
      });

      // 3. Update pan cooking progress
      setPans((prevPans) => prevPans.map(pan => {
        if (pan.state === PAN_STATE.EMPTY) return pan;
        
        const newProgress = pan.progress + 1; // +1 per tick (0.1s)
        let newState = pan.state;
        
        if (newProgress < 30) {
          newState = PAN_STATE.RAW; // 0-3s
        } else if (newProgress >= 30 && newProgress < 45) {
          newState = PAN_STATE.COOKED; // 3-4.5s
        } else if (newProgress >= 45) {
          newState = PAN_STATE.BURNT; // >4.5s
          // Burnt food: auto-clear and deduct points
          if (pan.state !== PAN_STATE.BURNT) {
             setScore(s => s - 10);
             setTimeout(() => clearPan(pan.id), 500); // Delay 0.5s for visual feedback
          }
        }
        
        return { ...pan, state: newState, progress: newProgress };
      }));

    }, TICK_RATE);

    return () => clearInterval(interval);
  }, [gameState]);

  // --- Global Click Listener (Records First_Action_Time) ---
  useEffect(() => {
    const handleGlobalClick = () => {
      if (expData.current.vipActive && !expData.current.firstActionTime && expData.current.targetAppearedTime) {
        expData.current.firstActionTime = Date.now();
        console.log(`[Log] First_Action_Time: ${expData.current.firstActionTime}`);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // --- Core Logic Functions ---
  const clearPan = (id) => {
    setPans(prev => prev.map(p => p.id === id ? { ...p, state: PAN_STATE.EMPTY, progress: 0 } : p));
    if (selectedPan === id) setSelectedPan(null);
  };

  const triggerVIPOrder = () => {
    expData.current.vipActive = true;
    expData.current.targetAppearedTime = Date.now();
    expData.current.orderCounter += 1;
    
    // Add VIP order to queue
    setOrders(prev => [...prev, { id: expData.current.orderCounter, type: 'vip' }]);
    
    console.log(`\n--- PM TARGET APPEARED ---`);
    console.log(`[Log] Target_Appeared_Time: ${expData.current.targetAppearedTime}`);

    // AI Assistant Intervention (Independent Variable)
    if (condition === 'A') {
      setAiMessage("Attention! That gold star order needs the red hot sauce!");
    } else if (condition === 'B') {
      setAiMessage("Attention! The VIP order has a special requirement!");
    } else {
      setAiMessage(""); // Control condition
    }
  };

  // --- Interaction Event Handlers ---
  const handleRawMeatClick = (e) => {
    e.stopPropagation(); // Prevent bubbling to avoid multiple global click triggers
    const emptyPan = pans.find(p => p.state === PAN_STATE.EMPTY);
    if (emptyPan) {
      setPans(prev => prev.map(p => p.id === emptyPan.id ? { ...p, state: PAN_STATE.RAW, progress: 0 } : p));
    }
  };

  const handlePanClick = (id, e) => {
    e.stopPropagation();
    const pan = pans.find(p => p.id === id);
    if (pan && pan.state === PAN_STATE.COOKED) {
      setSelectedPan(id);
    }
  };

  const handleSauceClick = (type, e) => {
    e.stopPropagation();
    setSelectedSauce(type);
    
    // Record Target_Completed_Time: VIP is active and red sauce clicked for the first time
    if (expData.current.vipActive && type === 'red' && !expData.current.targetCompletedTime) {
      expData.current.targetCompletedTime = Date.now();
      const rt = expData.current.targetCompletedTime - expData.current.targetAppearedTime;
      console.log(`[Log] Target_Completed_Time: ${expData.current.targetCompletedTime}`);
      console.log(`[Log] Reaction Time (RT): ${rt} ms`);
    }
  };

  const handleVentClick = (e) => {
    e.stopPropagation();
    setPressure(0);
  };

  const handleServeClick = (e) => {
    e.stopPropagation();
    if (selectedPan === null || selectedSauce === null) return;
    if (orders.length === 0) return;

    const currentOrder = orders[0];
    let isCorrect = false;

    // --- Data Recording Logic (Accuracy) ---
    if (currentOrder.type === 'vip') {
      if (selectedSauce === 'red') {
        console.log(`[Log] Accuracy: Hit`);
        setScore(s => s + 30); // VIP correct bonus
        isCorrect = true;
      } else {
        console.log(`[Log] Accuracy: Miss (Used wrong sauce)`);
        setScore(s => s - 10);
      }
      // VIP order completed, reset state
      expData.current.vipActive = false;
      expData.current.targetAppearedTime = null;
      expData.current.firstActionTime = null;
      expData.current.targetCompletedTime = null;
      setAiMessage(""); // Clear AI prompt
    } else {
      // Normal Order
      if (selectedSauce === 'red') {
        console.log(`[Log] Accuracy: False Alarm (Used red sauce on normal order)`);
        setScore(s => s - 10);
      } else {
        setScore(s => s + 10); // Normal order correct bonus
        isCorrect = true;
      }
    }

    // Complete serving: clear pan, clear selection, remove order and add new one
    clearPan(selectedPan);
    setSelectedPan(null);
    setSelectedSauce(null);
    
    setOrders(prev => {
      const newOrders = prev.slice(1);
      expData.current.orderCounter += 1;
      // Keep a minimum number of orders in the queue
      if (newOrders.length < 4) {
         newOrders.push({ id: expData.current.orderCounter, type: 'normal' });
      }
      return newOrders;
    });
  };

  // --- UI Rendering Helpers ---
  const getPanColor = (state) => {
    switch(state) {
      case PAN_STATE.EMPTY: return 'bg-gray-700';
      case PAN_STATE.RAW: return 'bg-red-400';
      case PAN_STATE.COOKED: return 'bg-green-500';
      case PAN_STATE.BURNT: return 'bg-black';
      default: return 'bg-gray-700';
    }
  };

  if (gameState === 'encoding') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-8">
        <div className="max-w-2xl bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700">
          <h1 className="text-3xl font-bold mb-6 text-center text-blue-400">🍔 Kitchen Prospective Memory Test</h1>
          
          <div className="space-y-4 mb-8 text-lg">
            <p>Welcome to the Virtual Kitchen. Your brain is about to be tested!</p>
            <div className="bg-slate-700 p-4 rounded-lg">
              <h2 className="font-bold text-yellow-400 mb-2">🔥 Primary Task:</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Click the <strong>Raw Meat</strong> to place it in an empty pan.</li>
                <li>Watch the heat: the meat turns green (cooked) at 3–4.5 seconds.</li>
                <li>Serving steps: Click a <strong>green pan</strong> → Choose a <strong>sauce</strong> → Click <strong>Serve</strong>.</li>
                <li>If the meat turns black (burnt), it is auto-cleared and you lose points!</li>
              </ul>
            </div>
            
            <div className="bg-slate-700 p-4 rounded-lg">
              <h2 className="font-bold text-blue-400 mb-2">⏱️ Secondary Task:</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Keep an eye on the <strong>Pressure Gauge</strong> on the left — it rises automatically.</li>
                <li>Click the <strong>Vent</strong> button before it reaches 100%, or you lose a lot of points!</li>
              </ul>
            </div>

            <div className="bg-red-900 border-2 border-red-500 p-4 rounded-lg animate-pulse">
              <h2 className="font-bold text-red-400 mb-2">⚠️ Prospective Memory Task:</h2>
              <p>If a VIP order with a <strong>gold star (⭐)</strong> appears in the order queue at the top, you <strong>must</strong> select the <strong>🔴 Red Hot Sauce</strong> instead of the regular ketchup when serving that order!</p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Select Experiment Condition (AI Hint Level):</label>
            <div className="flex space-x-4">
              {['A', 'B', 'C'].map(cond => (
                <label key={cond} className="flex items-center space-x-2 cursor-pointer">
                  <input 
                    type="radio" 
                    value={cond} 
                    checked={condition === cond}
                    onChange={(e) => setCondition(e.target.value)}
                    className="form-radio text-blue-500"
                  />
                  <span>
                    {cond === 'A' && "A (High Cue — Specific Guidance)"}
                    {cond === 'B' && "B (Low Cue — Vague Reminder)"}
                    {cond === 'C' && "C (Baseline — No Hint)"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button 
            onClick={() => setGameState('playing')}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all shadow-lg hover:shadow-blue-500/50"
          >
            Start Experiment
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'gameover') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-8">
        <h1 className="text-5xl font-bold mb-4">Experiment Complete</h1>
        <p className="text-2xl mb-8">Your Final Score: <span className="text-yellow-400 font-bold">{score}</span></p>
        <p className="text-gray-400 mb-8">Press F12 to open the console and review RT & Accuracy logs.</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-500 font-bold py-3 px-6 rounded-lg"
        >
          Restart
        </button>
      </div>
    );
  }

  // --- Main Game Interface (playing) ---
  return (
    <div className="flex flex-col h-screen bg-slate-800 text-white select-none overflow-hidden font-sans">
      
      {/* Top Area: Order Queue & Status Bar */}
      <div className="h-24 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6 shadow-md z-10">
        
        {/* Status Bar */}
        <div className="flex space-x-8 text-xl font-bold bg-slate-800 p-3 rounded-lg border border-slate-600">
          <div className="text-yellow-400">Score: {score}</div>
          <div className={`${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
            Time: {Math.ceil(timeLeft)}s
          </div>
        </div>

        {/* Order Queue */}
        <div className="flex-1 flex justify-end items-center space-x-4 overflow-hidden px-4">
          {orders.map((order, index) => (
            <div 
              key={order.id} 
              className={`flex items-center justify-center w-20 h-20 rounded-xl border-4 transition-all duration-300 ${
                index === 0 ? 'scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'opacity-80'
              } ${order.type === 'vip' ? 'bg-yellow-900 border-yellow-400' : 'bg-slate-700 border-slate-500'}`}
            >
              <span className="text-4xl drop-shadow-md">🍔</span>
              {order.type === 'vip' && (
                <span className="absolute -top-3 -right-3 text-3xl animate-bounce drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]">⭐</span>
              )}
              {/* Highlight the current order being processed */}
              {index === 0 && <div className="absolute -bottom-6 text-xs text-green-400 font-bold">Current</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Area: Secondary Task (Pressure Gauge) */}
        <div className="w-48 bg-slate-900 border-r border-slate-700 flex flex-col items-center py-8 px-4 shadow-inner">
          <h3 className="text-gray-400 font-bold mb-4">Pressure</h3>
          
          <div className="w-12 h-64 bg-slate-800 rounded-full p-1 border-2 border-slate-600 relative overflow-hidden flex flex-col justify-end mb-6 shadow-inner">
            <div 
              className={`w-full rounded-full transition-all duration-100 ease-linear ${
                pressure > 80 ? 'bg-red-500' : pressure > 50 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ height: `${pressure}%` }}
            ></div>
            {/* Scale markers */}
            <div className="absolute top-[20%] w-full border-t border-white/20"></div>
            <div className="absolute top-[50%] w-full border-t border-white/20"></div>
          </div>
          
          <button 
            onClick={handleVentClick}
            className="w-full py-4 rounded-xl font-bold text-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 active:scale-95 transition-all border border-slate-500 shadow-md flex items-center justify-center"
          >
            💨 Vent
            <br/>(Release)
          </button>
        </div>

        {/* Center Area: Primary Task Zone */}
        <div className="flex-1 flex flex-col items-center justify-center relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-700 to-slate-800">
          
          {/* Raw Meat Stack */}
          <div className="mb-12 cursor-pointer group" onClick={handleRawMeatClick}>
            <div className="w-32 h-32 bg-red-800 rounded-2xl border-4 border-red-900 shadow-xl flex items-center justify-center group-hover:bg-red-700 transition-colors">
              <div className="text-center">
                <div className="text-4xl mb-1">🥩</div>
                <div className="text-sm font-bold text-red-200">Raw Meat</div>
              </div>
            </div>
          </div>

          {/* 3 Frying Pans */}
          <div className="flex space-x-12">
            {pans.map((pan) => (
              <div key={pan.id} className="flex flex-col items-center">
                <div 
                  onClick={(e) => handlePanClick(pan.id, e)}
                  className={`w-32 h-32 rounded-full border-8 flex items-center justify-center cursor-pointer transition-all shadow-2xl relative
                    ${getPanColor(pan.state)} 
                    ${selectedPan === pan.id ? 'border-yellow-400 scale-110 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : 'border-slate-900 hover:border-slate-600'}`
                  }
                >
                  {/* Meat visual representation */}
                  {pan.state !== PAN_STATE.EMPTY && (
                    <div className={`w-16 h-16 rounded-md shadow-inner ${
                      pan.state === PAN_STATE.RAW ? 'bg-red-500' :
                      pan.state === PAN_STATE.COOKED ? 'bg-green-400' : 'bg-slate-900'
                    }`}></div>
                  )}
                  
                  {pan.state === PAN_STATE.BURNT && <span className="absolute text-3xl">🔥</span>}
                  {pan.state === PAN_STATE.COOKED && <span className="absolute -top-4 text-green-400 font-bold text-xl animate-bounce">✓</span>}
                </div>
                
                {/* Cooking progress bar */}
                <div className="w-32 h-3 bg-slate-900 mt-4 rounded-full overflow-hidden border border-slate-700">
                  <div 
                    className={`h-full transition-all duration-100 ease-linear ${
                      pan.progress < 30 ? 'bg-red-500' : pan.progress < 45 ? 'bg-green-500' : 'bg-red-800'
                    }`}
                    style={{ width: `${Math.min((pan.progress / 45) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Right Area: Serving Station & Sauces (Action / PM Task) */}
        <div className="w-64 bg-slate-900 border-l border-slate-700 flex flex-col p-6 shadow-2xl z-10 relative">
          
          <h3 className="text-gray-400 font-bold mb-6 text-center">Action Station</h3>

          {/* Sauce Selection Area */}
          <div className="flex flex-col space-y-4 mb-auto">
            <button
              onClick={(e) => handleSauceClick('standard', e)}
              className={`py-6 rounded-xl font-bold text-lg flex flex-col items-center transition-all border-4 shadow-lg
                ${selectedSauce === 'standard' ? 'bg-yellow-500 border-white scale-105' : 'bg-yellow-600 border-yellow-800 hover:bg-yellow-500'}`}
            >
              <span className="text-2xl mb-1">🫙</span>
              Regular Ketchup
            </button>

            <button
              onClick={(e) => handleSauceClick('red', e)}
              className={`py-6 rounded-xl font-bold text-lg flex flex-col items-center transition-all border-4 shadow-lg
                ${selectedSauce === 'red' ? 'bg-red-500 border-white scale-105 shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'bg-red-700 border-red-900 hover:bg-red-600'}`}
            >
              <span className="text-2xl mb-1">🌶️</span>
              Red Hot Sauce
            </button>
          </div>

          {/* Serving Station */}
          <button
            onClick={handleServeClick}
            className={`mt-8 py-8 rounded-2xl font-black text-2xl uppercase tracking-wider transition-all shadow-[0_10px_0_rgba(0,0,0,0.5)] active:shadow-[0_0px_0_rgba(0,0,0,0.5)] active:translate-y-2
              ${selectedPan !== null && selectedSauce !== null ? 'bg-green-500 hover:bg-green-400 text-slate-900' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
          >
            🍽️ Serve
            <br/><span className="text-sm normal-case font-medium opacity-80">(Deliver Order)</span>
          </button>
        </div>

        {/* AI Assistant Prompt Area (The Independent Variable Intervention) */}
        <div className={`absolute bottom-6 right-[17rem] transition-all duration-500 transform flex items-end ${aiMessage ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
          <div className="bg-white text-slate-900 px-6 py-4 rounded-t-2xl rounded-bl-2xl shadow-2xl max-w-xs font-bold text-lg border-4 border-blue-400 relative">
            {aiMessage}
            <div className="absolute -right-3 bottom-0 w-4 h-4 bg-white border-r-4 border-b-4 border-blue-400 transform rotate-45"></div>
          </div>
          <div className="w-16 h-16 bg-slate-800 rounded-full border-4 border-blue-400 flex items-center justify-center text-4xl ml-4 shadow-xl z-20">
            🤖
          </div>
        </div>

      </div>
    </div>
  );
};

export default VirtualKitchenExperiment;