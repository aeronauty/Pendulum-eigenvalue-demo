import React, { useRef, useState, useCallback, useEffect } from 'react';

interface State {
  theta1: number;
  theta2: number;
  dtheta1: number;
  dtheta2: number;
}

interface Settings {
  speed: number;
  m1: number;
  m2: number;
  L1: number;
  L2: number;
  g: number;
  damping: number;
  k1: number;
  k2: number;
}

interface ConceptualValues {
  damping: number;
  k1: number;
  k2: number;
}

type DragTarget = 'm1' | 'm2' | null;

interface PlotOptions {
  xAxis: string;
  yAxis: string;
}

interface TracePoint {
  x: number;
  y: number;
  timestamp: number;
}

interface ZoomWindow {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const plotParameters = [
  { value: 'x1', label: 'Mass 1 X Position' },
  { value: 'y1', label: 'Mass 1 Y Position' },
  { value: 'x2', label: 'Mass 2 X Position' },
  { value: 'y2', label: 'Mass 2 Y Position' },
  { value: 'theta1', label: 'θ₁' },
  { value: 'theta2', label: 'θ₂' },
  { value: 'time', label: 'Time' }
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>({
    theta1: Math.PI / 2,
    theta2: Math.PI / 4,
    dtheta1: 0,
    dtheta2: 0
  });

  const [settings, setSettings] = useState<Settings>({
    speed: 1.0,
    m1: 100,
    m2: 50,
    L1: 100,
    L2: 50,
    g: 9.81,
    damping: 0.01,
    k1: 0,
    k2: 0
  });

  const [conceptualEnabled, setConceptualEnabled] = useState(true);
  const [activeValues, setActiveValues] = useState<ConceptualValues>({
    damping: settings.damping,
    k1: settings.k1,
    k2: settings.k2
  });

  const [plotOptions, setPlotOptions] = useState<PlotOptions>({
    xAxis: 'time',
    yAxis: 'theta2'
  });
  const plotCanvasRef = useRef<HTMLCanvasElement>(null);
  const previousTimeRef = useRef<number | null>(null);
  const tracePointsRef = useRef<{ x1: number[], y1: number[], x2: number[], y2: number[] }>({
    x1: [], y1: [], x2: [], y2: []
  });
  const plotTimeRef = useRef<number>(0);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const dragTargetRef = useRef<DragTarget>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let lastTime = performance.now();

    const getBobPositions = (state: State) => {
      const { L1, L2 } = settingsRef.current;
      const x1 = L1 * Math.sin(state.theta1);
      const y1 = L1 * Math.cos(state.theta1);
      const x2 = x1 + L2 * Math.sin(state.theta2);
      const y2 = y1 + L2 * Math.cos(state.theta2);
      return { x1, y1, x2, y2 };
    };

    const screenToSim = (x: number, y: number) => ({
      x: x - canvas.width / 2,
      y: y - 100
    });

    canvas.onmousedown = (e) => {
      const { m1, m2 } = settingsRef.current;
      const { x1, y1, x2, y2 } = getBobPositions(stateRef.current);
      const { x, y } = screenToSim(e.offsetX, e.offsetY);
      const dist1 = Math.hypot(x - x1, y - y1);
      const dist2 = Math.hypot(x - x2, y - y2);
      const r1 = Math.sqrt(m1) * 0.5;
      const r2 = Math.sqrt(m2) * 0.5;

      dragTargetRef.current = dist2 < r2 + 5 ? 'm2' : dist1 < r1 + 5 ? 'm1' : null;
    };

    canvas.onmousemove = (e) => {
      if (!dragTargetRef.current) return;

      const { L1, L2 } = settingsRef.current;
      const { x, y } = screenToSim(e.offsetX, e.offsetY);

      if (dragTargetRef.current === 'm1') {
        stateRef.current.theta1 = Math.atan2(x, y);
        stateRef.current.dtheta1 = 0;
      } else {
        const d = Math.hypot(x, y);
        const clampedD = Math.min(L1 + L2, Math.max(Math.abs(L1 - L2), d));
        const angleToTarget = Math.atan2(x, y);
        const cosA = (L1 ** 2 + clampedD ** 2 - L2 ** 2) / (2 * L1 * clampedD);
        const A = Math.acos(Math.min(1, Math.max(-1, cosA)));
        const theta1 = angleToTarget - A;
        const cosB = (L1 ** 2 + L2 ** 2 - clampedD ** 2) / (2 * L1 * L2);
        const B = Math.acos(Math.min(1, Math.max(-1, cosB)));
        const theta2 = Math.PI - B;

        stateRef.current.theta1 = theta1;
        stateRef.current.theta2 = theta1 + theta2;
        stateRef.current.dtheta1 = 0;
        stateRef.current.dtheta2 = 0;
      }
    };

    canvas.onmouseup = () => {
      dragTargetRef.current = null;
    };

    const drawFrame = (currentTime: number) => {
      const { speed, m1, m2, L1, L2, g, damping, k1, k2 } = settingsRef.current;
      const fixedDt = 1 / 10;
      const dt = fixedDt * speed;
      lastTime = currentTime;

      if (!dragTargetRef.current) {
        const { theta1, theta2, dtheta1, dtheta2 } = stateRef.current;
        const delta = theta1 - theta2;
        const denom = 2 * m1 + m2 - m2 * Math.cos(2 * delta);

        const ddtheta1 = (
          -g * (2 * m1 + m2) * Math.sin(theta1)
          - m2 * g * Math.sin(theta1 - 2 * theta2)
          - 2 * Math.sin(delta) * m2 * (
            dtheta2 ** 2 * L2 + dtheta1 ** 2 * L1 * Math.cos(delta)
          )
          - k1 * theta1
        ) / (L1 * denom);

        const ddtheta2 = (
          2 * Math.sin(delta) * (
            dtheta1 ** 2 * L1 * (m1 + m2)
            + g * (m1 + m2) * Math.cos(theta1)
            + dtheta2 ** 2 * L2 * m2 * Math.cos(delta)
          )
          - k2 * (theta2 - theta1)
        ) / (L2 * denom);

        stateRef.current.dtheta1 += (ddtheta1 - damping * dtheta1) * dt;
        stateRef.current.dtheta2 += (ddtheta2 - damping * dtheta2) * dt;
        stateRef.current.theta1 += stateRef.current.dtheta1 * dt;
        stateRef.current.theta2 += stateRef.current.dtheta2 * dt;
        stateRef.current.theta1 = ((stateRef.current.theta1 + Math.PI) % (2 * Math.PI)) - Math.PI;
        stateRef.current.theta2 = ((stateRef.current.theta2 + Math.PI) % (2 * Math.PI)) - Math.PI;
      }

      const { x1, y1, x2, y2 } = getBobPositions(stateRef.current);

      if (Math.abs(x1) > 10000 || Math.abs(x2) > 10000) {
        console.warn("Simulation exploded: try reducing negative damping.");
        return;
      }

      const r1 = Math.sqrt(m1) * 0.5;
      const r2 = Math.sqrt(m2) * 0.5;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, 100);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x1, y1, r1, 0, 2 * Math.PI);
      ctx.arc(x2, y2, r2, 0, 2 * Math.PI);
      ctx.fillStyle = 'blue';
      ctx.fill();

