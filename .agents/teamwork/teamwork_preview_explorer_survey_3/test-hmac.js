const crypto = require('crypto');

const secret = 'test_secret_12345';
const payloadWithEmojis = JSON.stringify({
  entry: [{
    messaging: [{
      sender: { id: "12345" },
      message: { text: "Hola! 🌸💐🌹 Mensaje con tildes y emojis: ¡éxito total!" }
    }]
  }]
});

// Compare string vs Buffer hmac
const hmacString = crypto.createHmac('sha256', secret).update(payloadWithEmojis, 'utf8').digest('hex');
const hmacBuffer = crypto.createHmac('sha256', secret).update(Buffer.from(payloadWithEmojis, 'utf8')).digest('hex');

console.log('HMAC from String (utf8 default):', hmacString);
console.log('HMAC from Buffer:', hmacBuffer);
console.log('Match?', hmacString === hmacBuffer);
