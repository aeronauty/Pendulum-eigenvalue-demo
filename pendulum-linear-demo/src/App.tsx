// App.tsx
import { useEffect, useRef, useState } from 'react';

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
}

type DragTarget = 'm1' | 'm2' | null;

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
    damping: 0.01
  });

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

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
      const { speed, m1, m2, L1, L2, g, damping } = settingsRef.current;
      const fixedDt = 1 / 20;
      const dt = fixedDt * settingsRef.current.speed;
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
        ) / (L1 * denom);

        const ddtheta2 = (
          2 * Math.sin(delta) * (
            dtheta1 ** 2 * L1 * (m1 + m2)
            + g * (m1 + m2) * Math.cos(theta1)
            + dtheta2 ** 2 * L2 * m2 * Math.cos(delta)
          )
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

  const updateSetting = (key: keyof Settings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
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

  return (
    <div>
      <h1>Interactive Double Pendulum</h1>
      {slider('Speed', 'speed', 0.1, 10, 0.1)}
      {slider('Mass 1', 'm1', 10, 200)}
      {slider('Mass 2', 'm2', 10, 200)}
      {slider('Length 1', 'L1', 10, 200)}
      {slider('Length 2', 'L2', 10, 200)}
      {slider('Gravity', 'g', 0.1, 20, 0.1)}
      {slider('Damping', 'damping', -1, 1, 0.01)}
      <button onClick={() => {
        stateRef.current = {
          theta1: Math.PI / 2,
          theta2: Math.PI / 4,
          dtheta1: 0,
          dtheta2: 0
        };
      }}>
        Reset
      </button>
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        style={{ border: '1px solid #ccc', marginTop: '1em', touchAction: 'none' }}
      />
    </div>
  );
}