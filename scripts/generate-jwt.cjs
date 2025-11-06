const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'; // เปลี่ยนเป็นของจริงเวลาทดสอบกับ Render
function mint(payload){ return jwt.sign(payload, SECRET, { algorithm:'HS256', expiresIn:'7d' }); }

const a = mint({ sub: 'userA', wallet: 'walletA111' });
const b = mint({ sub: 'userB', wallet: 'walletB222' });

console.log('JWT_A=', a);
console.log('JWT_B=', b);
