const fs = require('fs');
const path = require('path');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const fallback = process.env.NODE_ENV === 'test' ? LEVELS.error : LEVELS.info;
const chosen = LEVELS[process.env.LOG_LEVEL] ?? fallback;

let fileOut = null;
if (process.env.LOG_FILE) {
    const target = path.resolve(process.env.LOG_FILE);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fileOut = fs.createWriteStream(target, { flags: 'a' });
}

function write(level, message, extra) {
    if (LEVELS[level] > chosen) return;

    let line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
    if (extra !== undefined) line += ' ' + JSON.stringify(extra);

    if (level === 'error') console.error(line);
    else console.log(line);

    if (fileOut) fileOut.write(line + '\n');
}

module.exports = {
    error: (msg, extra) => write('error', msg, extra),
    warn: (msg, extra) => write('warn', msg, extra),
    info: (msg, extra) => write('info', msg, extra),
    debug: (msg, extra) => write('debug', msg, extra),
    httpStream: { write: (text) => write('info', text.trim()) }
};
