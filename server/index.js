
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'web')));

const TOKEN = process.env.WABA_TOKEN;
const PHONE_ID = process.env.WABA_PHONE_ID;

if (!TOKEN || !PHONE_ID) {
  console.warn('Warning: WABA_TOKEN or WABA_PHONE_ID not set. Set them in .env before starting.');
}

app.post('/api/send', async (req, res) => {
  try {
    const { numbers, message } = req.body;
    if (!Array.isArray(numbers) || !message) {
      return res.status(400).json({ success:false, error: 'numbers (array) and message are required' });
    }

    const results = [];
    for (const num of numbers) {
      // Basic validation - ensure digits only (plus optional +)
      const sanitized = (''+num).replace(/\s+/g,'');
      if (!sanitized) { results.push({ number: num, status: 'skipped', reason:'empty' }); continue; }

      // Send message via Meta WhatsApp Cloud API
      const payload = {
        messaging_product: "whatsapp",
        to: sanitized,
        type: "text",
        text: { body: message }
      };

      try {
        const resp = await axios.post(
          `https://graph.facebook.com/v17.0/${PHONE_ID}/messages`,
          payload,
          { headers: { Authorization: `Bearer ${TOKEN}` } }
        );
        results.push({ number: sanitized, status: 'sent', id: resp.data?.messages?.[0]?.id || null });
      } catch (err) {
        const e = err?.response?.data || err.message || String(err);
        results.push({ number: sanitized, status: 'error', error: e });
      }
    }

    res.json({ success:true, results });
  } catch (err) {
    res.status(500).json({ success:false, error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Server listening on ${PORT}`));
