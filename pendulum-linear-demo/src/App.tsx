import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { simulateDoublePendulum } from './simulate';

export default function App() {
  const [x1, y1, x2, y2] = useMemo(() =>
    simulateDoublePendulum({
      m1: 100, m2: 50,
      L1: 1.0, L2: 0.5,
      g: 9.81,
      theta1: Math.PI / 2,
      theta2: Math.PI / 4,
      dtheta1: 0,
      dtheta2: 0,
      dt: 0.01,
      steps: 300
    }), []);

  const frames = x1.map((_, i) => ({
    data: [{
      x: [0, x1[i], x2[i]],
      y: [0, y1[i], y2[i]],
      mode: 'lines+markers',
      type: 'scatter'
    }],
    name: String(i)
  }));

  return (
    <div>
      <h1>Double Pendulum Animation</h1>
      <Plot
        data={[{
          x: [0, x1[0], x2[0]],
          y: [0, y1[0], y2[0]],
          mode: 'lines+markers',
          type: 'scatter'
        }]}
        layout={{
          width: 600,
          height: 400,
          title: 'Pendulum Motion',
          xaxis: { range: [-2, 2], zeroline: false, scaleanchor: 'y' },
          yaxis: { range: [-2, 2], zeroline: false },
          updatemenus: [{
            type: 'buttons',
            buttons: [{
              label: 'Play',
              method: 'animate',
              args: [null, { frame: { duration: 20 }, fromcurrent: true }]
            }]
          }],
          sliders: [{
            steps: frames.map((f, i) => ({
              label: `${i}`,
              method: 'animate',
              args: [[f.name], { mode: 'immediate', frame: { duration: 0 } }]
            }))
          }]
        }}
        frames={frames}
      />
    </div>
  );
}