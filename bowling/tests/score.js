const E = require('../src/engine.js');
const cases = [[Array(12).fill(10), 300], [Array(21).fill(5), 150], [Array(20).fill(0), 0], [[10,7,3,9,0,10,0,8,8,2,0,6,10,10,10,8,1], 167], [Array(20).fill(4).concat([]), 80]];
for(const [r, want] of cases){ const s = E.scoreGame(r); console.log(s.total===want ? 'ok ' : 'BAD', want, s.total, E.gameState(r).done, s.frames.map(f=>E.rollMarks(f).join('')).join('|')); }
console.log(JSON.stringify(E.gameState([10,10,10,10,10,10,10,10,10,10])), JSON.stringify(E.gameState(Array(18).fill(4).concat([3,7]))));
console.log('splits', E.isSplit([7,10]), E.isSplit([4,6]), E.isSplit([2,4,5]), E.isSplit([1,7]), E.isSplit([6,7,10]));
