export interface PendulumParams {
  m1: number;
  m2: number;
  L1: number;
  L2: number;
  g: number;
  theta1: number;
  theta2: number;
  dtheta1: number;
  dtheta2: number;
  dt: number;
  steps: number;
}

export function simulateDoublePendulum(p: PendulumParams): [number[], number[], number[], number[]] {
  const { m1, m2, L1, L2, g, dt, steps } = p;
  let { theta1, theta2, dtheta1, dtheta2 } = p;

  const x1: number[] = [], y1: number[] = [], x2: number[] = [], y2: number[] = [];

  for (let i = 0; i < steps; i++) {
    const delta = theta1 - theta2;
    const denom = 2 * m1 + m2 - m2 * Math.cos(2 * delta);

    const ddtheta1 = (
      -g * (2 * m1 + m2) * Math.sin(theta1)
      - m2 * g * Math.sin(theta1 - 2 * theta2)
      - 2 * Math.sin(delta) * m2 * (dtheta2**2 * L2 + dtheta1**2 * L1 * Math.cos(delta))
    ) / (L1 * denom);

    const ddtheta2 = (
      2 * Math.sin(delta) * (
        dtheta1**2 * L1 * (m1 + m2)
        + g * (m1 + m2) * Math.cos(theta1)
        + dtheta2**2 * L2 * m2 * Math.cos(delta)
      )
    ) / (L2 * denom);

    dtheta1 += ddtheta1 * dt;
    dtheta2 += ddtheta2 * dt;
    theta1 += dtheta1 * dt;
    theta2 += dtheta2 * dt;

    x1.push(L1 * Math.sin(theta1));
    y1.push(-L1 * Math.cos(theta1));
    x2.push(x1[i] + L2 * Math.sin(theta2));
    y2.push(y1[i] - L2 * Math.cos(theta2));
  }

  return [x1, y1, x2, y2];
}