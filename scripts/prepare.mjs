import { spawnSync } from 'node:child_process';

const check = spawnSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
if (check.status === 0) {
  spawnSync('git', ['config', 'core.hooksPath', '.husky'], { stdio: 'inherit' });
}
