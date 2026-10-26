import https from 'node:https';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'PromptGrammarly/1.0' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(JSON.parse(data)));
      })
      .on('error', reject);
  });
}

function main() {
  console.log('Fetching latest Ollama release from GitHub API...');

  fetchJson('https://api.github.com/repos/ollama/ollama/releases/latest')
    .then((release) => {
      console.log('Assets in release:');
      release.assets.forEach((a) => console.log(`  - ${a.name} (${a.size} bytes)`));

      const asset = release.assets.find(
        (a) => a.name.endsWith('.exe') || (a.name.includes('windows') && a.name.endsWith('.zip'))
      );
      console.log('Matched:', asset?.name || 'none');
    })
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
}

main();
