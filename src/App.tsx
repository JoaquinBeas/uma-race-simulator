/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { memo } from 'react';
import SkillVisualizerApp from './skill-visualizer/app';

const MemoizedSkillVisualizerApp = memo(SkillVisualizerApp);

export default function App() {
  return <MemoizedSkillVisualizerApp />;
}
