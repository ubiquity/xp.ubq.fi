const { spawn } = await import('node:child_process');
const readline = await import('node:readline');
const os = await import('node:os');

const denoCmd = [
  'deno',
  'run',
  '--allow-read',
  '--allow-net',
  'tools/server.ts',
];

const proc = spawn(denoCmd[0], denoCmd.slice(1), {
  stdio: ['inherit', 'pipe', 'inherit'],
});

const rl = readline.createInterface({
  input: proc.stdout,
  crlfDelay: Infinity,
});

let opened = false;

rl.on('line', (line) => {
  console.log(line);
  if (!opened) {
    const match = line.match(/(http:\/\/localhost:\d+)/);
    if (match) {
      const url = match[1];
      opened = true;
      const openCmd = os.platform() === 'darwin' ? 'open' : os.platform() === 'win32' ? 'start' : 'xdg-open';
      spawn(openCmd, [url], { stdio: 'ignore', detached: true });
    }
  }
});

proc.on('close', (code) => {
  process.exit(code ?? 0);
});