      ctx.restore();
      requestAnimationFrame(drawFrame);
    };

    requestAnimationFrame(drawFrame);
  }, []);

  const updateSetting = (key: keyof typeof settings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // Update active values when changing conceptual properties
    if (key === 'damping' || key === 'k1' || key === 'k2') {
      setActiveValues(prev => ({
        ...prev,
        [key]: value
      }));
    }
  };

  const toggleConceptual = (enabled: boolean) => {
    setConceptualEnabled(enabled);
    if (enabled) {
      // Restore active values
      setSettings(prev => ({
        ...prev,
        damping: activeValues.damping,
        k1: activeValues.k1,
        k2: activeValues.k2
      }));
    } else {
      // Store current values before setting to zero
      setActiveValues({
        damping: settings.damping,
        k1: settings.k1,
        k2: settings.k2
      });
      setSettings(prev => ({
        ...prev,
        damping: 0,
        k1: 0,
        k2: 0
      }));
    }
  };

  const slider = (label: string, key: keyof Settings, min: number, max: number, step: number = 1) => (
    <label style={{ display: 'block', marginBottom: '0.5em' }}>
      {label}: {settings[key].toFixed(2)}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[key]}
        onChange={(e) => updateSetting(key, parseFloat(e.target.value))}
        style={{ width: '300px', marginLeft: '1em' }}
      />
    </label>
  );

  // Add timeRef to track total simulation time
  const timeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Modify getPlotValue to handle time correctly
  const getPlotValue = (param: string, state: typeof stateRef.current) => {
    const x1 = settings.L1 * Math.sin(state.theta1);
    const y1 = -settings.L1 * Math.cos(state.theta1);
    const x2 = x1 + settings.L2 * Math.sin(state.theta2);
    const y2 = y1 - settings.L2 * Math.cos(state.theta2);

    switch(param) {
      case 'time': return timeRef.current;
      case 'x1': return x1;
      case 'y1': return y1;
      case 'x2': return x2;
      case 'y2': return y2;
      case 'theta1': return state.theta1;
      case 'theta2': return state.theta2;
      default: return 0;
    }
  };

  // Modify animation loop to handle time and traces
  useEffect(() => {
    let animationFrameId: number;
    
    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;
      timeRef.current += deltaTime * settings.speed;

      const newState = updateState(stateRef.current, deltaTime * settings.speed, settings);
      stateRef.current = newState;

      const point: TracePoint = {
        x: getPlotValue(plotOptions.xAxis, newState),
        y: getPlotValue(plotOptions.yAxis, newState),
        timestamp: timeRef.current
      };
      
      tracePointsRef.current.push(point);
      if (tracePointsRef.current.length > 5000) {
        tracePointsRef.current.shift();
      }

      // drawPendulum(canvasRef.current!, newState, settings.L1, settings.L2);
      drawPlot();

      animationFrameId = requestAnimationFrame(animate);
    };

    // Clear trace when plot options change
    tracePointsRef.current = [];
    timeRef.current = 0;
    lastTimeRef.current = 0;

    animationFrameId = requestAnimationFrame(animate);

    // Cleanup function to cancel animation frame when effect is cleaned up
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [plotOptions.xAxis, plotOptions.yAxis]); // Only depend on the actual plot variables that changed

  // Add all zoom-related state and refs
  const [isAutoScale, setIsAutoScale] = useState(true);
  const [zoomWindow, setZoomWindow] = useState<ZoomWindow | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const zoomRef = useRef<ZoomWindow | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const [baseScale, setBaseScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);

  const drawPlot = () => {
    const canvas = plotCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw axes
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height/2);
    ctx.lineTo(canvas.width, canvas.height/2);
    ctx.moveTo(canvas.width/2, 0);
    ctx.lineTo(canvas.width/2, canvas.height);
    ctx.stroke();

    const points = tracePointsRef.current;
    if (points.length < 2) return;

    // Calculate scale based on mode
    let scale;
    if (isAutoScale) {
      const visiblePoints = points.slice(Math.max(points.length - 100, 0));
      const xMax = Math.max(...visiblePoints.map(p => Math.abs(p.x)), 0.1);
      const yMax = Math.max(...visiblePoints.map(p => Math.abs(p.y)), 0.1);
      scale = Math.min(
        (canvas.width/2) / xMax,
        (canvas.height/2) / yMax
      ) * 0.8;
    } else if (zoomRef.current) {
      const zoom = zoomRef.current;
      const xRange = Math.abs(zoom.endX - zoom.startX);
      const yRange = Math.abs(zoom.endY - zoom.startY);
      scale = Math.min(
        canvas.width / xRange,
        canvas.height / yRange
      ) * 0.4;
    } else {
      scale = 1;
    }

    // Draw trace
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(
      canvas.width/2 + points[0].x * scale,
      canvas.height/2 - points[0].y * scale
    );

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(
        canvas.width/2 + points[i].x * scale,
        canvas.height/2 - points[i].y * scale
      );
    }
    ctx.stroke();

    // Draw selection box if dragging
    if (isDragging && zoomWindow) {
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        zoomWindow.startX,
        zoomWindow.startY,
        zoomWindow.endX - zoomWindow.startX,
        zoomWindow.endY - zoomWindow.startY
      );
      ctx.setLineDash([]);
    }
  };

  const getPlotCoords = (canvas: HTMLCanvasElement, event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = plotCanvasRef.current;
    if (!canvas) return;
    
    const coords = getPlotCoords(canvas, event);
    dragStartRef.current = coords;
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    
    const canvas = plotCanvasRef.current;
    if (!canvas) return;
    
    const coords = getPlotCoords(canvas, event);
    setZoomWindow({
      startX: dragStartRef.current.x,
      startY: dragStartRef.current.y,
      endX: coords.x,
      endY: coords.y
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && zoomWindow) {
      // Only update zoom if selection is large enough
      if (Math.abs(zoomWindow.endX - zoomWindow.startX) > 10 &&
          Math.abs(zoomWindow.endY - zoomWindow.startY) > 10) {
        zoomRef.current = zoomWindow;
        setIsAutoScale(false);
      }
    }
    setIsDragging(false);
    setZoomWindow(null);
  }, [isDragging, zoomWindow]);

  const resetZoom = useCallback(() => {
    setIsAutoScale(true);
    zoomRef.current = null;
  }, []);

  // Add effect to manage mouse event listeners
  useEffect(() => {
    const canvas = plotCanvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, zoomWindow]);

  return (
    <div>
      <h1>Interactive Double Pendulum</h1>
      
      <h2>Simulation</h2>
      {slider('Speed', 'speed', 0.1, 10, 0.1)}
      
      <h2>Physical Properties</h2>
      {slider('Mass 1', 'm1', 10, 200)}
      {slider('Mass 2', 'm2', 10, 200)}
      {slider('Length 1', 'L1', 10, 200)}
      {slider('Length 2', 'L2', 10, 200)}
      {slider('Gravity', 'g', 0.1, 20, 0.1)}
      
      <h2>
        Conceptual Properties 
        <input
          type="checkbox"
          checked={conceptualEnabled}
          onChange={(e) => toggleConceptual(e.target.checked)}
          style={{ marginLeft: '1em' }}
        />
      </h2>
      <div style={{ opacity: conceptualEnabled ? 1 : 0.5 }}>
        {slider('Damping', 'damping', -1, 1, 0.01)}
        {slider('Stiffness θ₁', 'k1', -10000, 10000, 1)}
        {slider('Stiffness θ₂', 'k2', -10000, 10000, 1)}
      </div>

      <div style={{ marginBottom: '1em' }}>
        <button onClick={() => {
          stateRef.current = {
            theta1: Math.PI / 2,
            theta2: Math.PI / 4,
            dtheta1: 0,
            dtheta2: 0
          };
        }}>
          Reset Angles
        </button>
        <button onClick={() => updateSetting('damping', 0)} style={{ marginLeft: '1em' }}>
          Zero Damping
        </button>
        <button onClick={() => updateSetting('k1', 0)} style={{ marginLeft: '1em' }}>
          Zero Stiffness θ₁
        </button>
        <button onClick={() => updateSetting('k2', 0)} style={{ marginLeft: '1em' }}>
          Zero Stiffness θ₂
        </button>
      </div>
      <div style={{ display: 'flex', gap: '20px' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          style={{ border: '1px solid #ccc', marginTop: '1em', touchAction: 'none' }}
        />
        <div>
          <div style={{ marginBottom: '1em' }}>
            <select 
              value={plotOptions.xAxis}
              onChange={(e) => setPlotOptions(prev => ({ ...prev, xAxis: e.target.value }))}
            >
              {plotParameters.map(param => (
                <option key={param.value} value={param.value}>{param.label}</option>
              ))}
            </select>
            <span> vs </span>
            <select
              value={plotOptions.yAxis}
              onChange={(e) => setPlotOptions(prev => ({ ...prev, yAxis: e.target.value }))}
            >
              {plotParameters.map(param => (
                <option key={param.value} value={param.value}>{param.label}</option>
              ))}
            </select>
          </div>
          <div>
            <button 
              onClick={resetZoom}
              style={{ marginLeft: '1em' }}
            >
              Reset Zoom
            </button>
          </div>
          <canvas
            ref={plotCanvasRef}
            width={600}
            height={400}
            style={{ 
              border: '1px solid #ccc', 
              cursor: isDragging ? 'crosshair' : 'default'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>
    </div>
  );
}

function updateState(
  state: { theta1: number; theta2: number; dtheta1: number; dtheta2: number },
  dt: number,
  settings: {
    m1: number;
    m2: number;
    L1: number;
    L2: number;
    g: number;
    damping: number;
    k1: number;
    k2: number;
  }
) {
  const { theta1, theta2, dtheta1, dtheta2 } = state;
  const { m1, m2, L1, L2, g, damping, k1, k2 } = settings;

  // Full nonlinear equations of motion for the double pendulum
  const den = (m1 + m2) * L1 - m2 * L1 * Math.cos(theta1 - theta2) * Math.cos(theta1 - theta2);
  
  const ddtheta1 = (
    -g * (m1 + m2) * Math.sin(theta1) 
    - m2 * g * Math.sin(theta1 - 2 * theta2) 
    - 2 * Math.sin(theta1 - theta2) * m2 * (
      dtheta2 * dtheta2 * L2 + dtheta1 * dtheta1 * L1 * Math.cos(theta1 - theta2)
    )
    - k1 * theta1  // Added spring term
    - damping * dtheta1  // Added damping term
  ) / (L1 * den);

  const ddtheta2 = (
    2 * Math.sin(theta1 - theta2) * (
      dtheta1 * dtheta1 * L1 * (m1 + m2) 
      + g * (m1 + m2) * Math.cos(theta1) 
      + dtheta2 * dtheta2 * L2 * m2 * Math.cos(theta1 - theta2)
    )
    - k2 * theta2  // Added spring term
    - damping * dtheta2  // Added damping term
  ) / (L2 * den);

  // Update velocities and positions using RK4 integration
  const newDtheta1 = dtheta1 + ddtheta1 * dt;
  const newDtheta2 = dtheta2 + ddtheta2 * dt;
  const newTheta1 = theta1 + newDtheta1 * dt;
  const newTheta2 = theta2 + newDtheta2 * dt;

  return {
    theta1: newTheta1,
    theta2: newTheta2,
    dtheta1: newDtheta1,
    dtheta2: newDtheta2
  };
}